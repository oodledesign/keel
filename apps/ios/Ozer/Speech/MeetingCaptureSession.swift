import AVFoundation
import Foundation
import Observation
import Speech
import UIKit

struct MeetingCaptureResult {
    var transcript: String
    var turns: [SpeakerTurn]
    var duration: TimeInterval
    var audioURL: URL?
}

/// In-room meeting: on-device captions, pause-split speakers, m4a on disk.
@MainActor
@Observable
final class MeetingCaptureSession {
    private(set) var isRecording = false
    private(set) var elapsed: TimeInterval = 0
    private(set) var liveTranscript = ""
    private(set) var lastError: String?

    private let engine = AVAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var audioFile: AVAudioFile?
    private var cafURL: URL?
    private var splitter = SpeakerTurnSplitter()
    private var startedAt = Date()
    private var elapsedTimer: Timer?
    private var restartTask: Task<Void, Never>?
    private var pauseTask: Task<Void, Never>?
    private var recordingID = UUID()

    private static let restartAfter: TimeInterval = 50

    var elapsedLabel: String {
        Self.formatElapsed(elapsed)
    }

    func start() async throws {
        try await SpeechPermissions.request()
        teardown(deactivateAudio: true)
        lastError = nil
        splitter = SpeakerTurnSplitter()
        liveTranscript = ""
        elapsed = 0
        startedAt = Date()
        recordingID = UUID()

        let recognizer = try SpeechPermissions.makeRecognizer()
        guard recognizer.isAvailable else {
            throw SpeechPermissionError.onDeviceUnavailable
        }
        if !recognizer.supportsOnDeviceRecognition {
            throw SpeechPermissionError.onDeviceUnavailable
        }
        self.recognizer = recognizer

        try OnDeviceSpeechSession.activateAudioSession(playAndRecord: true)
        UIApplication.shared.isIdleTimerDisabled = true

        let cafURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("ozer-meeting-\(recordingID.uuidString).caf")
        self.cafURL = cafURL
        try startEngine(cafURL: cafURL)
        try startSpeech(recognizer: recognizer)
        isRecording = true
        startElapsedTimer()
        scheduleRestart()
    }

    func stop() async throws -> MeetingCaptureResult {
        pauseTask?.cancel()
        restartTask?.cancel()
        pauseTask = nil
        restartTask = nil
        elapsedTimer?.invalidate()
        elapsedTimer = nil
        request?.endAudio()
        task?.cancel()
        if engine.isRunning {
            engine.stop()
        }
        engine.inputNode.removeTap(onBus: 0)
        audioFile = nil

        let duration = Date().timeIntervalSince(startedAt)
        elapsed = duration
        let transcript = splitter.finish()
        liveTranscript = transcript
        isRecording = false
        UIApplication.shared.isIdleTimerDisabled = false

        let audioURL = try await Self.persistM4A(from: cafURL, id: recordingID)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

        return MeetingCaptureResult(
            transcript: transcript,
            turns: splitter.turns,
            duration: duration,
            audioURL: audioURL
        )
    }

    func cancel() {
        pauseTask?.cancel()
        restartTask?.cancel()
        teardown(deactivateAudio: true)
        UIApplication.shared.isIdleTimerDisabled = false
        isRecording = false
    }

    private func startEngine(cafURL: URL) throws {
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.removeTap(onBus: 0)
        audioFile = try AVAudioFile(forWriting: cafURL, settings: format.settings)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.request?.append(buffer)
            try? self?.audioFile?.write(from: buffer)
        }
        engine.prepare()
        try engine.start()
    }

    private func startSpeech(recognizer: SFSpeechRecognizer) throws {
        let request = SFSpeechAudioBufferRecognitionRequest()
        SpeechPermissions.configureOnDevice(request)
        self.request = request
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self, self.isRecording else { return }
                if let result {
                    self.applyRecognition(result.bestTranscription.formattedString)
                    if result.isFinal {
                        self.restartRecognition()
                    }
                }
                if error != nil {
                    self.restartRecognition()
                }
            }
        }
    }

    private func applyRecognition(_ formatted: String) {
        let elapsedNow = Date().timeIntervalSince(startedAt)
        splitter.ingest(sessionText: formatted, at: elapsedNow)
        liveTranscript = splitter.formattedBody
        armPauseCommit()
    }

    private func armPauseCommit() {
        pauseTask?.cancel()
        pauseTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(SpeakerTurnSplitter.pauseThreshold))
            guard let self, !Task.isCancelled, self.isRecording else { return }
            self.splitter.commitOpen()
            self.liveTranscript = self.splitter.formattedBody
        }
    }

    private func scheduleRestart() {
        restartTask?.cancel()
        restartTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(Self.restartAfter))
            guard let self, !Task.isCancelled, self.isRecording else { return }
            self.restartRecognition()
        }
    }

    private func restartRecognition() {
        guard isRecording, let recognizer else { return }
        splitter.rollSession()
        liveTranscript = splitter.formattedBody
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
        do {
            try startSpeech(recognizer: recognizer)
            scheduleRestart()
        } catch {
            lastError = error.localizedDescription
        }
    }

    private func startElapsedTimer() {
        elapsedTimer?.invalidate()
        elapsedTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.isRecording else { return }
                self.elapsed = Date().timeIntervalSince(self.startedAt)
            }
        }
    }

    private func teardown(deactivateAudio: Bool) {
        elapsedTimer?.invalidate()
        elapsedTimer = nil
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
        if engine.isRunning {
            engine.stop()
        }
        engine.inputNode.removeTap(onBus: 0)
        audioFile = nil
        if deactivateAudio {
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    nonisolated static func formatElapsed(_ seconds: TimeInterval) -> String {
        let total = max(0, Int(seconds))
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let secs = total % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        }
        return String(format: "%d:%02d", minutes, secs)
    }

    private static func persistM4A(from cafURL: URL?, id: UUID) async throws -> URL? {
        guard let cafURL, FileManager.default.fileExists(atPath: cafURL.path) else {
            return nil
        }
        let destination = MeetingStore.audioURL(for: id)
        try FileManager.default.createDirectory(
            at: destination.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }

        let asset = AVURLAsset(url: cafURL)
        guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else {
            try FileManager.default.copyItem(at: cafURL, to: destination)
            try? FileManager.default.removeItem(at: cafURL)
            return destination
        }
        session.outputURL = destination
        session.outputFileType = .m4a
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            session.exportAsynchronously {
                continuation.resume()
            }
        }
        if session.status == .completed {
            try? FileManager.default.removeItem(at: cafURL)
            return destination
        }
        if !FileManager.default.fileExists(atPath: destination.path) {
            try? FileManager.default.copyItem(at: cafURL, to: destination)
        }
        try? FileManager.default.removeItem(at: cafURL)
        if FileManager.default.fileExists(atPath: destination.path) {
            return destination
        }
        return nil
    }
}

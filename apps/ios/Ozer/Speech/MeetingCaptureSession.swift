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

    private let audio = SpeechAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var cafURL: URL?
    private var splitter = SpeakerTurnSplitter()
    private var startedAt = Date()
    private var elapsedTimer: Timer?
    private var restartTask: Task<Void, Never>?
    private var pauseTask: Task<Void, Never>?
    private var recordingID = UUID()
    private var speechEpoch = 0
    private var consecutiveSpeechFailures = 0

    private static let restartAfter: TimeInterval = 50
    private static let restartBackoff: TimeInterval = 1.5
    private static let maxSpeechFailures = 3

    var elapsedLabel: String {
        Self.formatElapsed(elapsed)
    }

    func start() async throws {
        teardown(deactivateAudio: true)
        lastError = nil
        splitter = SpeakerTurnSplitter()
        liveTranscript = ""
        elapsed = 0
        startedAt = Date()
        recordingID = UUID()
        speechEpoch = 0
        consecutiveSpeechFailures = 0

        guard SpeechPermissions.liveOnDeviceSpeechSupported else {
            beginSimulatorPlaceholder()
            return
        }

        try await SpeechPermissions.request()
        try Task.checkCancellation()

        let recognizer = try SpeechPermissions.requireOnDeviceRecognizer()
        self.recognizer = recognizer

        do {
            try SpeechPermissions.activateAudioSession(playAndRecord: true)
            UIApplication.shared.isIdleTimerDisabled = true

            let cafURL = FileManager.default.temporaryDirectory
                .appendingPathComponent("ozer-meeting-\(recordingID.uuidString).caf")
            self.cafURL = cafURL
            try audio.start(writingTo: cafURL)
            isRecording = true
            startElapsedTimer()
        } catch {
            teardown(deactivateAudio: true)
            UIApplication.shared.isIdleTimerDisabled = false
            throw error
        }

        do {
            try startSpeech(recognizer: recognizer)
            scheduleRestart()
        } catch {
            lastError = error.localizedDescription
        }
    }

    func stop() async throws -> MeetingCaptureResult {
        guard isRecording else {
            return MeetingCaptureResult(transcript: "", turns: [], duration: 0, audioURL: nil)
        }
        pauseTask?.cancel()
        restartTask?.cancel()
        pauseTask = nil
        restartTask = nil
        elapsedTimer?.invalidate()
        elapsedTimer = nil
        invalidateSpeech()
        audio.stop()

        let duration = Date().timeIntervalSince(startedAt)
        elapsed = duration
        let transcript = splitter.finish()
        liveTranscript = transcript
        isRecording = false
        UIApplication.shared.isIdleTimerDisabled = false

        let audioURL = try await Self.persistM4A(from: cafURL, id: recordingID)
        SpeechPermissions.deactivateAudioSession()

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
        if let url = cafURL {
            try? FileManager.default.removeItem(at: url)
            cafURL = nil
        }
        UIApplication.shared.isIdleTimerDisabled = false
        isRecording = false
    }

    private func beginSimulatorPlaceholder() {
        lastError = SpeechPermissionError.simulatorUnsupported.errorDescription
        liveTranscript = SpeechPermissionError.simulatorUnsupported.errorDescription ?? ""
        isRecording = true
        UIApplication.shared.isIdleTimerDisabled = true
        startElapsedTimer()
    }

    private func startSpeech(recognizer: SFSpeechRecognizer) throws {
        speechEpoch += 1
        let epoch = speechEpoch
        let request = SFSpeechAudioBufferRecognitionRequest()
        SpeechPermissions.configureOnDevice(request)
        self.request = request
        audio.attach(request)
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self, self.isRecording, self.speechEpoch == epoch else { return }
                if let result {
                    self.consecutiveSpeechFailures = 0
                    self.applyRecognition(result.bestTranscription.formattedString)
                    if result.isFinal {
                        self.restartRecognition()
                    }
                    return
                }
                if error != nil {
                    self.handleSpeechFailure()
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

    private func handleSpeechFailure() {
        consecutiveSpeechFailures += 1
        if consecutiveSpeechFailures >= Self.maxSpeechFailures {
            lastError = SpeechPermissionError.onDeviceUnavailable.errorDescription
            invalidateSpeech()
            restartTask?.cancel()
            restartTask = nil
            return
        }
        restartTask?.cancel()
        restartTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(Self.restartBackoff))
            guard let self, !Task.isCancelled, self.isRecording else { return }
            self.restartRecognition()
        }
    }

    private func restartRecognition() {
        guard isRecording, let recognizer else { return }
        splitter.rollSession()
        liveTranscript = splitter.formattedBody
        invalidateSpeech()
        do {
            try startSpeech(recognizer: recognizer)
            scheduleRestart()
        } catch {
            lastError = error.localizedDescription
        }
    }

    private func invalidateSpeech() {
        speechEpoch += 1
        audio.attach(nil)
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
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
        invalidateSpeech()
        audio.stop()
        if deactivateAudio {
            SpeechPermissions.deactivateAudioSession()
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

    nonisolated private static func persistM4A(from cafURL: URL?, id: UUID) async throws -> URL? {
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

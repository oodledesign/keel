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
    private(set) var statusMessage: String?
    private(set) var modelProgress: Double?

    private let audio = SpeechAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var cafURL: URL?
    private var splitter = SpeakerTurnSplitter()
    private var startedAt = Date()
    private var elapsedTimer: Timer?
    private var sessionEndTask: Task<Void, Never>?
    private var restartTask: Task<Void, Never>?
    private var pauseTask: Task<Void, Never>?
    private var recordingID = UUID()
    private var speechEpoch = 0
    private var isRestartingSpeech = false
    private var speechSessionOrigin: TimeInterval = 0
    private var prepareTask: Task<Void, Never>?

    private static let restartAfter: TimeInterval = 50
    private static let restartHandshake: TimeInterval = 0.35
    private static let restartFallback: TimeInterval = 2.5
    private static let restartBackoff: TimeInterval = 1.5

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
        isRestartingSpeech = false
        speechSessionOrigin = 0
        statusMessage = nil
        modelProgress = nil

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
            prepareDiarizerInBackground()
        } catch {
            teardown(deactivateAudio: true)
            UIApplication.shared.isIdleTimerDisabled = false
            throw error
        }

        do {
            try startSpeech(recognizer: recognizer)
            scheduleSessionEnd()
        } catch {
            lastError = error.localizedDescription
        }
    }

    func stop() async throws -> MeetingCaptureResult {
        guard isRecording else {
            return MeetingCaptureResult(transcript: "", turns: [], duration: 0, audioURL: nil)
        }
        pauseTask?.cancel()
        sessionEndTask?.cancel()
        restartTask?.cancel()
        pauseTask = nil
        sessionEndTask = nil
        restartTask = nil
        elapsedTimer?.invalidate()
        elapsedTimer = nil
        invalidateSpeech()
        audio.stop()

        let duration = Date().timeIntervalSince(startedAt)
        elapsed = duration
        isRecording = false
        UIApplication.shared.isIdleTimerDisabled = false

        await relabelSpeakersIfPossible()
        let transcript = splitter.finish()
        liveTranscript = transcript

        let audioURL = try await Self.persistM4A(from: cafURL, id: recordingID)
        SpeechPermissions.deactivateAudioSession()
        statusMessage = nil
        modelProgress = nil

        return MeetingCaptureResult(
            transcript: transcript,
            turns: splitter.turns,
            duration: duration,
            audioURL: audioURL
        )
    }

    func cancel() {
        pauseTask?.cancel()
        sessionEndTask?.cancel()
        restartTask?.cancel()
        prepareTask?.cancel()
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
        speechSessionOrigin = Date().timeIntervalSince(startedAt)
        splitter.beginSession(at: speechSessionOrigin)
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self, self.isRecording, self.speechEpoch == epoch else { return }
                if let result {
                    self.lastError = nil
                    self.applyRecognition(result)
                    if result.isFinal {
                        self.queueSpeechRestart()
                    }
                    return
                }
                if let error {
                    if SpeechPermissions.isCancellation(error) {
                        self.queueSpeechRestart()
                        return
                    }
                    self.lastError = error.localizedDescription
                    self.queueSpeechRestart()
                }
            }
        }
    }

    private func applyRecognition(_ result: SFSpeechRecognitionResult) {
        let elapsedNow = Date().timeIntervalSince(startedAt)
        splitter.ingest(sessionText: result.bestTranscription.formattedString, at: elapsedNow)
        let captions = result.bestTranscription.segments.compactMap { segment -> TimedCaption? in
            let text = segment.substring.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return nil }
            let start = speechSessionOrigin + segment.timestamp
            return TimedCaption(start: start, end: start + segment.duration, text: text)
        }
        splitter.ingestCaptions(captions)
        liveTranscript = splitter.formattedBody
        armPauseCommit()
    }

    private func prepareDiarizerInBackground() {
        prepareTask?.cancel()
        guard DiarizationModels.isSupported else { return }
        if DiarizationModels.areReady {
            statusMessage = nil
            modelProgress = nil
            return
        }
        statusMessage = "Downloading speaker models…"
        modelProgress = 0
        prepareTask = Task { [weak self] in
            do {
                try await DiarizationModels.prepare { [weak self] fraction in
                    Task { @MainActor in
                        self?.modelProgress = fraction
                    }
                }
                await MainActor.run {
                    guard let self, !Task.isCancelled else { return }
                    self.modelProgress = 1
                    self.statusMessage = "Speaker models ready. Labels are applied when you stop."
                }
            } catch {
                await MainActor.run {
                    guard let self, !Task.isCancelled else { return }
                    self.modelProgress = nil
                    self.lastError = SpeechPermissionError.diarizationUnavailable.errorDescription
                    self.statusMessage = nil
                }
            }
        }
    }

    private func relabelSpeakersIfPossible() async {
        guard DiarizationModels.isSupported else { return }
        guard let cafURL else { return }
        if let prepareTask {
            _ = await prepareTask.value
        }
        do {
            if !DiarizationModels.areReady {
                statusMessage = "Downloading speaker models…"
                try await DiarizationModels.prepare { [weak self] fraction in
                    Task { @MainActor in
                        self?.modelProgress = fraction
                    }
                }
            }
            statusMessage = "Labelling speakers…"
            modelProgress = nil
            let spans = try await LocalDiarizer.shared.diarize(fileURL: cafURL) { [weak self] fraction in
                Task { @MainActor in
                    self?.modelProgress = fraction
                }
            }
            splitter.applyDiarization(spans)
            liveTranscript = splitter.formattedBody
        } catch {
            splitter.applyDiarization([])
            lastError = SpeechPermissionError.diarizationUnavailable.errorDescription
        }
    }

    private func armPauseCommit() {
        pauseTask?.cancel()
        pauseTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(SpeakerTurnSplitter.paragraphThreshold))
            guard let self, !Task.isCancelled, self.isRecording else { return }
            self.splitter.commitOpen()
            self.liveTranscript = self.splitter.formattedBody
        }
    }

    /// End the ~1 minute Apple session cleanly so `isFinal` can start the next one.
    private func scheduleSessionEnd() {
        sessionEndTask?.cancel()
        sessionEndTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(Self.restartAfter))
            guard let self, !Task.isCancelled, self.isRecording else { return }
            self.request?.endAudio()
            try? await Task.sleep(for: .seconds(Self.restartFallback))
            guard !Task.isCancelled, self.isRecording, !self.isRestartingSpeech else { return }
            self.queueSpeechRestart()
        }
    }

    /// Keep the CAF/m4a tap running. Only swap the Speech request/task.
    private func queueSpeechRestart() {
        guard isRecording, recognizer != nil else { return }
        guard !isRestartingSpeech else { return }
        isRestartingSpeech = true
        splitter.rollSession()
        liveTranscript = splitter.formattedBody
        audio.attach(nil)
        request?.endAudio()
        request = nil

        restartTask?.cancel()
        restartTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(Self.restartHandshake))
            guard let self, !Task.isCancelled, self.isRecording else {
                self?.isRestartingSpeech = false
                return
            }
            self.completeSpeechRestart()
        }
    }

    private func completeSpeechRestart() {
        guard isRecording, let recognizer else {
            isRestartingSpeech = false
            return
        }
        task = nil
        do {
            try startSpeech(recognizer: recognizer)
            scheduleSessionEnd()
            isRestartingSpeech = false
        } catch {
            isRestartingSpeech = false
            lastError = error.localizedDescription
            restartTask?.cancel()
            restartTask = Task { [weak self] in
                try? await Task.sleep(for: .seconds(Self.restartBackoff))
                guard let self, !Task.isCancelled, self.isRecording else { return }
                self.queueSpeechRestart()
            }
        }
    }

    private func invalidateSpeech() {
        speechEpoch += 1
        isRestartingSpeech = false
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
        sessionEndTask?.cancel()
        restartTask?.cancel()
        pauseTask?.cancel()
        prepareTask?.cancel()
        sessionEndTask = nil
        restartTask = nil
        pauseTask = nil
        prepareTask = nil
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

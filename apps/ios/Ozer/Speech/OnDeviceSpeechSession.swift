import Foundation
import Observation
import Speech

/// Live on-device dictation. No audio file, no cloud STT.
@MainActor
@Observable
final class OnDeviceSpeechSession {
    private(set) var partialText = ""
    private(set) var isListening = false
    private(set) var lastError: String?

    private let audio = SpeechAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var restartTask: Task<Void, Never>?
    private var speechEpoch = 0
    private var consecutiveSpeechFailures = 0
    /// Restart before Apple’s ~1 minute recognition window ends.
    private static let restartAfter: TimeInterval = 50
    private static let restartBackoff: TimeInterval = 1.5
    private static let maxSpeechFailures = 3

    var displayText: String {
        partialText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func start() async throws {
        stopEngine()
        lastError = nil
        partialText = ""
        speechEpoch = 0
        consecutiveSpeechFailures = 0

        guard SpeechPermissions.liveOnDeviceSpeechSupported else {
            throw SpeechPermissionError.simulatorUnsupported
        }

        try await SpeechPermissions.request()

        let recognizer = try SpeechPermissions.requireOnDeviceRecognizer()
        self.recognizer = recognizer

        try SpeechPermissions.activateAudioSession(playAndRecord: false)
        do {
            try audio.start(writingTo: nil)
        } catch {
            stopEngine()
            throw error
        }
        isListening = true

        do {
            try startSpeech(recognizer: recognizer)
            scheduleRestart()
        } catch {
            isListening = false
            stopEngine()
            throw error
        }
    }

    func stop() -> String {
        restartTask?.cancel()
        restartTask = nil
        let text = displayText
        stopEngine()
        isListening = false
        return text
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
                guard let self, self.isListening, self.speechEpoch == epoch else { return }
                if let result {
                    self.consecutiveSpeechFailures = 0
                    let next = result.bestTranscription.formattedString
                    if self.partialText.isEmpty || next.count >= self.partialText.count {
                        self.partialText = next
                    } else if !next.isEmpty {
                        self.partialText = "\(self.partialText) \(next)"
                    }
                    if result.isFinal {
                        self.restartRecognitionIfNeeded()
                    }
                    return
                }
                if error != nil {
                    self.handleSpeechFailure()
                }
            }
        }
    }

    private func scheduleRestart() {
        restartTask?.cancel()
        restartTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(Self.restartAfter))
            guard let self, !Task.isCancelled, self.isListening else { return }
            self.restartRecognitionIfNeeded()
        }
    }

    private func handleSpeechFailure() {
        consecutiveSpeechFailures += 1
        if consecutiveSpeechFailures >= Self.maxSpeechFailures {
            lastError = SpeechPermissionError.onDeviceUnavailable.errorDescription
            isListening = false
            stopEngine()
            return
        }
        restartTask?.cancel()
        restartTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(Self.restartBackoff))
            guard let self, !Task.isCancelled, self.isListening else { return }
            self.restartRecognitionIfNeeded()
        }
    }

    private func restartRecognitionIfNeeded() {
        guard isListening, let recognizer else { return }
        invalidateSpeech()
        do {
            try startSpeech(recognizer: recognizer)
            scheduleRestart()
        } catch {
            lastError = error.localizedDescription
            isListening = false
            stopEngine()
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

    private func stopEngine() {
        restartTask?.cancel()
        restartTask = nil
        invalidateSpeech()
        audio.stop()
        SpeechPermissions.deactivateAudioSession()
    }
}

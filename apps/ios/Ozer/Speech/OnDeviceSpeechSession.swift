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
    private var sessionEndTask: Task<Void, Never>?
    private var restartTask: Task<Void, Never>?
    private var speechEpoch = 0
    private var isRestartingSpeech = false
    /// Restart before Apple’s ~1 minute recognition window ends.
    private static let restartAfter: TimeInterval = 50
    private static let restartHandshake: TimeInterval = 0.35
    private static let restartFallback: TimeInterval = 2.5
    private static let restartBackoff: TimeInterval = 1.5

    var displayText: String {
        partialText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func start() async throws {
        stopEngine()
        lastError = nil
        partialText = ""
        speechEpoch = 0
        isRestartingSpeech = false

        guard SpeechPermissions.liveOnDeviceSpeechSupported else {
            throw SpeechPermissionError.simulatorUnsupported
        }

        try await SpeechPermissions.request()
        try Task.checkCancellation()

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
            scheduleSessionEnd()
        } catch {
            isListening = false
            stopEngine()
            throw error
        }
    }

    func stop() -> String {
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
                    self.lastError = nil
                    let next = result.bestTranscription.formattedString
                    if self.partialText.isEmpty || next.count >= self.partialText.count {
                        self.partialText = next
                    } else if !next.isEmpty {
                        self.partialText = "\(self.partialText) \(next)"
                    }
                    if result.isFinal {
                        self.queueSpeechRestart()
                    }
                    return
                }
                if let error {
                    if !SpeechPermissions.isCancellation(error) {
                        self.lastError = error.localizedDescription
                    }
                    self.queueSpeechRestart()
                }
            }
        }
    }

    private func scheduleSessionEnd() {
        sessionEndTask?.cancel()
        sessionEndTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(Self.restartAfter))
            guard let self, !Task.isCancelled, self.isListening else { return }
            self.request?.endAudio()
            try? await Task.sleep(for: .seconds(Self.restartFallback))
            guard let self, !Task.isCancelled, self.isListening, !self.isRestartingSpeech else { return }
            self.queueSpeechRestart()
        }
    }

    private func queueSpeechRestart() {
        guard isListening, recognizer != nil else { return }
        guard !isRestartingSpeech else { return }
        isRestartingSpeech = true
        audio.attach(nil)
        request?.endAudio()
        request = nil

        restartTask?.cancel()
        restartTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(Self.restartHandshake))
            guard let self, !Task.isCancelled, self.isListening else {
                self?.isRestartingSpeech = false
                return
            }
            self.completeSpeechRestart()
        }
    }

    private func completeSpeechRestart() {
        guard isListening, let recognizer else {
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
                guard let self, !Task.isCancelled, self.isListening else { return }
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

    private func stopEngine() {
        sessionEndTask?.cancel()
        restartTask?.cancel()
        sessionEndTask = nil
        restartTask = nil
        invalidateSpeech()
        audio.stop()
        SpeechPermissions.deactivateAudioSession()
    }
}

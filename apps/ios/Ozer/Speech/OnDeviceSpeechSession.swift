import AVFoundation
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

    private let engine = AVAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var restartTask: Task<Void, Never>?
    /// Restart before Apple’s ~1 minute recognition window ends.
    private static let restartAfter: TimeInterval = 50

    var displayText: String {
        partialText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func start() async throws {
        try await SpeechPermissions.request()
        stopEngine()
        lastError = nil
        partialText = ""

        let recognizer = try SpeechPermissions.makeRecognizer()
        guard recognizer.isAvailable else {
            throw SpeechPermissionError.onDeviceUnavailable
        }
        if !recognizer.supportsOnDeviceRecognition {
            throw SpeechPermissionError.onDeviceUnavailable
        }
        self.recognizer = recognizer

        try Self.activateAudioSession(playAndRecord: false)
        try startEngine()
        try startSpeech(recognizer: recognizer)
        isListening = true
        scheduleRestart()
    }

    func stop() -> String {
        restartTask?.cancel()
        restartTask = nil
        let text = displayText
        stopEngine()
        isListening = false
        return text
    }

    private func startEngine() throws {
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.request?.append(buffer)
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
                guard let self else { return }
                if let result {
                    let next = result.bestTranscription.formattedString
                    if self.partialText.isEmpty || next.count >= self.partialText.count {
                        self.partialText = next
                    } else if !next.isEmpty {
                        self.partialText = "\(self.partialText) \(next)"
                    }
                    if result.isFinal, self.isListening {
                        self.restartRecognitionIfNeeded()
                    }
                }
                if error != nil, self.isListening {
                    self.restartRecognitionIfNeeded()
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

    private func restartRecognitionIfNeeded() {
        guard isListening, let recognizer else { return }
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
        do {
            try startSpeech(recognizer: recognizer)
            scheduleRestart()
        } catch {
            lastError = error.localizedDescription
            isListening = false
            stopEngine()
        }
    }

    private func stopEngine() {
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
        if engine.isRunning {
            engine.stop()
        }
        engine.inputNode.removeTap(onBus: 0)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    static func activateAudioSession(playAndRecord: Bool) throws {
        let session = AVAudioSession.sharedInstance()
        if playAndRecord {
            try session.setCategory(
                .playAndRecord,
                mode: .spokenAudio,
                options: [.defaultToSpeaker, .allowBluetooth]
            )
        } else {
            try session.setCategory(
                .record,
                mode: .spokenAudio,
                options: [.allowBluetooth]
            )
        }
        try session.setActive(true)
    }
}

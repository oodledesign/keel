import AVFoundation
import Foundation
import Speech

enum SpeechPermissionError: LocalizedError {
    case microphoneDenied
    case speechDenied
    case localeUnavailable
    case onDeviceUnavailable
    case simulatorUnsupported
    case timedOut
    case audioEngineUnavailable
    case diarizationUnavailable

    var errorDescription: String? {
        switch self {
        case .microphoneDenied:
            return "Ozer needs the microphone to dictate notes and record meetings. Enable it in Settings → Ozer."
        case .speechDenied:
            return "Ozer transcribes on this iPhone. Enable Speech Recognition in Settings → Ozer."
        case .localeUnavailable:
            return "British English speech isn’t available on this iPhone."
        case .onDeviceUnavailable:
            return "On-device transcription isn’t available on this iPhone. Ozer won’t send speech to the cloud."
        case .simulatorUnsupported:
            return "Live captions and meetings need a real iPhone. The Simulator can’t run on-device speech without slowing the Mac."
        case .timedOut:
            return "Microphone or speech permission didn’t finish. Try again, or use a real iPhone."
        case .audioEngineUnavailable:
            return "Ozer couldn’t start the microphone. Try again on this iPhone."
        case .diarizationUnavailable:
            return "Speaker models couldn’t be downloaded. This meeting is saved as Me only."
        }
    }
}

enum SpeechPermissions {
    static let localeIdentifier = "en-GB"
    static let permissionTimeout: TimeInterval = 45

    /// On-device `SFSpeechRecognizer` plus a live mic tap pegs the host CPU in Simulator.
    static var liveOnDeviceSpeechSupported: Bool {
        #if targetEnvironment(simulator)
        return false
        #else
        return true
        #endif
    }

    static var britishEnglish: Locale {
        Locale(identifier: Self.localeIdentifier)
    }

    static func request() async throws {
        try await requestMicrophone()
        try await requestSpeech()
    }

    /// Build an en-GB recognizer and refuse cloud fallback before the engine starts.
    static func requireOnDeviceRecognizer() throws -> SFSpeechRecognizer {
        guard liveOnDeviceSpeechSupported else {
            throw SpeechPermissionError.simulatorUnsupported
        }
        let recognizer = try makeRecognizer()
        guard recognizer.isAvailable else {
            throw SpeechPermissionError.onDeviceUnavailable
        }
        if !recognizer.supportsOnDeviceRecognition {
            throw SpeechPermissionError.onDeviceUnavailable
        }
        return recognizer
    }

    static func makeRecognizer() throws -> SFSpeechRecognizer {
        guard let recognizer = SFSpeechRecognizer(locale: Self.britishEnglish) else {
            throw SpeechPermissionError.localeUnavailable
        }
        return recognizer
    }

    static func configureOnDevice(_ request: SFSpeechAudioBufferRecognitionRequest) {
        request.shouldReportPartialResults = true
        request.addsPunctuation = true
        request.requiresOnDeviceRecognition = true
    }

    nonisolated static func activateAudioSession(playAndRecord: Bool) throws {
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

    nonisolated static func deactivateAudioSession() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// Cancellation from our own `endAudio` / task teardown is not a hard speech failure.
    nonisolated static func isCancellation(_ error: Error) -> Bool {
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain, nsError.code == NSURLErrorCancelled {
            return true
        }
        let domain = nsError.domain
        if domain == "kLSRErrorDomain" || domain == "kAFAssistantErrorDomain" {
            switch nsError.code {
            case 1, 203, 209, 216, 301:
                return true
            default:
                break
            }
        }
        let description = error.localizedDescription.lowercased()
        return description.contains("cancel")
    }

    private static func requestMicrophone() async throws {
        switch AVAudioApplication.shared.recordPermission {
        case .granted:
            return
        case .denied:
            throw SpeechPermissionError.microphoneDenied
        default:
            break
        }

        let granted = try await withTimeout(seconds: permissionTimeout) {
            await AVAudioApplication.requestRecordPermission()
        }
        guard granted else {
            throw SpeechPermissionError.microphoneDenied
        }
    }

    private static func requestSpeech() async throws {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized:
            return
        case .denied, .restricted:
            throw SpeechPermissionError.speechDenied
        case .notDetermined:
            break
        @unknown default:
            throw SpeechPermissionError.speechDenied
        }

        let status = try await requestSpeechAuthorization()
        switch status {
        case .authorized:
            return
        case .denied, .restricted, .notDetermined:
            throw SpeechPermissionError.speechDenied
        @unknown default:
            throw SpeechPermissionError.speechDenied
        }
    }

    private static func requestSpeechAuthorization() async throws -> SFSpeechRecognizerAuthorizationStatus {
        try await withCheckedThrowingContinuation { continuation in
            let box = ResumeOnce(continuation)
            SFSpeechRecognizer.requestAuthorization { status in
                box.resume(returning: status)
            }
            Task {
                try? await Task.sleep(for: .seconds(permissionTimeout))
                box.resume(throwing: SpeechPermissionError.timedOut)
            }
        }
    }

    private static func withTimeout<T: Sendable>(
        seconds: TimeInterval,
        operation: @escaping @Sendable () async -> T
    ) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask {
                await operation()
            }
            group.addTask {
                try await Task.sleep(for: .seconds(seconds))
                throw SpeechPermissionError.timedOut
            }
            guard let value = try await group.next() else {
                throw SpeechPermissionError.timedOut
            }
            group.cancelAll()
            return value
        }
    }
}

/// Resume a throwing continuation at most once from any queue.
private final class ResumeOnce<T: Sendable>: @unchecked Sendable {
    private let lock = NSLock()
    private var continuation: CheckedContinuation<T, Error>?

    init(_ continuation: CheckedContinuation<T, Error>) {
        self.continuation = continuation
    }

    func resume(returning value: T) {
        lock.lock()
        let pending = continuation
        continuation = nil
        lock.unlock()
        pending?.resume(returning: value)
    }

    func resume(throwing error: Error) {
        lock.lock()
        let pending = continuation
        continuation = nil
        lock.unlock()
        pending?.resume(throwing: error)
    }
}

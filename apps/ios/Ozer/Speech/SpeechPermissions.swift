import AVFoundation
import Foundation
import Speech

enum SpeechPermissionError: LocalizedError {
    case microphoneDenied
    case speechDenied
    case localeUnavailable
    case onDeviceUnavailable

    var errorDescription: String? {
        switch self {
        case .microphoneDenied:
            "Ozer needs the microphone to dictate notes and record meetings. Enable it in Settings → Ozer."
        case .speechDenied:
            "Ozer transcribes on this iPhone. Enable Speech Recognition in Settings → Ozer."
        case .localeUnavailable:
            "British English speech isn’t available on this iPhone."
        case .onDeviceUnavailable:
            "On-device transcription isn’t available on this iPhone. Ozer won’t send speech to the cloud."
        }
    }
}

enum SpeechPermissions {
    static let localeIdentifier = "en-GB"

    static var britishEnglish: Locale {
        Locale(identifier: Self.localeIdentifier)
    }

    static func request() async throws {
        let mic = await AVAudioApplication.requestRecordPermission()
        guard mic else { throw SpeechPermissionError.microphoneDenied }

        let speech = await Self.requestSpeechAuthorization()
        switch speech {
        case .authorized:
            break
        case .denied, .restricted:
            throw SpeechPermissionError.speechDenied
        case .notDetermined:
            throw SpeechPermissionError.speechDenied
        @unknown default:
            throw SpeechPermissionError.speechDenied
        }
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

    private static func requestSpeechAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
    }
}

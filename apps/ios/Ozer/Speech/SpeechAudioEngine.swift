import AVFoundation
import Foundation
import Speech

/// Owns the mic tap and optional CAF writer.
/// The tap must never hop to the main actor — that freezes the UI (and the Simulator host).
final class SpeechAudioEngine: @unchecked Sendable {
    private let engine = AVAudioEngine()
    private let lock = NSLock()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var audioFile: AVAudioFile?
    private var writesAudio = true

    func start(writingTo cafURL: URL?) throws {
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            throw SpeechPermissionError.audioEngineUnavailable
        }

        input.removeTap(onBus: 0)
        lock.lock()
        request = nil
        audioFile = nil
        writesAudio = true
        if let cafURL {
            do {
                audioFile = try AVAudioFile(forWriting: cafURL, settings: format.settings)
            } catch {
                lock.unlock()
                throw error
            }
        }
        lock.unlock()

        input.installTap(onBus: 0, bufferSize: 4096, format: format) { [weak self] buffer, _ in
            guard let self else { return }
            self.lock.lock()
            let request = self.request
            let file = self.writesAudio ? self.audioFile : nil
            self.lock.unlock()
            request?.append(buffer)
            try? file?.write(from: buffer)
        }
        engine.prepare()
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            lock.lock()
            audioFile = nil
            request = nil
            lock.unlock()
            throw error
        }
    }

    func attach(_ request: SFSpeechAudioBufferRecognitionRequest?) {
        lock.lock()
        self.request = request
        lock.unlock()
    }

    /// Keep the engine and CAF open. Pause only stops Speech + disk writes.
    func setWritingEnabled(_ enabled: Bool) {
        lock.lock()
        writesAudio = enabled
        lock.unlock()
    }

    func stop() {
        lock.lock()
        request = nil
        writesAudio = false
        lock.unlock()
        engine.inputNode.removeTap(onBus: 0)
        if engine.isRunning {
            engine.stop()
        }
        lock.lock()
        audioFile = nil
        lock.unlock()
    }
}

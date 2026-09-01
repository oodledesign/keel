import CoreML
import Foundation

/// On-device pyannote segmentation + WeSpeaker embeddings.
/// Weights are downloaded on first use (~32 MB). Not bundled in the App Store binary.
///
/// Models: FluidInference/speaker-diarization-coreml (ungated).
/// Parent pyannote pipeline is CC-BY-4.0 (attribution). WeSpeaker is Apache-2.0.
/// Do not use NVIDIA Sortformer.
enum DiarizationModels {
    static let repository = "FluidInference/speaker-diarization-coreml"
    static let segmentationBundle = "pyannote_segmentation.mlmodelc"
    static let embeddingBundle = "wespeaker_v2.mlmodelc"

    private static let requiredFiles = [
        "\(segmentationBundle)/coremldata.bin",
        "\(segmentationBundle)/metadata.json",
        "\(segmentationBundle)/model.mil",
        "\(segmentationBundle)/weights/weight.bin",
        "\(embeddingBundle)/coremldata.bin",
        "\(embeddingBundle)/metadata.json",
        "\(embeddingBundle)/model.mil",
        "\(embeddingBundle)/weights/weight.bin",
    ]

    nonisolated static var isSupported: Bool {
        #if targetEnvironment(simulator)
        return false
        #else
        return true
        #endif
    }

    nonisolated static var directory: URL {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("OzerDiarization", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutable = folder
        try? mutable.setResourceValues(values)
        return folder
    }

    nonisolated static var segmentationURL: URL {
        directory.appendingPathComponent(segmentationBundle, isDirectory: true)
    }

    nonisolated static var embeddingURL: URL {
        directory.appendingPathComponent(embeddingBundle, isDirectory: true)
    }

    nonisolated static var areReady: Bool {
        requiredFiles.allSatisfy { relative in
            FileManager.default.fileExists(atPath: directory.appendingPathComponent(relative).path)
        }
    }

    static func prepare(progress: @escaping @Sendable (Double) -> Void) async throws {
        try await DownloadGate.shared.prepare(progress: progress)
    }

    static func load() throws -> (segmentation: MLModel, embedding: MLModel) {
        guard areReady else {
            throw SpeechPermissionError.diarizationUnavailable
        }
        let configuration = MLModelConfiguration()
        configuration.computeUnits = .cpuAndNeuralEngine
        let segmentation = try MLModel(contentsOf: segmentationURL, configuration: configuration)
        let embedding = try MLModel(contentsOf: embeddingURL, configuration: configuration)
        return (segmentation, embedding)
    }

    fileprivate static func downloadFiles(progress: @escaping @Sendable (Double) -> Void) async throws {
        guard isSupported else {
            throw SpeechPermissionError.simulatorUnsupported
        }
        if areReady {
            progress(1)
            return
        }

        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let total = Double(requiredFiles.count)
        for (index, relative) in requiredFiles.enumerated() {
            let destination = directory.appendingPathComponent(relative)
            if FileManager.default.fileExists(atPath: destination.path) {
                progress(Double(index + 1) / total)
                continue
            }
            try await download(relative: relative, to: destination)
            progress(Double(index + 1) / total)
        }

        guard areReady else {
            throw SpeechPermissionError.diarizationUnavailable
        }
    }

    private static func download(relative: String, to destination: URL) async throws {
        let encoded = relative
            .split(separator: "/")
            .compactMap { $0.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) }
            .joined(separator: "/")
        guard let url = URL(string: "https://huggingface.co/\(repository)/resolve/main/\(encoded)") else {
            throw SpeechPermissionError.diarizationUnavailable
        }

        var request = URLRequest(url: url)
        request.setValue("Ozer iOS diarization", forHTTPHeaderField: "User-Agent")
        let (temp, response) = try await URLSession.shared.download(for: request)
        if let http = response as? HTTPURLResponse, !(200 ... 299).contains(http.statusCode) {
            throw SpeechPermissionError.diarizationUnavailable
        }

        try FileManager.default.createDirectory(
            at: destination.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: temp, to: destination)
    }
}

private actor DownloadGate {
    static let shared = DownloadGate()

    func prepare(progress: @escaping @Sendable (Double) -> Void) async throws {
        try await DiarizationModels.downloadFiles(progress: progress)
    }
}

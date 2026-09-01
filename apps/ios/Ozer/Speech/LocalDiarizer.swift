import AVFoundation
import CoreML
import Foundation

struct DiarizedSpan: Sendable, Equatable {
    var speakerIndex: Int
    var start: TimeInterval
    var end: TimeInterval
}

/// Pyannote segmentation-3.0 + WeSpeaker ResNet34-LM, then in-process clustering.
/// Runs off the main actor. Live captions stay on Apple Speech.
actor LocalDiarizer {
    static let shared = LocalDiarizer()

    private static let sampleRate = 16_000
    private static let windowSamples = 160_000
    private static let frameCount = 589
    private static let frameStep: TimeInterval = 0.016875
    private static let speakerSlots = 3
    private static let embeddingSize = 256
    private static let minActiveFrames: Float = 10
    private static let clusterThreshold: Float = 0.55

    private static let powerset: [[Int]] = [
        [],
        [0],
        [1],
        [2],
        [0, 1],
        [0, 2],
        [1, 2],
    ]

    func diarize(fileURL: URL, progress: @escaping @Sendable (Double) -> Void) async throws -> [DiarizedSpan] {
        let samples = try Self.mono16k(from: fileURL)
        return try diarize(samples: samples, progress: progress)
    }

    func diarize(samples: [Float], progress: @escaping @Sendable (Double) -> Void) throws -> [DiarizedSpan] {
        guard !samples.isEmpty else { return [] }
        let models = try DiarizationModels.load()
        var observations: [Observation] = []
        let step = Self.windowSamples / 2
        let total = max(1, samples.count)
        var offset = 0

        while offset < samples.count {
            let end = min(offset + Self.windowSamples, samples.count)
            let chunk = Array(samples[offset ..< end])
            let chunkStart = TimeInterval(offset) / TimeInterval(Self.sampleRate)
            let found = try processWindow(
                chunk,
                chunkStart: chunkStart,
                segmentation: models.segmentation,
                embedding: models.embedding
            )
            observations.append(contentsOf: found)
            offset += step
            progress(min(0.95, Double(end) / Double(total)))
        }

        let clustered = Self.cluster(observations)
        progress(1)
        return clustered
    }

    private struct Observation {
        var embedding: [Float]
        var start: TimeInterval
        var end: TimeInterval
    }

    private func processWindow(
        _ chunk: [Float],
        chunkStart: TimeInterval,
        segmentation: MLModel,
        embedding: MLModel
    ) throws -> [Observation] {
        let audio = try Self.audioArray(from: chunk)
        let segProvider = try MLDictionaryFeatureProvider(dictionary: [
            "audio": MLFeatureValue(multiArray: audio),
        ])
        let segOut = try segmentation.prediction(from: segProvider)
        guard let segments = segOut.featureValue(for: "segments")?.multiArrayValue else {
            return []
        }

        let masks = Self.binarize(segments)
        var observations: [Observation] = []
        for speaker in 0 ..< Self.speakerSlots {
            let activity = masks[speaker].reduce(0, +)
            guard activity >= Self.minActiveFrames else { continue }
            guard let vector = try Self.embedding(
                for: chunk,
                mask: masks[speaker],
                model: embedding
            ) else { continue }
            guard Self.magnitude(vector) > 0.1 else { continue }

            let (startFrame, endFrame) = Self.activeRange(masks[speaker])
            let start = chunkStart + TimeInterval(startFrame) * Self.frameStep
            let end = chunkStart + TimeInterval(endFrame) * Self.frameStep
            guard end - start >= 0.4 else { continue }
            observations.append(Observation(embedding: Self.normalize(vector), start: start, end: end))
        }
        return observations
    }

    private static func binarize(_ segments: MLMultiArray) -> [[Float]] {
        let frames = segments.shape[1].intValue
        let classes = segments.shape[2].intValue
        let pointer = segments.dataPointer.assumingMemoryBound(to: Float.self)
        var masks = Array(repeating: Array(repeating: Float(0), count: frames), count: speakerSlots)

        for frame in 0 ..< frames {
            var best = 0
            var bestScore = -Float.greatestFiniteMagnitude
            for klass in 0 ..< classes {
                let score = pointer[frame * classes + klass]
                if score > bestScore {
                    bestScore = score
                    best = klass
                }
            }
            guard best < powerset.count else { continue }
            for speaker in powerset[best] {
                masks[speaker][frame] = 1
            }
        }
        return masks
    }

    /// `wespeaker_v2.mlmodelc` inputs are `[3 × 160000]` and `[3 × 589]` (FluidInference export).
    /// Slot 0 holds this speaker; the other slots stay zero, matching FluidAudio’s extractor.
    private static func embedding(for chunk: [Float], mask: [Float], model: MLModel) throws -> [Float]? {
        let waveform = try MLMultiArray(shape: [3, NSNumber(value: windowSamples)], dataType: .float32)
        let maskArray = try MLMultiArray(shape: [3, NSNumber(value: frameCount)], dataType: .float32)
        fill(waveform, with: chunk, slot: 0)
        fillMask(maskArray, with: mask, slot: 0)

        let provider = try MLDictionaryFeatureProvider(dictionary: [
            "waveform": MLFeatureValue(multiArray: waveform),
            "mask": MLFeatureValue(multiArray: maskArray),
        ])
        let output = try model.prediction(from: provider)
        guard let array = output.featureValue(for: "embedding")?.multiArrayValue else {
            return nil
        }
        return extractEmbedding(array)
    }

    private static func extractEmbedding(_ array: MLMultiArray) -> [Float] {
        let pointer = array.dataPointer.assumingMemoryBound(to: Float.self)
        return (0 ..< embeddingSize).map { pointer[$0] }
    }

    private static func fill(_ array: MLMultiArray, with samples: [Float], slot: Int) {
        let pointer = array.dataPointer.assumingMemoryBound(to: Float.self)
        let offset = slot * windowSamples
        let count = min(samples.count, windowSamples)
        if count > 0 {
            samples.withUnsafeBufferPointer { buffer in
                guard let base = buffer.baseAddress else { return }
                pointer.advanced(by: offset).update(from: base, count: count)
            }
        }
        if count > 0, count < windowSamples {
            var written = count
            while written < windowSamples {
                let copy = min(written, windowSamples - written)
                pointer.advanced(by: offset + written).update(from: pointer.advanced(by: offset), count: copy)
                written += copy
            }
        }
    }

    private static func fillMask(_ array: MLMultiArray, with mask: [Float], slot: Int) {
        let pointer = array.dataPointer.assumingMemoryBound(to: Float.self)
        let offset = slot * frameCount
        let count = min(mask.count, frameCount)
        if count > 0 {
            mask.withUnsafeBufferPointer { buffer in
                guard let base = buffer.baseAddress else { return }
                pointer.advanced(by: offset).update(from: base, count: count)
            }
        }
    }

    private static func activeRange(_ mask: [Float]) -> (Int, Int) {
        let start = mask.firstIndex(where: { $0 > 0.5 }) ?? 0
        let end = mask.lastIndex(where: { $0 > 0.5 }).map { $0 + 1 } ?? mask.count
        return (start, end)
    }

    private static func cluster(_ observations: [Observation]) -> [DiarizedSpan] {
        guard !observations.isEmpty else { return [] }
        var labels = Array(0 ..< observations.count)

        func root(_ index: Int) -> Int {
            var current = index
            while labels[current] != current {
                labels[current] = labels[labels[current]]
                current = labels[current]
            }
            return current
        }

        for i in 0 ..< observations.count {
            for j in (i + 1) ..< observations.count {
                let distance = cosineDistance(observations[i].embedding, observations[j].embedding)
                if distance <= clusterThreshold {
                    labels[root(j)] = root(i)
                }
            }
        }

        var firstSeen: [Int: Int] = [:]
        var remapped: [Int] = []
        remapped.reserveCapacity(observations.count)
        for index in observations.indices {
            let parent = root(index)
            if firstSeen[parent] == nil {
                firstSeen[parent] = firstSeen.count
            }
            remapped.append(firstSeen[parent] ?? 0)
        }

        var spans: [DiarizedSpan] = observations.enumerated().map { index, item in
            DiarizedSpan(speakerIndex: remapped[index], start: item.start, end: item.end)
        }
        spans.sort { $0.start < $1.start }

        var merged: [DiarizedSpan] = []
        for span in spans {
            if let last = merged.last, last.speakerIndex == span.speakerIndex, span.start <= last.end + 0.4 {
                merged[merged.count - 1].end = max(last.end, span.end)
            } else {
                merged.append(span)
            }
        }
        return merged
    }

    private static func cosineDistance(_ a: [Float], _ b: [Float]) -> Float {
        guard a.count == b.count, !a.isEmpty else { return .infinity }
        var dot: Float = 0
        var magA: Float = 0
        var magB: Float = 0
        for index in 0 ..< a.count {
            dot += a[index] * b[index]
            magA += a[index] * a[index]
            magB += b[index] * b[index]
        }
        let denom = magA.squareRoot() * magB.squareRoot()
        guard denom > 0 else { return .infinity }
        return 1 - min(max(dot / denom, -1), 1)
    }

    private static func normalize(_ vector: [Float]) -> [Float] {
        let mag = magnitude(vector)
        guard mag > 0 else { return vector }
        return vector.map { $0 / mag }
    }

    private static func magnitude(_ vector: [Float]) -> Float {
        sqrt(vector.reduce(0) { $0 + $1 * $1 })
    }

    private static func audioArray(from samples: [Float]) throws -> MLMultiArray {
        let array = try MLMultiArray(shape: [1, 1, NSNumber(value: windowSamples)], dataType: .float32)
        let pointer = array.dataPointer.assumingMemoryBound(to: Float.self)
        let count = min(samples.count, windowSamples)
        if count > 0 {
            samples.withUnsafeBufferPointer { buffer in
                guard let base = buffer.baseAddress else { return }
                pointer.update(from: base, count: count)
            }
        }
        return array
    }

    nonisolated static func mono16k(from url: URL) throws -> [Float] {
        let file = try AVAudioFile(forReading: url)
        let format = file.processingFormat
        let frames = AVAudioFrameCount(file.length)
        guard frames > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames)
        else {
            return []
        }
        try file.read(into: buffer)

        let target = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: Double(sampleRate),
            channels: 1,
            interleaved: false
        )
        guard let target else { return [] }

        if format.sampleRate == Double(sampleRate), format.channelCount == 1,
           let channel = buffer.floatChannelData?.pointee
        {
            return Array(UnsafeBufferPointer(start: channel, count: Int(buffer.frameLength)))
        }

        guard let converter = AVAudioConverter(from: format, to: target) else {
            return []
        }
        let ratio = target.sampleRate / format.sampleRate
        let destFrames = AVAudioFrameCount((Double(buffer.frameLength) * ratio).rounded(.up) + 32)
        guard let destination = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: destFrames) else {
            return []
        }

        var finished = false
        var conversionError: NSError?
        converter.convert(to: destination, error: &conversionError) { _, status in
            if finished {
                status.pointee = .endOfStream
                return nil
            }
            finished = true
            status.pointee = .haveData
            return buffer
        }
        if conversionError != nil {
            return []
        }
        guard let channel = destination.floatChannelData?.pointee else { return [] }
        return Array(UnsafeBufferPointer(start: channel, count: Int(destination.frameLength)))
    }
}

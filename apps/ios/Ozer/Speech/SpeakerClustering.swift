import Foundation

struct DiarizedSpan: Sendable, Equatable {
    var speakerIndex: Int
    var start: TimeInterval
    var end: TimeInterval
}

/// Union-find plus centroid merge so overlapping windows of the same voice
/// collapse, and a meeting cannot invent Speaker 11–18.
enum SpeakerClustering {
    static let maxSpeakers = 6
    static let clusterThreshold: Float = 0.55
    static let mergeThreshold: Float = 0.72

    struct Observation: Equatable, Sendable {
        var embedding: [Float]
        var start: TimeInterval
        var end: TimeInterval
    }

    static func cluster(_ observations: [Observation]) -> [DiarizedSpan] {
        guard !observations.isEmpty else { return [] }
        let items = observations.sorted { lhs, rhs in
            if lhs.start != rhs.start { return lhs.start < rhs.start }
            return lhs.end < rhs.end
        }

        var parent = Array(items.indices)

        func root(_ index: Int) -> Int {
            var current = index
            while parent[current] != current {
                parent[current] = parent[parent[current]]
                current = parent[current]
            }
            return current
        }

        func union(_ a: Int, _ b: Int) {
            let left = root(a)
            let right = root(b)
            guard left != right else { return }
            if left < right {
                parent[right] = left
            } else {
                parent[left] = right
            }
        }

        for i in items.indices {
            for j in (i + 1) ..< items.count {
                if cosineDistance(items[i].embedding, items[j].embedding) <= clusterThreshold {
                    union(i, j)
                }
            }
        }

        func uniqueRoots() -> [Int] {
            Array(Set(items.indices.map { root($0) })).sorted()
        }

        func centroid(for roots: [Int]) -> [Int: [Float]] {
            var sums: [Int: [Float]] = [:]
            var counts: [Int: Float] = [:]
            for (index, item) in items.enumerated() {
                let id = root(index)
                var bucket = sums[id] ?? Array(repeating: 0, count: item.embedding.count)
                if bucket.count != item.embedding.count {
                    bucket = Array(repeating: 0, count: item.embedding.count)
                }
                for dimension in item.embedding.indices where dimension < bucket.count {
                    bucket[dimension] += item.embedding[dimension]
                }
                sums[id] = bucket
                counts[id, default: 0] += 1
            }
            var result: [Int: [Float]] = [:]
            for id in roots {
                let count = max(counts[id] ?? 1, 1)
                result[id] = (sums[id] ?? []).map { $0 / count }
            }
            return result
        }

        while true {
            let roots = uniqueRoots()
            if roots.count <= 1 { break }

            let centers = centroid(for: roots)
            var best = Float.greatestFiniteMagnitude
            var pair: (Int, Int)?
            for i in roots.indices {
                for j in (i + 1) ..< roots.count {
                    let left = roots[i]
                    let right = roots[j]
                    guard let a = centers[left], let b = centers[right] else { continue }
                    let distance = cosineDistance(a, b)
                    if distance < best {
                        best = distance
                        pair = (left, right)
                    }
                }
            }

            guard let pair else { break }
            if best > mergeThreshold, roots.count <= maxSpeakers {
                break
            }
            union(pair.0, pair.1)
        }

        var firstSeen: [Int: Int] = [:]
        var remapped: [Int] = []
        remapped.reserveCapacity(items.count)
        for index in items.indices {
            let id = root(index)
            if firstSeen[id] == nil {
                firstSeen[id] = firstSeen.count
            }
            remapped.append(firstSeen[id] ?? 0)
        }

        var spans = items.enumerated().map { index, item in
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

    static func cosineDistance(_ a: [Float], _ b: [Float]) -> Float {
        guard a.count == b.count, !a.isEmpty else { return .infinity }
        var dot: Float = 0
        var magA: Float = 0
        var magB: Float = 0
        for index in a.indices {
            dot += a[index] * b[index]
            magA += a[index] * a[index]
            magB += b[index] * b[index]
        }
        let denom = magA.squareRoot() * magB.squareRoot()
        guard denom > 0 else { return .infinity }
        return 1 - min(max(dot / denom, -1), 1)
    }
}

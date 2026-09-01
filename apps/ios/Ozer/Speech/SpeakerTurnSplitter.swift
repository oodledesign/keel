import Foundation

struct SpeakerTurn: Codable, Equatable, Hashable, Identifiable {
    var id: String
    var speaker: String
    var text: String
    var start: TimeInterval
    var end: TimeInterval

    init(
        id: String = UUID().uuidString,
        speaker: String,
        text: String,
        start: TimeInterval = 0,
        end: TimeInterval = 0
    ) {
        self.id = id
        self.speaker = speaker
        self.text = text
        self.start = start
        self.end = end
    }
}

struct TimedCaption: Equatable {
    var start: TimeInterval
    var end: TimeInterval
    var text: String
}

/// Live captions stay on Me. Short pauses become paragraphs.
/// Speaker labels come from embeddings after the meeting, not from silence.
struct SpeakerTurnSplitter {
    static let paragraphThreshold: TimeInterval = 2
    static let pauseThreshold: TimeInterval = paragraphThreshold

    private(set) var turns: [SpeakerTurn] = []
    private(set) var captions: [TimedCaption] = []
    private var openText = ""
    private var openStart: TimeInterval?
    private var lastSpeechAt: TimeInterval?
    private var committedSessionText = ""
    private var currentSessionText = ""
    private var carriedText = ""
    private var sessionOrigin: TimeInterval = 0

    var liveText: String {
        openText
    }

    var liveSpeaker: String {
        Self.speakerName(for: 0)
    }

    var formattedBody: String {
        Self.format(turns: turns, liveText: openText, liveSpeaker: liveSpeaker)
    }

    mutating func beginSession(at origin: TimeInterval) {
        sessionOrigin = origin
        committedSessionText = ""
        currentSessionText = ""
        captions.removeAll { $0.start >= origin - 0.05 }
    }

    mutating func ingest(sessionText: String, at time: TimeInterval) {
        let trimmed = sessionText.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return }

        // On-device Speech rewrites the hypothesis and often drops the start ~1 min in.
        // Never shrink committed paragraphs; freeze the peak and treat the short rewrite as new.
        if !currentSessionText.isEmpty, trimmed.count < currentSessionText.count,
           !currentSessionText.hasPrefix(trimmed) {
            commitOpen()
            committedSessionText = ""
            carriedText = ""
            currentSessionText = trimmed
            openStart = time
        } else if trimmed.count >= currentSessionText.count {
            currentSessionText = trimmed
        }

        if let last = lastSpeechAt, time - last >= Self.paragraphThreshold {
            commitOpen()
        }

        let stable = currentSessionText
        let delta: String
        if !committedSessionText.isEmpty, stable.hasPrefix(committedSessionText) {
            delta = String(stable.dropFirst(committedSessionText.count))
                .trimmingCharacters(in: .whitespacesAndNewlines)
        } else {
            delta = stable
        }

        openText = [carriedText, delta]
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        if openStart == nil {
            openStart = time
        }
        lastSpeechAt = time
    }

    mutating func ingestCaptions(_ next: [TimedCaption]) {
        captions.removeAll { $0.start >= sessionOrigin - 0.05 }
        captions.append(contentsOf: next.filter { !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })
        captions.sort { $0.start < $1.start }
    }

    mutating func rollSession() {
        carriedText = openText
        committedSessionText = ""
        currentSessionText = ""
    }

    mutating func commitOpen() {
        let trimmed = openText.trimmingCharacters(in: .whitespacesAndNewlines)
        let start = openStart ?? lastSpeechAt ?? 0
        let end = lastSpeechAt ?? start
        openText = ""
        carriedText = ""
        openStart = nil
        guard !trimmed.isEmpty else { return }
        turns.append(SpeakerTurn(speaker: Self.speakerName(for: 0), text: trimmed, start: start, end: end))
        committedSessionText = currentSessionText
    }

    mutating func finish() -> String {
        commitOpen()
        return Self.format(turns: turns, liveText: "", liveSpeaker: liveSpeaker)
    }

    /// Relabel committed paragraphs. Split a long paragraph across diarization
    /// spans so a speaker change near the end is not swallowed by one Me block.
    mutating func applyDiarization(_ spans: [DiarizedSpan]) {
        commitOpen()
        guard !turns.isEmpty else { return }
        guard !spans.isEmpty else { return }

        var labelled: [SpeakerTurn] = []
        for turn in turns {
            for piece in Self.splitTurn(turn, spans: spans) {
                if let last = labelled.last, last.speaker == piece.speaker {
                    labelled[labelled.count - 1].text = [last.text, piece.text]
                        .filter { !$0.isEmpty }
                        .joined(separator: "\n\n")
                    labelled[labelled.count - 1].end = max(last.end, piece.end)
                } else {
                    labelled.append(piece)
                }
            }
        }
        turns = labelled
    }

    static func splitTurn(_ turn: SpeakerTurn, spans: [DiarizedSpan]) -> [SpeakerTurn] {
        let clipped = spans.compactMap { span -> DiarizedSpan? in
            let start = max(turn.start, span.start)
            let end = min(turn.end, span.end)
            guard end - start > 0.08 else { return nil }
            return DiarizedSpan(speakerIndex: span.speakerIndex, start: start, end: end)
        }
        .sorted { $0.start < $1.start }

        if clipped.count <= 1 {
            var copy = turn
            if let span = clipped.first {
                copy.speaker = speakerName(for: span.speakerIndex)
            } else {
                let caption = TimedCaption(start: turn.start, end: turn.end, text: turn.text)
                copy.speaker = speakerName(for: speakerIndex(for: caption, in: spans))
            }
            return [copy]
        }

        let duration = max(0.001, turn.end - turn.start)
        let chars = Array(turn.text)
        guard !chars.isEmpty else { return [turn] }

        var pieces: [SpeakerTurn] = []
        for span in clipped {
            let i0 = Int(((span.start - turn.start) / duration * Double(chars.count)).rounded(.down))
            let i1 = Int(((span.end - turn.start) / duration * Double(chars.count)).rounded(.up))
            let lo = min(max(0, i0), chars.count)
            let hi = min(max(lo, i1), chars.count)
            let text = String(chars[lo..<hi]).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { continue }
            pieces.append(
                SpeakerTurn(speaker: speakerName(for: span.speakerIndex), text: text, start: span.start, end: span.end)
            )
        }
        return pieces.isEmpty ? [turn] : pieces
    }

    static func speakerName(for index: Int) -> String {
        if index <= 0 { return "Me" }
        return "Speaker \(index)"
    }

    static func speakerIndex(for caption: TimedCaption, in spans: [DiarizedSpan]) -> Int {
        var bestIndex = 0
        var bestOverlap: TimeInterval = -1
        for span in spans {
            let start = max(caption.start, span.start)
            let end = min(caption.end, span.end)
            let overlap = end - start
            if overlap > bestOverlap {
                bestOverlap = overlap
                bestIndex = span.speakerIndex
            }
        }
        if bestOverlap > 0 {
            return bestIndex
        }
        guard let nearest = spans.min(by: {
            abs(($0.start + $0.end) / 2 - (caption.start + caption.end) / 2)
                < abs(($1.start + $1.end) / 2 - (caption.start + caption.end) / 2)
        }) else {
            return 0
        }
        return nearest.speakerIndex
    }

    static func format(turns: [SpeakerTurn], liveText: String, liveSpeaker: String) -> String {
        var blocks: [String] = []
        var currentSpeaker: String?
        var paragraphs: [String] = []

        func flush() {
            guard let speaker = currentSpeaker else { return }
            let body = paragraphs.joined(separator: "\n\n")
            if !body.isEmpty {
                blocks.append("\(speaker)\n\n\(body)")
            }
            paragraphs = []
        }

        for turn in turns {
            let text = turn.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { continue }
            if turn.speaker != currentSpeaker {
                flush()
                currentSpeaker = turn.speaker
            }
            paragraphs.append(text)
        }

        let live = liveText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !live.isEmpty {
            if liveSpeaker != currentSpeaker {
                flush()
                blocks.append("\(liveSpeaker)\n\n\(live)")
            } else {
                paragraphs.append(live)
                flush()
            }
        } else {
            flush()
        }

        return blocks.joined(separator: "\n\n")
    }

    static func title(from body: String, fallback: String) -> String {
        let line = body
            .split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty && $0 != "Me" && !$0.hasPrefix("Speaker ") }
        if let line, !line.isEmpty {
            return String(line.prefix(80))
        }
        return fallback
    }
}

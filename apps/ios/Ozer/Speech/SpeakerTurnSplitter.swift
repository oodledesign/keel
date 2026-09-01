import Foundation

struct SpeakerTurn: Codable, Equatable, Hashable, Identifiable {
    var id: String
    var speaker: String
    var text: String

    init(id: String = UUID().uuidString, speaker: String, text: String) {
        self.id = id
        self.speaker = speaker
        self.text = text
    }
}

/// Pause-based labels: first voice is Me, later turns are Speaker 1, Speaker 2…
/// Apple Speech does not give speaker IDs — a ~1.2s gap starts the next label.
/// Later turns never go back to Me.
struct SpeakerTurnSplitter {
    static let pauseThreshold: TimeInterval = 1.2

    private(set) var turns: [SpeakerTurn] = []
    private var openText = ""
    private var lastSpeechAt: TimeInterval?
    private var nextIndex = 0
    private var committedSessionText = ""
    private var currentSessionText = ""
    private var carriedText = ""

    var liveText: String {
        openText
    }

    var liveSpeaker: String {
        Self.speakerName(for: nextIndex)
    }

    var formattedBody: String {
        Self.format(turns: turns, liveText: openText, liveSpeaker: liveSpeaker)
    }

    mutating func ingest(sessionText: String, at time: TimeInterval) {
        let trimmed = sessionText.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return }

        if let last = lastSpeechAt, time - last >= Self.pauseThreshold, !openText.isEmpty {
            commitOpen()
        }

        currentSessionText = trimmed
        let delta: String
        if !committedSessionText.isEmpty, trimmed.hasPrefix(committedSessionText) {
            delta = String(trimmed.dropFirst(committedSessionText.count))
                .trimmingCharacters(in: .whitespacesAndNewlines)
        } else if !committedSessionText.isEmpty {
            committedSessionText = ""
            delta = trimmed
        } else {
            delta = trimmed
        }

        openText = [carriedText, delta]
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        lastSpeechAt = time
    }

    /// Recognition restart: keep the current turn, new formatted strings start empty.
    mutating func rollSession() {
        carriedText = openText
        committedSessionText = ""
        currentSessionText = ""
    }

    mutating func commitOpen() {
        let trimmed = openText.trimmingCharacters(in: .whitespacesAndNewlines)
        openText = ""
        carriedText = ""
        guard !trimmed.isEmpty else { return }
        turns.append(SpeakerTurn(speaker: Self.speakerName(for: nextIndex), text: trimmed))
        nextIndex += 1
        committedSessionText = currentSessionText
    }

    mutating func finish() -> String {
        commitOpen()
        return Self.format(turns: turns, liveText: "", liveSpeaker: liveSpeaker)
    }

    static func speakerName(for index: Int) -> String {
        if index <= 0 { return "Me" }
        return "Speaker \(index)"
    }

    static func format(turns: [SpeakerTurn], liveText: String, liveSpeaker: String) -> String {
        var blocks: [String] = turns.compactMap { turn in
            let text = turn.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return nil }
            return "\(turn.speaker)\n\n\(text)"
        }
        let live = liveText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !live.isEmpty {
            blocks.append("\(liveSpeaker)\n\n\(live)")
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

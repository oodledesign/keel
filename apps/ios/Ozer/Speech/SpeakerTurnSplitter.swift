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

/// Live captions stay on Me. Speaker labels come from embeddings after the
/// meeting. Saved note bodies use ATX H2 labels (`## Me`) so they are headings,
/// not body copy. Pills still use the plain speaker name.
struct SpeakerTurnSplitter {
    static let paragraphThreshold: TimeInterval = 2
    static let pauseThreshold: TimeInterval = paragraphThreshold
    static let liveTurnID = "__live__"
    static let minSpeakerRun: TimeInterval = 1
    static let maxIslandWords = 2

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

    /// Committed paragraphs plus the open live caption, for pill UI.
    var displayTurns: [SpeakerTurn] {
        var result = turns
        let live = openText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !live.isEmpty {
            result.append(
                SpeakerTurn(
                    id: Self.liveTurnID,
                    speaker: liveSpeaker,
                    text: live,
                    start: openStart ?? lastSpeechAt ?? 0,
                    end: lastSpeechAt ?? openStart ?? 0
                )
            )
        }
        return result
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
        // Freeze the peak, then only keep words that are not already in that frozen text.
        let didRewrite = !currentSessionText.isEmpty
            && trimmed.count < currentSessionText.count
            && !currentSessionText.hasPrefix(trimmed)

        if didRewrite {
            commitOpen()
            currentSessionText = trimmed
            if replaceLastTurn(with: trimmed, at: time) {
                committedSessionText = trimmed
                openText = ""
                openStart = nil
                lastSpeechAt = time
                return
            }
            committedSessionText = ""
            applySessionText(trimmed, at: time)
            return
        }

        if trimmed.count >= currentSessionText.count {
            currentSessionText = trimmed
        }

        if let last = lastSpeechAt, time - last >= Self.paragraphThreshold {
            commitOpen()
        }

        applySessionText(currentSessionText, at: time)
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
        if replaceLastTurn(with: trimmed, at: end) {
            committedSessionText = currentSessionText
            return
        }
        if appendToLastTurn(trimmed, at: end) {
            committedSessionText = currentSessionText
            return
        }
        turns.append(SpeakerTurn(speaker: Self.speakerName(for: 0), text: trimmed, start: start, end: end))
        committedSessionText = currentSessionText
    }

    mutating func finish() -> String {
        commitOpen()
        turns = Self.polish(turns)
        return Self.format(turns: turns, liveText: "", liveSpeaker: liveSpeaker)
    }

    /// Relabel committed paragraphs. One speaker per paragraph unless a
    /// sequential change lasts ≥1s on both sides and can split on a word.
    mutating func applyDiarization(_ spans: [DiarizedSpan]) {
        commitOpen()
        guard !turns.isEmpty else { return }
        if !spans.isEmpty {
            turns = turns.flatMap { Self.splitTurn($0, spans: spans) }
        }
        turns = Self.polish(turns)
    }

    static func splitTurn(_ turn: SpeakerTurn, spans: [DiarizedSpan]) -> [SpeakerTurn] {
        let majority = majoritySpeakerIndex(for: turn, in: spans)
        let regions = speakerRegions(for: turn, spans: spans)

        if regions.count <= 1 {
            var copy = turn
            copy.speaker = speakerName(for: regions.first?.speakerIndex ?? majority)
            return [copy]
        }

        let tokens = wordTokens(turn.text)
        guard tokens.count >= 4 else {
            var copy = turn
            copy.speaker = speakerName(for: majority)
            return [copy]
        }

        let duration = max(0.001, turn.end - turn.start)
        var cuts = [0]
        for region in regions.dropLast() {
            let fraction = (region.end - turn.start) / duration
            var index = snapWordIndex(fraction, count: tokens.count)
            index = snapToSentence(index, tokens: tokens)
            if let last = cuts.last, index > last, index < tokens.count {
                cuts.append(index)
            }
        }
        cuts.append(tokens.count)

        if cuts.count <= 2 {
            var copy = turn
            copy.speaker = speakerName(for: majority)
            return [copy]
        }

        var pieces: [SpeakerTurn] = []
        for index in 0 ..< (cuts.count - 1) {
            let slice = tokens[cuts[index] ..< cuts[index + 1]]
            let text = slice.map(\.text).joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { continue }
            let startFraction = Double(cuts[index]) / Double(tokens.count)
            let endFraction = Double(cuts[index + 1]) / Double(tokens.count)
            let start = turn.start + startFraction * duration
            let end = turn.start + endFraction * duration
            let mid = (start + end) / 2
            let speaker = regions.first { $0.start <= mid && mid < $0.end }?.speakerIndex
                ?? regions.last?.speakerIndex
                ?? majority
            pieces.append(
                SpeakerTurn(
                    id: index == 0 ? turn.id : UUID().uuidString,
                    speaker: speakerName(for: speaker),
                    text: text,
                    start: start,
                    end: end
                )
            )
        }
        return pieces.isEmpty ? [labelled(turn, speaker: majority)] : pieces
    }

    static func majoritySpeakerIndex(for turn: SpeakerTurn, in spans: [DiarizedSpan]) -> Int {
        var totals: [Int: TimeInterval] = [:]
        for span in spans {
            let start = max(turn.start, span.start)
            let end = min(turn.end, span.end)
            let overlap = end - start
            if overlap > 0 {
                totals[span.speakerIndex, default: 0] += overlap
            }
        }
        if let best = totals.max(by: { $0.value < $1.value }) {
            return best.key
        }
        let caption = TimedCaption(start: turn.start, end: turn.end, text: turn.text)
        return speakerIndex(for: caption, in: spans)
    }

    static func speakerName(for index: Int) -> String {
        if index <= 0 { return "Me" }
        return "Speaker \(index)"
    }

    static func speakerHeading(for name: String) -> String {
        "## \(name)"
    }

    static func speakerIndex(from name: String) -> Int {
        let canonical = canonicalSpeakerName(from: name) ?? name.trimmingCharacters(in: .whitespacesAndNewlines)
        if canonical == "Me" { return 0 }
        if canonical == "Them" { return 1 }
        if canonical.hasPrefix("Speaker ") {
            let rest = canonical.dropFirst("Speaker ".count)
            if let value = Int(rest) {
                return value
            }
        }
        return 0
    }

    /// True when incoming is the same hypothesis: prefix/suffix either way,
    /// first ~12 words, or high word overlap. Also treats a later Speech
    /// rewrite that swaps a word or adds a clause as the same pass.
    static func isRedundant(_ incoming: String, after existing: String) -> Bool {
        let next = compacted(incoming)
        let prev = compacted(existing)
        if next.isEmpty { return true }
        if prev.isEmpty { return false }
        if prev == next { return true }
        if prev.hasPrefix(next) || next.hasPrefix(prev) { return true }
        if prev.hasSuffix(next) || next.hasSuffix(prev) { return true }
        if prev.contains(next), next.count >= 16 { return true }
        if next.contains(prev), prev.count >= 16 { return true }

        let prevWords = words(prev)
        let nextWords = words(next)
        let prefixCount = min(12, prevWords.count, nextWords.count)
        if prefixCount >= 8, tokensMatch(prevWords.prefix(prefixCount), nextWords.prefix(prefixCount)) {
            return true
        }

        let overlap = max(wordOverlapCount(prev, next), fuzzyWordOverlapCount(prevWords, nextWords))
        // Incoming is entirely a tail of the last paragraph — a repeat, not new speech.
        if overlap >= 2, overlap == nextWords.count { return true }
        if prevWords.count >= 4, nextWords.count >= 4 {
            if jaccard(prevWords, nextWords) >= 0.58 { return true }
            if fuzzyOverlapRatio(prevWords, nextWords) >= 0.70 { return true }
        }
        return false
    }

    /// Near-duplicate Speech hypotheses, including a later pass that adds a
    /// clause or swaps a word (`reference` / `reverence`).
    static func isRelatedHypothesis(_ incoming: String, after existing: String) -> Bool {
        if isRedundant(incoming, after: existing) { return true }
        let prev = words(compacted(existing))
        let next = words(compacted(incoming))
        if prev.isEmpty || next.isEmpty { return false }
        let overlap = max(
            wordOverlapCount(compacted(existing), compacted(incoming)),
            fuzzyWordOverlapCount(prev, next)
        )
        let smaller = min(prev.count, next.count)
        if overlap >= 3, overlap * 2 >= smaller { return true }
        let shared = Double(fuzzyOverlapCount(prev, next))
        if smaller >= 4, shared / Double(smaller) >= 0.68 { return true }
        return jaccard(prev, next) >= 0.32 || fuzzyOverlapRatio(prev, next) >= 0.52
    }

    static func shouldGrow(_ existing: String, into incoming: String) -> Bool {
        let prev = compacted(existing)
        let next = compacted(incoming)
        if next.count <= prev.count { return false }
        if !isRedundant(incoming, after: existing) { return false }
        let extraWords = words(next).count - words(prev).count
        if next.hasPrefix(prev), extraWords > 12 {
            return jaccard(words(prev), words(next)) >= 0.75
        }
        return true
    }

    static func novelPortion(_ incoming: String, after frozen: String) -> String {
        let next = compacted(incoming)
        let prev = compacted(frozen)
        if next.isEmpty { return "" }
        if prev.isEmpty { return incoming.trimmingCharacters(in: .whitespacesAndNewlines) }
        if isRedundant(incoming, after: frozen), next.count <= prev.count {
            return ""
        }

        let incomingWords = wordTokens(incoming)
        let frozenWords = words(prev)
        let nextWords = incomingWords.map(\.text).map { $0.lowercased() }

        if let start = index(of: frozenWords, in: nextWords) {
            let tail = incomingWords.dropFirst(start + frozenWords.count)
            return tail.map(\.text).joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        }

        let overlap = max(
            wordOverlapCount(prev, next),
            fuzzyWordOverlapCount(frozenWords, nextWords)
        )
        if overlap >= 2 {
            return incomingWords.dropFirst(overlap).map(\.text).joined(separator: " ")
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }

        if isRedundant(incoming, after: frozen) {
            return ""
        }
        return incoming.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func compacted(_ text: String) -> String {
        var chars: [Character] = []
        var lastSpace = false
        for character in text.lowercased() {
            if character.isLetter || character.isNumber {
                chars.append(character)
                lastSpace = false
            } else if !lastSpace {
                chars.append(" ")
                lastSpace = true
            }
        }
        return String(chars).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func wordOverlapCount(_ prev: String, _ next: String) -> Int {
        let left = words(prev)
        let right = words(next)
        let maxLen = min(left.count, right.count)
        guard maxLen > 0 else { return 0 }
        for length in stride(from: maxLen, through: 1, by: -1) {
            if Array(left.suffix(length)) == Array(right.prefix(length)) {
                return length
            }
        }
        return 0
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
        var prepared = polish(turns)
        let live = liveText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !live.isEmpty {
            let liveTurn = SpeakerTurn(
                id: liveTurnID,
                speaker: liveSpeaker,
                text: live,
                start: prepared.last?.end ?? 0,
                end: (prepared.last?.end ?? 0) + 0.1
            )
            prepared = polish(prepared + [liveTurn])
        }

        var blocks: [String] = []
        var currentSpeaker: String?
        var paragraphs: [String] = []

        func flush() {
            guard let speaker = currentSpeaker else { return }
            let body = paragraphs.joined(separator: "\n\n")
            if !body.isEmpty {
                blocks.append("\(speakerHeading(for: speaker))\n\n\(body)")
            }
            paragraphs = []
        }

        for turn in prepared {
            let text = turn.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { continue }
            let speaker = canonicalSpeakerName(from: turn.speaker) ?? turn.speaker
            if speaker != currentSpeaker {
                flush()
                currentSpeaker = speaker
            }
            for part in text.components(separatedBy: "\n\n") {
                let paragraph = part.trimmingCharacters(in: .whitespacesAndNewlines)
                if !paragraph.isEmpty {
                    paragraphs.append(paragraph)
                }
            }
        }
        flush()

        return blocks.joined(separator: "\n\n")
    }

    static func title(from body: String, fallback: String) -> String {
        let line = body
            .split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty && !isSpeakerLabel($0) }
        if let line, !line.isEmpty {
            return String(line.prefix(80))
        }
        return fallback
    }

    static func isSpeakerLabel(_ line: String) -> Bool {
        canonicalSpeakerName(from: line) != nil
    }

    /// `Me`, `Speaker 2`, `Them`, plus markdown `## Me` / `**Me**`.
    static func canonicalSpeakerName(from line: String) -> String? {
        var trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("#") {
            trimmed = String(trimmed.drop(while: { $0 == "#" }))
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if trimmed.hasPrefix("**"), trimmed.hasSuffix("**"), trimmed.count > 4 {
            trimmed = String(trimmed.dropFirst(2).dropLast(2))
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if trimmed == "Me" || trimmed == "Them" { return trimmed }
        if trimmed.hasPrefix("Speaker ") {
            let rest = trimmed.dropFirst("Speaker ".count)
            if !rest.isEmpty, rest.allSatisfy(\.isNumber) {
                return trimmed
            }
        }
        return nil
    }

    /// Fallback for older meetings that only stored the formatted string.
    static func parseTurns(from body: String) -> [SpeakerTurn] {
        let blocks = body
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        var turns: [SpeakerTurn] = []
        var speaker = "Me"
        var paragraphs: [String] = []

        func flush() {
            let text = paragraphs.joined(separator: "\n\n")
            guard !text.isEmpty else { return }
            turns.append(SpeakerTurn(speaker: speaker, text: text))
            paragraphs = []
        }

        for block in blocks {
            if let label = canonicalSpeakerName(from: block) {
                flush()
                speaker = label
            } else if let colon = block.firstIndex(of: ":") {
                let name = String(block[..<colon])
                if let label = canonicalSpeakerName(from: name) {
                    flush()
                    speaker = label
                    let rest = block[block.index(after: colon)...]
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    if !rest.isEmpty {
                        paragraphs.append(rest)
                    }
                } else {
                    paragraphs.append(block)
                }
            } else {
                paragraphs.append(block)
            }
        }
        flush()
        return turns
    }

    private mutating func applySessionText(_ stable: String, at time: TimeInterval) {
        let incoming: String
        if !committedSessionText.isEmpty, stable.hasPrefix(committedSessionText) {
            incoming = String(stable.dropFirst(committedSessionText.count))
                .trimmingCharacters(in: .whitespacesAndNewlines)
        } else if let last = turns.last {
            if growLastTurn(with: stable, at: time) {
                committedSessionText = stable
                lastSpeechAt = time
                return
            }
            if Self.isRedundant(stable, after: last.text) {
                committedSessionText = stable
                openText = carriedText
                lastSpeechAt = time
                return
            }
            incoming = Self.novelPortion(stable, after: last.text)
        } else if !openText.isEmpty, Self.shouldGrow(openText, into: stable) {
            openText = Self.preferredText(existing: openText, incoming: stable)
            if openStart == nil { openStart = time }
            lastSpeechAt = time
            return
        } else if !openText.isEmpty, Self.isRedundant(stable, after: openText) {
            if Self.compacted(stable).count > Self.compacted(openText).count {
                openText = stable
            }
            lastSpeechAt = time
            return
        } else {
            incoming = stable
        }

        if incoming.isEmpty {
            lastSpeechAt = time
            return
        }

        if !openText.isEmpty, Self.shouldGrow(openText, into: incoming) || Self.isRedundant(incoming, after: openText) {
            openText = Self.preferredText(existing: openText, incoming: incoming)
            lastSpeechAt = time
            return
        }

        if growLastTurn(with: incoming, at: time) {
            committedSessionText = stable
            lastSpeechAt = time
            return
        }

        if let last = turns.last, Self.isRedundant(incoming, after: last.text) {
            committedSessionText = stable
            lastSpeechAt = time
            return
        }

        let nextOpen = [carriedText, incoming]
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        if !openText.isEmpty, Self.shouldGrow(openText, into: nextOpen) {
            openText = Self.preferredText(existing: openText, incoming: nextOpen)
        } else {
            openText = nextOpen
        }
        if openStart == nil {
            openStart = time
        }
        lastSpeechAt = time
    }

    @discardableResult
    private mutating func growLastTurn(with text: String, at time: TimeInterval) -> Bool {
        replaceLastTurn(with: text, at: time)
    }

    @discardableResult
    private mutating func replaceLastTurn(with text: String, at time: TimeInterval) -> Bool {
        guard let last = turns.last, last.speaker == liveSpeaker else { return false }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        let related = Self.isRelatedHypothesis(trimmed, after: last.text)
            || Self.isRelatedHypothesis(last.text, after: trimmed)
        guard related || Self.shouldGrow(last.text, into: trimmed) else { return false }
        turns[turns.count - 1].text = Self.combinedHypothesis(existing: last.text, incoming: trimmed)
        turns[turns.count - 1].end = max(last.end, time)
        openText = ""
        openStart = nil
        return true
    }

    @discardableResult
    private mutating func appendToLastTurn(_ text: String, at time: TimeInterval) -> Bool {
        guard let last = turns.last, last.speaker == liveSpeaker else { return false }
        let gap = max(0, time - last.end)
        if Self.shouldStartParagraph(previous: last.text, next: text, gap: gap) {
            return false
        }
        turns[turns.count - 1].text = Self.joinSameSpeaker(previous: last.text, next: text, gap: gap)
        turns[turns.count - 1].end = max(last.end, time)
        openText = ""
        openStart = nil
        return true
    }

    static func polish(_ turns: [SpeakerTurn]) -> [SpeakerTurn] {
        var flattened: [SpeakerTurn] = []
        for turn in turns {
            let speaker = canonicalSpeakerName(from: turn.speaker) ?? turn.speaker
            let parts = turn.text.components(separatedBy: "\n\n")
            for (index, part) in parts.enumerated() {
                let text = part.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !text.isEmpty else { continue }
                let span = max(0.01, turn.end - turn.start)
                let start = turn.start + span * Double(index) / Double(max(parts.count, 1))
                let end = turn.start + span * Double(index + 1) / Double(max(parts.count, 1))
                flattened.append(
                    SpeakerTurn(
                        id: index == 0 ? turn.id : UUID().uuidString,
                        speaker: speaker,
                        text: text,
                        start: start,
                        end: end
                    )
                )
            }
        }

        var result: [SpeakerTurn] = []
        for turn in flattened {
            if let last = result.last {
                let lastParagraph = last.text.components(separatedBy: "\n\n").last ?? last.text
                let related = last.speaker == turn.speaker
                    && (isRelatedHypothesis(turn.text, after: lastParagraph)
                        || isRelatedHypothesis(lastParagraph, after: turn.text))
                if related {
                    result[result.count - 1].text = replaceLastParagraph(
                        of: last.text,
                        with: combinedHypothesis(existing: lastParagraph, incoming: turn.text)
                    )
                    result[result.count - 1].end = max(last.end, turn.end)
                    continue
                }
                // One-word leftovers are not a new speaker, even if labelled as one.
                if isTinyFragment(turn.text) {
                    result[result.count - 1].text = glue(last.text, turn.text)
                    result[result.count - 1].end = max(last.end, turn.end)
                    continue
                }
                if last.speaker == turn.speaker {
                    let gap = max(0, turn.start - last.end)
                    result[result.count - 1].text = joinSameSpeaker(
                        previous: last.text,
                        next: turn.text,
                        gap: gap
                    )
                    result[result.count - 1].end = max(last.end, turn.end)
                    continue
                }
            } else if isTinyFragment(turn.text) {
                result.append(turn)
                continue
            }
            result.append(turn)
        }

        if result.count >= 2, isTinyFragment(result[0].text) {
            result[1].text = glue(result[0].text, result[1].text)
            result[1].start = min(result[0].start, result[1].start)
            result.removeFirst()
        }
        return result
    }

    static func replaceLastParagraph(of existing: String, with incoming: String) -> String {
        let parts = existing.components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        if parts.count <= 1 {
            return incoming.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return (parts.dropLast() + [incoming.trimmingCharacters(in: .whitespacesAndNewlines)])
            .joined(separator: "\n\n")
    }

    static func combinedHypothesis(existing: String, incoming: String) -> String {
        let left = existing.trimmingCharacters(in: .whitespacesAndNewlines)
        let right = incoming.trimmingCharacters(in: .whitespacesAndNewlines)
        if right.isEmpty { return left }
        if left.isEmpty { return right }
        if shouldGrow(left, into: right) {
            return preferredText(existing: left, incoming: right)
        }
        if let replaced = replaceRelatedTail(of: left, with: right) {
            return replaced
        }
        let novel = novelPortion(right, after: left)
        if !novel.isEmpty, compacted(right).count + 8 < compacted(left).count + compacted(novel).count {
            return glue(left, novel)
        }
        return preferredText(existing: left, incoming: right)
    }

    static func replaceRelatedTail(of existing: String, with incoming: String) -> String? {
        let prevTokens = wordTokens(existing)
        let nextWords = words(compacted(incoming))
        guard prevTokens.count > nextWords.count + 2, nextWords.count >= 4 else { return nil }

        let maxLen = min(prevTokens.count, nextWords.count + 4)
        for length in nextWords.count ... maxLen {
            let tailTokens = Array(prevTokens.suffix(length))
            let tail = tailTokens.map(\.text).joined(separator: " ")
            let shared = Double(fuzzyOverlapCount(words(compacted(tail)), nextWords))
            if shared / Double(nextWords.count) >= 0.68 {
                let head = prevTokens.dropLast(length).map(\.text).joined(separator: " ")
                return glue(head, preferredText(existing: tail, incoming: incoming))
            }
        }
        return nil
    }

    static func looksComplete(_ text: String) -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let last = trimmed.last else { return false }
        if ".?!".contains(last) { return true }
        if trimmed.hasSuffix(".\"" ) || trimmed.hasSuffix(".'") || trimmed.hasSuffix("?”") {
            return true
        }
        return false
    }

    static func isTinyFragment(_ text: String) -> Bool {
        let tokens = words(compacted(text))
        if tokens.isEmpty { return true }
        if looksComplete(text) { return false }
        if tokens.count <= maxIslandWords { return true }
        return false
    }

    static func shouldStartParagraph(previous: String, next: String, gap: TimeInterval) -> Bool {
        if isTinyFragment(next) || isTinyFragment(previous) { return false }
        if !looksComplete(previous) { return false }
        return gap >= paragraphThreshold
    }

    static func joinSameSpeaker(previous: String, next: String, gap: TimeInterval) -> String {
        if isRelatedHypothesis(next, after: previous) || isRelatedHypothesis(previous, after: next) {
            return combinedHypothesis(existing: previous, incoming: next)
        }
        if shouldStartParagraph(previous: previous, next: next, gap: gap) {
            return previous.trimmingCharacters(in: .whitespacesAndNewlines)
                + "\n\n"
                + next.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return glue(previous, next)
    }

    static func glue(_ previous: String, _ next: String) -> String {
        let left = previous.trimmingCharacters(in: .whitespacesAndNewlines)
        let right = next.trimmingCharacters(in: .whitespacesAndNewlines)
        if left.isEmpty { return right }
        if right.isEmpty { return left }
        return left + " " + right
    }

    static func preferredText(existing: String, incoming: String) -> String {
        let left = existing.trimmingCharacters(in: .whitespacesAndNewlines)
        let right = incoming.trimmingCharacters(in: .whitespacesAndNewlines)
        let leftCount = compacted(left).count
        let rightCount = compacted(right).count
        if rightCount > leftCount + 2 { return right }
        if leftCount > rightCount + 2 { return left }
        if looksComplete(right) { return right }
        if looksComplete(left) { return left }
        return right.isEmpty ? left : right
    }

    private static func labelled(_ turn: SpeakerTurn, speaker index: Int) -> SpeakerTurn {
        var copy = turn
        copy.speaker = speakerName(for: index)
        return copy
    }

    private struct SpeakerRegion {
        var speakerIndex: Int
        var start: TimeInterval
        var end: TimeInterval
    }

    private struct WordToken {
        var text: String
    }

    private static func speakerRegions(for turn: SpeakerTurn, spans: [DiarizedSpan]) -> [SpeakerRegion] {
        let clipped = spans.compactMap { span -> DiarizedSpan? in
            let start = max(turn.start, span.start)
            let end = min(turn.end, span.end)
            guard end - start > 0.08 else { return nil }
            return DiarizedSpan(speakerIndex: span.speakerIndex, start: start, end: end)
        }
        .sorted { $0.start < $1.start }

        guard !clipped.isEmpty else { return [] }

        var points: Set<TimeInterval> = [turn.start, turn.end]
        for span in clipped {
            if span.start > turn.start, span.start < turn.end {
                points.insert(span.start)
            }
            if span.end > turn.start, span.end < turn.end {
                points.insert(span.end)
            }
        }

        let sorted = points.sorted()
        var raw: [SpeakerRegion] = []
        for index in 0 ..< (sorted.count - 1) {
            let start = sorted[index]
            let end = sorted[index + 1]
            guard end - start > 0.01 else { continue }
            let mid = (start + end) / 2
            let covering = clipped.filter { $0.start <= mid && mid <= $0.end }
            let speaker: Int
            if covering.isEmpty {
                speaker = majoritySpeakerIndex(for: turn, in: spans)
            } else if covering.count == 1 {
                speaker = covering[0].speakerIndex
            } else {
                speaker = majoritySpeakerIndex(for: turn, in: covering)
            }
            if let last = raw.last, last.speakerIndex == speaker {
                raw[raw.count - 1].end = end
            } else {
                raw.append(SpeakerRegion(speakerIndex: speaker, start: start, end: end))
            }
        }
        return absorbShortRegions(raw, minimum: minSpeakerRun)
    }

    private static func absorbShortRegions(_ regions: [SpeakerRegion], minimum: TimeInterval) -> [SpeakerRegion] {
        guard regions.count > 1 else { return regions }
        var result = regions
        var index = 0
        while index < result.count {
            if result[index].end - result[index].start < minimum, result.count > 1 {
                if index == 0 {
                    result[1].start = result[0].start
                    result.remove(at: 0)
                } else {
                    result[index - 1].end = result[index].end
                    result.remove(at: index)
                    index -= 1
                    if index + 1 < result.count, result[index].speakerIndex == result[index + 1].speakerIndex {
                        result[index].end = result[index + 1].end
                        result.remove(at: index + 1)
                    }
                }
            } else {
                index += 1
            }
        }
        return result
    }

    private static func wordTokens(_ text: String) -> [WordToken] {
        text.split(whereSeparator: \.isWhitespace).map { WordToken(text: String($0)) }
    }

    private static func words(_ text: String) -> [String] {
        text.split(whereSeparator: \.isWhitespace).map(String.init)
    }

    private static func snapWordIndex(_ fraction: Double, count: Int) -> Int {
        min(max(0, Int((fraction * Double(count)).rounded())), count)
    }

    private static func snapToSentence(_ index: Int, tokens: [WordToken]) -> Int {
        let endsSentence: (String) -> Bool = { word in
            word.hasSuffix(".") || word.hasSuffix("?") || word.hasSuffix("!")
        }
        for distance in 0 ... 3 {
            let left = index - 1 - distance
            if left >= 0, endsSentence(tokens[left].text) {
                return left + 1
            }
            let right = index - 1 + distance
            if right >= 0, right < tokens.count, endsSentence(tokens[right].text) {
                return right + 1
            }
        }
        return index
    }

    private static func jaccard(_ left: [String], _ right: [String]) -> Double {
        let a = Set(left)
        let b = Set(right)
        if a.isEmpty, b.isEmpty { return 1 }
        let union = a.union(b)
        if union.isEmpty { return 0 }
        return Double(a.intersection(b).count) / Double(union.count)
    }

    private static func index(of needle: [String], in haystack: [String]) -> Int? {
        guard !needle.isEmpty, haystack.count >= needle.count else { return nil }
        for start in 0 ... (haystack.count - needle.count) {
            if Array(haystack[start ..< (start + needle.count)]) == needle {
                return start
            }
        }
        return nil
    }

    private static func tokensMatch<S: Sequence>(_ left: S, _ right: S) -> Bool where S.Element == String {
        zip(left, right).allSatisfy { tokensSimilar($0, $1) }
    }

    private static func tokensSimilar(_ left: String, _ right: String) -> Bool {
        if left == right { return true }
        if left.count >= 4, right.count >= 4 {
            if left.hasPrefix(right) || right.hasPrefix(left) { return true }
            if editDistance(left, right, limit: 2) <= 2 { return true }
        }
        return false
    }

    private static func fuzzyWordOverlapCount(_ prev: [String], _ next: [String]) -> Int {
        let maxLen = min(prev.count, next.count)
        guard maxLen > 0 else { return 0 }
        for length in stride(from: maxLen, through: 1, by: -1) {
            if tokensMatch(prev.suffix(length), next.prefix(length)) {
                return length
            }
        }
        return 0
    }

    private static func fuzzyOverlapCount(_ left: [String], _ right: [String]) -> Int {
        var used = Array(repeating: false, count: right.count)
        var count = 0
        for word in left {
            if let index = right.indices.first(where: { !used[$0] && tokensSimilar(word, right[$0]) }) {
                used[index] = true
                count += 1
            }
        }
        return count
    }

    private static func fuzzyOverlapRatio(_ left: [String], _ right: [String]) -> Double {
        let union = left.count + right.count
        if union == 0 { return 1 }
        let shared = fuzzyOverlapCount(left, right)
        return Double(2 * shared) / Double(union)
    }

    private static func editDistance(_ left: String, _ right: String, limit: Int) -> Int {
        if left == right { return 0 }
        let a = Array(left)
        let b = Array(right)
        if abs(a.count - b.count) > limit { return limit + 1 }
        var previous = Array(0 ... b.count)
        for i in 1 ... a.count {
            var current = [i]
            var rowMin = i
            for j in 1 ... b.count {
                let cost = a[i - 1] == b[j - 1] ? 0 : 1
                let value = min(
                    previous[j] + 1,
                    current[j - 1] + 1,
                    previous[j - 1] + cost
                )
                current.append(value)
                rowMin = min(rowMin, value)
            }
            if rowMin > limit { return limit + 1 }
            previous = current
        }
        return previous[b.count]
    }
}

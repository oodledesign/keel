import Foundation

enum NoteBlockKind: String, Equatable, Sendable {
    case paragraph
    case heading1
    case heading2
    case bullet
}

struct NoteInlineRun: Equatable, Sendable {
    var text: String
    var bold: Bool
    var italic: Bool
    var underline: Bool

    var isBlank: Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

struct NoteBlock: Equatable, Sendable {
    var kind: NoteBlockKind
    var runs: [NoteInlineRun]

    var isBlank: Bool {
        runs.allSatisfy(\.isBlank)
    }

    var plainText: String {
        runs.map(\.text).joined()
    }
}

/// Shared markdown subset with the web TipTap notes editor:
/// bold (`**`), italic (`*`), underline (`<u>`), bullets, H1, H2.
enum NoteMarkdown {
    static func parse(_ markdown: String) -> [NoteBlock] {
        let normalized = markdown.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
        if normalized.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return []
        }

        var blocks: [NoteBlock] = []
        for line in normalized.split(separator: "\n", omittingEmptySubsequences: false) {
            let raw = String(line)
            if raw.trimmingCharacters(in: .whitespaces).isEmpty {
                continue
            }
            // Keep `## Me` / `## Speaker 1` as H2 — do not flatten transcript labels.
            if raw.hasPrefix("## ") {
                blocks.append(
                    NoteBlock(kind: .heading2, runs: parseInlines(String(raw.dropFirst(3))))
                )
            } else if raw.hasPrefix("# ") {
                blocks.append(
                    NoteBlock(kind: .heading1, runs: parseInlines(String(raw.dropFirst(2))))
                )
            } else if let item = bulletItem(raw) {
                blocks.append(NoteBlock(kind: .bullet, runs: parseInlines(item)))
            } else {
                blocks.append(NoteBlock(kind: .paragraph, runs: parseInlines(raw)))
            }
        }
        return blocks
    }

    static func serialize(_ blocks: [NoteBlock]) -> String {
        let meaningful = blocks.filter { !$0.isBlank || $0.kind == .bullet }
        var parts: [String] = []
        for (index, block) in meaningful.enumerated() {
            let inline = serializeInlines(block.runs)
            let line: String
            switch block.kind {
            case .heading1:
                line = "# \(inline)"
            case .heading2:
                line = "## \(inline)"
            case .bullet:
                line = "- \(inline)"
            case .paragraph:
                line = inline
            }
            if index > 0 {
                let previous = meaningful[index - 1]
                if previous.kind == .bullet, block.kind == .bullet {
                    parts.append("\n")
                } else {
                    parts.append("\n\n")
                }
            }
            parts.append(line)
        }
        return parts.joined()
    }

    static func plainText(from markdown: String) -> String {
        parse(markdown)
            .map(\.plainText)
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .joined(separator: "\n")
    }

    static func isBlank(_ markdown: String) -> Bool {
        plainText(from: markdown)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .isEmpty
    }

    static func roundTrip(_ markdown: String) -> String {
        serialize(parse(markdown))
    }

    private static func bulletItem(_ line: String) -> String? {
        var rest = line[...]
        while rest.first == " " {
            rest.removeFirst()
        }
        for prefix in ["- ", "* ", "+ ", "• "] where rest.hasPrefix(prefix) {
            return String(rest.dropFirst(prefix.count))
        }
        return nil
    }

    private static func parseInlines(_ input: String) -> [NoteInlineRun] {
        merge(parseInlines(Array(input), start: 0, end: input.count, marks: Marks()).runs)
    }

    private struct Marks: Equatable {
        var bold = false
        var italic = false
        var underline = false
    }

    private struct InlineParse {
        var runs: [NoteInlineRun]
        var index: Int
    }

    private static func parseInlines(
        _ chars: [Character],
        start: Int,
        end: Int,
        marks: Marks
    ) -> InlineParse {
        var runs: [NoteInlineRun] = []
        var buffer = ""
        var index = start

        func flush() {
            guard !buffer.isEmpty else { return }
            runs.append(
                NoteInlineRun(
                    text: buffer,
                    bold: marks.bold,
                    italic: marks.italic,
                    underline: marks.underline
                )
            )
            buffer = ""
        }

        while index < end {
            if chars[index] == "\\", index + 1 < end {
                buffer.append(chars[index + 1])
                index += 2
                continue
            }

            if match(chars, index: index, end: end, token: "<u>"),
               let close = findToken(chars, token: "</u>", from: index + 3, end: end)
            {
                flush()
                var inner = marks
                inner.underline = true
                let nested = parseInlines(chars, start: index + 3, end: close, marks: inner)
                runs.append(contentsOf: nested.runs)
                index = close + 4
                continue
            }

            if let wrapped = wrap(
                chars,
                index: index,
                end: end,
                delimiter: "***",
                marks: marks,
                apply: { $0.bold = true; $0.italic = true }
            ) {
                flush()
                runs.append(contentsOf: wrapped.runs)
                index = wrapped.index
                continue
            }

            if let wrapped = wrap(
                chars,
                index: index,
                end: end,
                delimiter: "___",
                marks: marks,
                apply: { $0.bold = true; $0.italic = true }
            ) {
                flush()
                runs.append(contentsOf: wrapped.runs)
                index = wrapped.index
                continue
            }

            if let wrapped = wrap(
                chars,
                index: index,
                end: end,
                delimiter: "**",
                marks: marks,
                apply: { $0.bold = true }
            ) {
                flush()
                runs.append(contentsOf: wrapped.runs)
                index = wrapped.index
                continue
            }

            if let wrapped = wrap(
                chars,
                index: index,
                end: end,
                delimiter: "__",
                marks: marks,
                apply: { $0.bold = true }
            ) {
                flush()
                runs.append(contentsOf: wrapped.runs)
                index = wrapped.index
                continue
            }

            if let wrapped = wrap(
                chars,
                index: index,
                end: end,
                delimiter: "*",
                marks: marks,
                apply: { $0.italic = true }
            ) {
                flush()
                runs.append(contentsOf: wrapped.runs)
                index = wrapped.index
                continue
            }

            if canOpenUnderscore(chars, index: index, end: end),
               let wrapped = wrap(
                   chars,
                   index: index,
                   end: end,
                   delimiter: "_",
                   marks: marks,
                   apply: { $0.italic = true }
               )
            {
                flush()
                runs.append(contentsOf: wrapped.runs)
                index = wrapped.index
                continue
            }

            buffer.append(chars[index])
            index += 1
        }

        flush()
        return InlineParse(runs: runs, index: index)
    }

    private static func wrap(
        _ chars: [Character],
        index: Int,
        end: Int,
        delimiter: String,
        marks: Marks,
        apply: (inout Marks) -> Void
    ) -> InlineParse? {
        guard match(chars, index: index, end: end, token: delimiter) else {
            return nil
        }
        let innerStart = index + delimiter.count
        guard let close = findToken(chars, token: delimiter, from: innerStart, end: end),
              close > innerStart
        else {
            return nil
        }
        var inner = marks
        apply(&inner)
        let nested = parseInlines(chars, start: innerStart, end: close, marks: inner)
        return InlineParse(runs: nested.runs, index: close + delimiter.count)
    }

    private static func match(
        _ chars: [Character],
        index: Int,
        end: Int,
        token: String
    ) -> Bool {
        let tokenChars = Array(token)
        guard index + tokenChars.count <= end else { return false }
        for (offset, character) in tokenChars.enumerated() where chars[index + offset] != character {
            return false
        }
        return true
    }

    private static func findToken(
        _ chars: [Character],
        token: String,
        from: Int,
        end: Int
    ) -> Int? {
        let tokenChars = Array(token)
        guard tokenChars.isEmpty == false else { return nil }
        var index = from
        while index + tokenChars.count <= end {
            if chars[index] == "\\" {
                index += 2
                continue
            }
            if match(chars, index: index, end: end, token: token) {
                return index
            }
            index += 1
        }
        return nil
    }

    private static func canOpenUnderscore(_ chars: [Character], index: Int, end: Int) -> Bool {
        guard index < end, chars[index] == "_" else { return false }
        if index > 0, chars[index - 1].isLetter || chars[index - 1].isNumber {
            return false
        }
        return true
    }

    private static func serializeInlines(_ runs: [NoteInlineRun]) -> String {
        merge(runs).map { run in
            var text = escape(run.text)
            if run.bold {
                text = "**\(text)**"
            }
            if run.italic {
                text = "*\(text)*"
            }
            if run.underline {
                text = "<u>\(text)</u>"
            }
            return text
        }.joined()
    }

    private static func escape(_ text: String) -> String {
        var output = ""
        for character in text {
            switch character {
            case "\\", "*", "_", "<":
                output.append("\\")
                output.append(character)
            default:
                output.append(character)
            }
        }
        return output
    }

    private static func merge(_ runs: [NoteInlineRun]) -> [NoteInlineRun] {
        var merged: [NoteInlineRun] = []
        for run in runs {
            if run.text.isEmpty { continue }
            if let last = merged.last,
               last.bold == run.bold,
               last.italic == run.italic,
               last.underline == run.underline
            {
                merged[merged.count - 1].text += run.text
            } else {
                merged.append(run)
            }
        }
        return merged
    }
}

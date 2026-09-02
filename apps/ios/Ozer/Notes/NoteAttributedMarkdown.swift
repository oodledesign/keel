import UIKit

enum NoteAttributedMarkdown {
    static let blockKindKey = NSAttributedString.Key("ozer.note.blockKind")

    static func attributedString(from markdown: String) -> NSAttributedString {
        let blocks = NoteMarkdown.parse(markdown)
        let result = NSMutableAttributedString()
        if blocks.isEmpty {
            result.append(NSAttributedString(string: "", attributes: attributes(kind: .paragraph)))
            return result
        }

        for (index, block) in blocks.enumerated() {
            if index > 0 {
                result.append(
                    NSAttributedString(string: "\n", attributes: attributes(kind: block.kind))
                )
            }
            if block.runs.isEmpty {
                result.append(NSAttributedString(string: "", attributes: attributes(kind: block.kind)))
                continue
            }
            for run in block.runs {
                result.append(
                    NSAttributedString(
                        string: run.text,
                        attributes: attributes(kind: block.kind, run: run)
                    )
                )
            }
        }
        return result
    }

    static func markdown(from attributed: NSAttributedString) -> String {
        let string = attributed.string as NSString
        guard string.length > 0 else { return "" }

        var blocks: [NoteBlock] = []
        var location = 0
        while location < string.length {
            let paragraph = string.paragraphRange(for: NSRange(location: location, length: 0))
            var content = paragraph
            if content.length > 0, string.substring(with: content).hasSuffix("\n") {
                content.length -= 1
            }
            let kind = blockKind(in: attributed, range: content.length > 0 ? content : paragraph)
            var runs: [NoteInlineRun] = []
            if content.length > 0 {
                attributed.enumerateAttributes(in: content, options: []) { attributes, range, _ in
                    let text = string.substring(with: range)
                    guard !text.isEmpty else { return }
                    let font = attributes[.font] as? UIFont
                    let traits = font?.fontDescriptor.symbolicTraits ?? []
                    let underline = (attributes[.underlineStyle] as? Int ?? 0) != 0
                    runs.append(
                        NoteInlineRun(
                            text: text,
                            bold: traits.contains(.traitBold) && kind != .heading1 && kind != .heading2,
                            italic: traits.contains(.traitItalic),
                            underline: underline
                        )
                    )
                }
            }
            blocks.append(NoteBlock(kind: kind, runs: runs))
            location = paragraph.location + paragraph.length
        }
        return NoteMarkdown.serialize(blocks)
    }

    static func attributes(
        kind: NoteBlockKind,
        run: NoteInlineRun = NoteInlineRun(text: "", bold: false, italic: false, underline: false)
    ) -> [NSAttributedString.Key: Any] {
        var values: [NSAttributedString.Key: Any] = [
            .font: font(kind: kind, bold: run.bold, italic: run.italic),
            .foregroundColor: UIColor(OzerPalette.plum),
            .paragraphStyle: paragraphStyle(kind: kind),
            blockKindKey: kind.rawValue,
        ]
        if run.underline {
            values[.underlineStyle] = NSUnderlineStyle.single.rawValue
        }
        return values
    }

    static func font(kind: NoteBlockKind, bold: Bool, italic: Bool) -> UIFont {
        let base: UIFont
        switch kind {
        case .heading1:
            base = UIFont.preferredFont(forTextStyle: .title1)
        case .heading2:
            base = UIFont.preferredFont(forTextStyle: .title2)
        case .paragraph, .bullet:
            base = UIFont.preferredFont(forTextStyle: .body)
        }

        var traits = base.fontDescriptor.symbolicTraits
        if bold || kind == .heading1 || kind == .heading2 {
            traits.insert(.traitBold)
        } else {
            traits.remove(.traitBold)
        }
        if italic {
            traits.insert(.traitItalic)
        } else {
            traits.remove(.traitItalic)
        }
        guard let descriptor = base.fontDescriptor.withSymbolicTraits(traits) else {
            return base
        }
        return UIFont(descriptor: descriptor, size: base.pointSize)
    }

    static func paragraphStyle(kind: NoteBlockKind) -> NSParagraphStyle {
        let style = NSMutableParagraphStyle()
        style.paragraphSpacing = 8
        if kind == .bullet {
            style.textLists = [NSTextList(markerFormat: .disc, options: 0)]
            style.headIndent = 24
            style.firstLineHeadIndent = 24
        }
        return style
    }

    static func blockKind(in attributed: NSAttributedString, range: NSRange) -> NoteBlockKind {
        let probe = range.length > 0 ? range.location : max(0, range.location)
        guard probe < attributed.length else { return .paragraph }
        let attributes = attributed.attributes(at: probe, effectiveRange: nil)
        if let raw = attributes[blockKindKey] as? String, let kind = NoteBlockKind(rawValue: raw) {
            return kind
        }
        if let style = attributes[.paragraphStyle] as? NSParagraphStyle, !style.textLists.isEmpty {
            return .bullet
        }
        if let font = attributes[.font] as? UIFont {
            if font.pointSize >= UIFont.preferredFont(forTextStyle: .title1).pointSize - 0.5 {
                return .heading1
            }
            if font.pointSize >= UIFont.preferredFont(forTextStyle: .title2).pointSize - 0.5 {
                return .heading2
            }
        }
        return .paragraph
    }
}

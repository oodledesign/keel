import Observation
import UIKit

@MainActor
@Observable
final class NoteFormatController {
    var isBold = false
    var isItalic = false
    var isUnderline = false
    var isBullet = false
    var isHeading1 = false
    var isHeading2 = false
    var canUndo = false
    var canRedo = false

    weak var textView: UITextView?

    func attach(_ textView: UITextView) {
        self.textView = textView
        sync(from: textView)
    }

    func sync(from textView: UITextView) {
        let attributes = currentAttributes(in: textView)
        let font = attributes[.font] as? UIFont
        let traits = font?.fontDescriptor.symbolicTraits ?? []
        let kind = NoteAttributedMarkdown.blockKind(in: textView.attributedText, range: selectedParagraph(in: textView))
        let isHeading = kind == .heading1 || kind == .heading2
        isBold = traits.contains(.traitBold) && !isHeading
        isItalic = traits.contains(.traitItalic)
        isUnderline = (attributes[.underlineStyle] as? Int ?? 0) != 0
        isBullet = kind == .bullet
        isHeading1 = kind == .heading1
        isHeading2 = kind == .heading2
        canUndo = textView.undoManager?.canUndo ?? false
        canRedo = textView.undoManager?.canRedo ?? false
    }

    func toggleBold() {
        toggleInline { attributes in
            let font = attributes[.font] as? UIFont ?? NoteAttributedMarkdown.font(kind: .paragraph, bold: false, italic: false)
            let kind = kindFrom(attributes)
            let italic = font.fontDescriptor.symbolicTraits.contains(.traitItalic)
            let bold = font.fontDescriptor.symbolicTraits.contains(.traitBold)
            attributes[.font] = NoteAttributedMarkdown.font(kind: kind, bold: !bold, italic: italic)
        }
    }

    func toggleItalic() {
        toggleInline { attributes in
            let font = attributes[.font] as? UIFont ?? NoteAttributedMarkdown.font(kind: .paragraph, bold: false, italic: false)
            let kind = kindFrom(attributes)
            let italic = font.fontDescriptor.symbolicTraits.contains(.traitItalic)
            let bold = font.fontDescriptor.symbolicTraits.contains(.traitBold)
            attributes[.font] = NoteAttributedMarkdown.font(kind: kind, bold: bold, italic: !italic)
        }
    }

    func toggleUnderline() {
        toggleInline { attributes in
            let current = attributes[.underlineStyle] as? Int ?? 0
            if current == 0 {
                attributes[.underlineStyle] = NSUnderlineStyle.single.rawValue
            } else {
                attributes[.underlineStyle] = 0
            }
        }
    }

    func toggleBullet() {
        applyBlock(isBullet ? .paragraph : .bullet)
    }

    func toggleHeading1() {
        applyBlock(isHeading1 ? .paragraph : .heading1)
    }

    func toggleHeading2() {
        applyBlock(isHeading2 ? .paragraph : .heading2)
    }

    func undo() {
        guard let textView, textView.undoManager?.canUndo == true else { return }
        textView.undoManager?.undo()
        textView.delegate?.textViewDidChange?(textView)
        sync(from: textView)
    }

    func redo() {
        guard let textView, textView.undoManager?.canRedo == true else { return }
        textView.undoManager?.redo()
        textView.delegate?.textViewDidChange?(textView)
        sync(from: textView)
    }

    private func toggleInline(_ mutate: (inout [NSAttributedString.Key: Any]) -> Void) {
        guard let textView else { return }
        textView.becomeFirstResponder()
        let range = textView.selectedRange
        if range.length == 0 {
            var typing = textView.typingAttributes
            mutate(&typing)
            textView.typingAttributes = typing
            sync(from: textView)
            return
        }
        replaceAttributes(in: textView, range: range, mutate: mutate)
    }

    private func applyBlock(_ kind: NoteBlockKind) {
        guard let textView else { return }
        textView.becomeFirstResponder()
        let range = selectedParagraph(in: textView)
        replaceAttributes(in: textView, range: range) { attributes in
            let font = attributes[.font] as? UIFont
            let italic = font?.fontDescriptor.symbolicTraits.contains(.traitItalic) ?? false
            let bold = font?.fontDescriptor.symbolicTraits.contains(.traitBold) ?? false
            let underline = attributes[.underlineStyle] as? Int ?? 0
            attributes = NoteAttributedMarkdown.attributes(
                kind: kind,
                run: NoteInlineRun(
                    text: "",
                    bold: bold && kind == .paragraph || kind == .bullet && bold,
                    italic: italic,
                    underline: underline != 0
                )
            )
        }
        var typing = textView.typingAttributes
        typing.merge(NoteAttributedMarkdown.attributes(kind: kind)) { _, new in new }
        textView.typingAttributes = typing
    }

    private func replaceAttributes(
        in textView: UITextView,
        range: NSRange,
        mutate: (inout [NSAttributedString.Key: Any]) -> Void
    ) {
        guard range.location != NSNotFound else { return }
        let storage = textView.textStorage
        let safeRange = NSIntersectionRange(range, NSRange(location: 0, length: storage.length))
        guard safeRange.length > 0 else {
            var typing = textView.typingAttributes
            mutate(&typing)
            textView.typingAttributes = typing
            sync(from: textView)
            return
        }

        let before = storage.attributedSubstring(from: safeRange)
        storage.beginEditing()
        storage.enumerateAttributes(in: safeRange, options: []) { attributes, runRange, _ in
            var next = attributes
            mutate(&next)
            storage.setAttributes(next, range: runRange)
        }
        storage.endEditing()
        let after = storage.attributedSubstring(from: safeRange)
        registerUndo(in: textView, range: safeRange, previous: before, current: after)
        textView.delegate?.textViewDidChange?(textView)
        sync(from: textView)
    }

    private func registerUndo(
        in textView: UITextView,
        range: NSRange,
        previous: NSAttributedString,
        current: NSAttributedString
    ) {
        guard let undo = textView.undoManager else { return }
        undo.registerUndo(withTarget: textView) { view in
            let storage = view.textStorage
            let replace = NSIntersectionRange(range, NSRange(location: 0, length: storage.length))
            guard replace.length > 0 else { return }
            storage.replaceCharacters(in: replace, with: previous)
            view.selectedRange = replace
        }
        undo.setActionName("Format")
        _ = current
    }

    private func currentAttributes(in textView: UITextView) -> [NSAttributedString.Key: Any] {
        let range = textView.selectedRange
        if range.length == 0 {
            return textView.typingAttributes
        }
        let probe = min(range.location, max(0, textView.attributedText.length - 1))
        guard textView.attributedText.length > 0 else { return textView.typingAttributes }
        return textView.attributedText.attributes(at: probe, effectiveRange: nil)
    }

    private func selectedParagraph(in textView: UITextView) -> NSRange {
        let string = textView.attributedText.string as NSString
        guard string.length > 0 else { return NSRange(location: 0, length: 0) }
        let selection = textView.selectedRange
        let location = min(selection.location, string.length - 1)
        return string.paragraphRange(for: NSRange(location: max(0, location), length: 0))
    }

    private func kindFrom(_ attributes: [NSAttributedString.Key: Any]) -> NoteBlockKind {
        if let raw = attributes[NoteAttributedMarkdown.blockKindKey] as? String,
           let kind = NoteBlockKind(rawValue: raw)
        {
            return kind
        }
        return .paragraph
    }
}

import SwiftUI
import UIKit

struct NoteRichTextEditor: UIViewRepresentable {
    @Binding var markdown: String
    var controller: NoteFormatController

    func makeCoordinator() -> Coordinator {
        Coordinator(markdown: markdown, controller: controller)
    }

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.delegate = context.coordinator
        view.backgroundColor = .clear
        view.textColor = UIColor(OzerPalette.plum)
        view.tintColor = UIColor(OzerPalette.coral)
        view.font = NoteAttributedMarkdown.font(kind: .paragraph, bold: false, italic: false)
        view.allowsEditingTextAttributes = true
        view.keyboardDismissMode = .interactive
        view.alwaysBounceVertical = true
        view.adjustsFontForContentSizeCategory = true
        view.textContainerInset = UIEdgeInsets(top: 8, left: 0, bottom: 28, right: 0)
        view.textContainer.lineFragmentPadding = 0
        view.attributedText = NoteAttributedMarkdown.attributedString(from: markdown)
        view.typingAttributes = NoteAttributedMarkdown.attributes(kind: .paragraph)
        view.accessibilityLabel = "Note"
        context.coordinator.lastMarkdown = markdown
        controller.attach(view)
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        context.coordinator.controller = controller
        context.coordinator.onMarkdownChange = { markdown = $0 }
        if markdown != context.coordinator.lastMarkdown,
           !view.isFirstResponder,
           view.markedTextRange == nil
        {
            let selected = view.selectedRange
            view.attributedText = NoteAttributedMarkdown.attributedString(from: markdown)
            view.selectedRange = NSRange(
                location: min(selected.location, view.attributedText.length),
                length: 0
            )
            context.coordinator.lastMarkdown = markdown
        }
    }

    @MainActor
    final class Coordinator: NSObject, UITextViewDelegate {
        var lastMarkdown: String
        var controller: NoteFormatController
        var onMarkdownChange: ((String) -> Void)?

        init(markdown: String, controller: NoteFormatController) {
            lastMarkdown = markdown
            self.controller = controller
        }

        func textViewDidChange(_ textView: UITextView) {
            let next = NoteAttributedMarkdown.markdown(from: textView.attributedText)
            lastMarkdown = next
            onMarkdownChange?(next)
            controller.sync(from: textView)
        }

        func textViewDidChangeSelection(_ textView: UITextView) {
            controller.sync(from: textView)
        }

        func textView(
            _ textView: UITextView,
            shouldChangeTextIn range: NSRange,
            replacementText text: String
        ) -> Bool {
            if text == "\n" {
                let kind = NoteAttributedMarkdown.blockKind(
                    in: textView.attributedText,
                    range: range
                )
                if kind == .heading1 || kind == .heading2 {
                    textView.typingAttributes = NoteAttributedMarkdown.attributes(kind: .paragraph)
                }
            }
            return true
        }
    }
}

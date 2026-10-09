import SwiftUI
import UIKit

/// Read-only rendering of the same markdown subset as `NoteRichTextEditor`.
struct NoteMarkdownView: UIViewRepresentable {
    var markdown: String

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.isEditable = false
        view.isSelectable = true
        view.isScrollEnabled = false
        view.backgroundColor = .clear
        view.textColor = UIColor(OzerPalette.plum)
        view.tintColor = UIColor(OzerPalette.coral)
        view.adjustsFontForContentSizeCategory = true
        view.textContainerInset = .zero
        view.textContainer.lineFragmentPadding = 0
        view.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        view.setContentHuggingPriority(.required, for: .vertical)
        view.attributedText = NoteAttributedMarkdown.attributedString(from: markdown)
        view.accessibilityLabel = "Note"
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        view.attributedText = NoteAttributedMarkdown.attributedString(from: markdown)
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        guard let width = proposal.width, width > 0, width.isFinite else { return nil }
        let fitted = uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
        return CGSize(width: width, height: ceil(fitted.height))
    }
}

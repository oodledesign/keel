import SwiftUI

struct NoteFormatBar: View {
    var controller: NoteFormatController

    var body: some View {
        HStack(spacing: 2) {
            formatButton(
                systemImage: "arrow.uturn.backward",
                label: "Undo",
                active: false,
                enabled: controller.canUndo,
                action: controller.undo
            )
            formatButton(
                systemImage: "arrow.uturn.forward",
                label: "Redo",
                active: false,
                enabled: controller.canRedo,
                action: controller.redo
            )
            formatButton(
                systemImage: "bold",
                label: "Bold",
                active: controller.isBold,
                action: controller.toggleBold
            )
            formatButton(
                systemImage: "italic",
                label: "Italic",
                active: controller.isItalic,
                action: controller.toggleItalic
            )
            formatButton(
                systemImage: "underline",
                label: "Underline",
                active: controller.isUnderline,
                action: controller.toggleUnderline
            )
            formatButton(
                systemImage: "list.bullet",
                label: "Bullet list",
                active: controller.isBullet,
                action: controller.toggleBullet
            )
            formatButton(
                systemImage: "textformat.size.larger",
                label: "Title",
                active: controller.isHeading1,
                action: controller.toggleHeading1
            )
            formatButton(
                systemImage: "textformat.size",
                label: "Subheading",
                active: controller.isHeading2,
                action: controller.toggleHeading2
            )
        }
        .padding(.horizontal, 10)
        .frame(height: 48)
        .frame(maxWidth: .infinity)
        .background(OzerPalette.cream)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(OzerPalette.border)
                .frame(height: 1)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Formatting")
    }

    private func formatButton(
        systemImage: String,
        label: String,
        active: Bool,
        enabled: Bool = true,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(active ? OzerPalette.coral : OzerPalette.plumMuted)
                .frame(width: 40, height: 40)
                .background(
                    active ? OzerPalette.coral.opacity(0.14) : Color.clear,
                    in: RoundedRectangle(cornerRadius: 10, style: .continuous)
                )
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.35)
        .accessibilityLabel(label)
        .accessibilityAddTraits(active ? .isSelected : [])
    }
}

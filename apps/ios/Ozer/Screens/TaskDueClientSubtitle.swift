import SwiftUI

/// Due date plus client, with coral overdue dates (same density as the web task row).
struct TaskDueClientSubtitle: View {
    var due: String?
    var clientName: String?
    var isOverdue: Bool

    var body: some View {
        let dueText = TaskItem.dueLabel(due)
        let client = clientName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        if let dueText, !client.isEmpty {
            (
                Text(dueText).foregroundColor(isOverdue ? OzerPalette.coral : OzerPalette.plumMuted)
                    + Text(" · ").foregroundColor(OzerPalette.plumSoft)
                    + Text(client).foregroundColor(OzerPalette.plumMuted)
            )
            .font(.subheadline)
            .lineLimit(1)
        } else if let dueText {
            Text(dueText)
                .font(.subheadline)
                .foregroundStyle(isOverdue ? OzerPalette.coral : OzerPalette.plumMuted)
        } else if !client.isEmpty {
            Text(client)
                .font(.subheadline)
                .foregroundStyle(OzerPalette.plumMuted)
                .lineLimit(1)
        }
    }
}

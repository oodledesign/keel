import SwiftUI

/// Colour-coded survey status pill — same mapping as web Recent surveys.
struct SurveyStatusBadge: View {
    var status: String

    var body: some View {
        let presentation = SurveyDisplay.statusPresentation(for: status)
        Text(presentation.label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(foreground(presentation.tone))
            .background(fill(presentation.tone), in: Capsule())
            .overlay {
                Capsule()
                    .stroke(border(presentation.tone), lineWidth: 1)
            }
            .accessibilityLabel(presentation.label)
    }

    private func foreground(_ tone: SurveyStatusTone) -> Color {
        switch tone {
        case .draft:
            return Color(red: 120 / 255.0, green: 88 / 255.0, blue: 24 / 255.0)
        case .inProgress:
            return OzerPalette.info
        case .sent, .approved:
            return Color(red: 5 / 255.0, green: 110 / 255.0, blue: 80 / 255.0)
        case .read:
            return Color(red: 146 / 255.0, green: 96 / 255.0, blue: 16 / 255.0)
        case .declined:
            return Color(red: 167 / 255.0, green: 40 / 255.0, blue: 52 / 255.0)
        case .archived, .unknown:
            return OzerPalette.plumMuted
        }
    }

    private func fill(_ tone: SurveyStatusTone) -> Color {
        switch tone {
        case .draft:
            return Color(red: 240 / 255.0, green: 193 / 255.0, blue: 75 / 255.0).opacity(0.22)
        case .inProgress:
            return OzerPalette.info.opacity(0.14)
        case .sent, .approved:
            return Color(red: 5 / 255.0, green: 150 / 255.0, blue: 105 / 255.0).opacity(0.16)
        case .read:
            return Color(red: 245 / 255.0, green: 158 / 255.0, blue: 11 / 255.0).opacity(0.16)
        case .declined:
            return Color.red.opacity(0.12)
        case .archived, .unknown:
            return OzerPalette.creamDeep
        }
    }

    private func border(_ tone: SurveyStatusTone) -> Color {
        foreground(tone).opacity(0.28)
    }
}

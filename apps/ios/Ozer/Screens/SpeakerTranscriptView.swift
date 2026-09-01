import SwiftUI

/// Speaker change as a small coloured pill, then the paragraph body.
struct SpeakerTranscriptView: View {
    var turns: [SpeakerTurn]
    var emptyMessage: String = "No transcript was captured."

    var body: some View {
        if turns.isEmpty {
            Text(emptyMessage)
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(turns) { turn in
                    SpeakerTurnBlock(turn: turn)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct SpeakerTurnBlock: View {
    var turn: SpeakerTurn

    private var index: Int {
        SpeakerTurnSplitter.speakerIndex(from: turn.speaker)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(turn.speaker)
                .font(.caption.weight(.semibold))
                .foregroundStyle(OzerPalette.creamOnDark)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(OzerPalette.speakerFill(index: index), in: Capsule())
            Text(turn.text)
                .font(.body)
                .foregroundStyle(OzerPalette.plum)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(turn.speaker). \(turn.text)")
    }
}

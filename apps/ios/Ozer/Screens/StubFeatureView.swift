import SwiftUI

enum FeatureStub: String, Hashable, CaseIterable {
    case tasks
    case notes
    case people
    case shopping

    var title: String {
        switch self {
        case .tasks: "Tasks"
        case .notes: "Notes"
        case .people: "People"
        case .shopping: "Shopping"
        }
    }

    var symbol: String {
        switch self {
        case .tasks: "checkmark.square"
        case .notes: "note.text"
        case .people: "person.2"
        case .shopping: "cart"
        }
    }

    var blurb: String {
        switch self {
        case .tasks: "Your lists will live here. This screen is navigation only for now."
        case .notes: "Notes stay on the web for the moment. This is a placeholder."
        case .people: "Friends, family, and catch-ups will land here."
        case .shopping: "Household shopping will open from this tab later."
        }
    }
}

struct StubFeatureView: View {
    let feature: FeatureStub

    var body: some View {
        NavigationStack {
            VStack(spacing: 14) {
                Image(systemName: feature.symbol)
                    .font(.system(size: 28, weight: .medium))
                    .foregroundStyle(OzerPalette.coral)
                Text(feature.title)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                Text(feature.blurb)
                    .font(.body)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .multilineTextAlignment(.center)
            }
            .padding(28)
            .frame(maxWidth: .infinity)
            .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                    .stroke(OzerPalette.border, lineWidth: 1)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 88)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle(feature.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    WorkspaceChip()
                }
            }
        }
    }
}

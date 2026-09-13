import SwiftUI

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

import SwiftUI

struct WorkspaceSwitcherView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(WorkspaceKind.allCases) { kind in
                Button {
                    session.workspace = kind
                    dismiss()
                } label: {
                    HStack(spacing: 14) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(kind.title)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(OzerPalette.plum)
                            Text(kind.subtitle)
                                .font(.footnote)
                                .foregroundStyle(OzerPalette.plumMuted)
                        }
                        Spacer()
                        if session.workspace == kind {
                            Image(systemName: "checkmark")
                                .foregroundStyle(OzerPalette.coral)
                                .fontWeight(.semibold)
                        }
                    }
                    .padding(.vertical, 6)
                }
                .listRowBackground(OzerPalette.panel)
            }
            .scrollContentBackground(.hidden)
            .background(OzerPalette.cream)
            .navigationTitle("Workspace")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(OzerPalette.plumMuted)
                }
            }
        }
        .presentationDragIndicator(.visible)
    }
}

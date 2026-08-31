import SwiftUI

struct MenuView: View {
    @Environment(AppSession.self) private var session
    var onOpen: (AppScreen) -> Void
    var onClose: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section("Workspace") {
                    ForEach(WorkspaceKind.allCases) { kind in
                        Button {
                            session.workspace = kind
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(kind.title)
                                        .foregroundStyle(OzerPalette.plum)
                                    Text(kind.subtitle)
                                        .font(.footnote)
                                        .foregroundStyle(OzerPalette.plumMuted)
                                }
                                Spacer()
                                if session.workspace == kind {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(OzerPalette.coral)
                                }
                            }
                        }
                        .listRowBackground(OzerPalette.panel)
                    }
                }

                Section("More") {
                    ForEach(FeatureStub.allCases, id: \.self) { feature in
                        Button {
                            onOpen(AppScreen(feature: feature))
                        } label: {
                            Label(feature.title, systemImage: feature.symbol)
                                .foregroundStyle(OzerPalette.plum)
                        }
                        .listRowBackground(OzerPalette.panel)
                    }
                }

                Section {
                    Button(role: .destructive) {
                        Task { await session.signOut() }
                    } label: {
                        Text("Sign out")
                    }
                    .listRowBackground(OzerPalette.panel)
                } footer: {
                    Text(session.userEmail ?? "Signed in")
                        .foregroundStyle(OzerPalette.plumSoft)
                }
            }
            .scrollContentBackground(.hidden)
            .background(OzerPalette.cream)
            .navigationTitle("Menu")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close", action: onClose)
                        .foregroundStyle(OzerPalette.plumMuted)
                }
            }
        }
    }
}

import SwiftUI

struct MenuView: View {
    @Environment(AppSession.self) private var session
    var onOpen: (AppScreen) -> Void
    var onClose: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section("Workspace") {
                    if !session.workspacesLoaded && session.workspaces.isEmpty {
                        HStack {
                            ProgressView()
                                .tint(OzerPalette.coral)
                            Text("Loading memberships")
                                .foregroundStyle(OzerPalette.plumMuted)
                        }
                        .listRowBackground(OzerPalette.panel)
                    } else if session.workspaces.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("No workspaces yet")
                                .foregroundStyle(OzerPalette.plum)
                            Text("When your memberships load, they will show here.")
                                .font(.footnote)
                                .foregroundStyle(OzerPalette.plumMuted)
                            Button("Try again") {
                                Task { await session.refreshWorkspaces() }
                            }
                            .foregroundStyle(OzerPalette.coral)
                            .disabled(session.isRefreshingWorkspaces)
                        }
                        .listRowBackground(OzerPalette.panel)
                    } else {
                        ForEach(session.workspaces) { workspace in
                            Button {
                                session.selectWorkspace(workspace)
                            } label: {
                                WorkspaceMembershipRow(
                                    workspace: workspace,
                                    isSelected: session.selectedWorkspace?.id == workspace.id,
                                    emphasizeTitle: false
                                )
                            }
                            .listRowBackground(OzerPalette.panel)
                        }
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
            .task {
                if !session.workspacesLoaded {
                    await session.refreshWorkspaces()
                }
            }
        }
    }
}

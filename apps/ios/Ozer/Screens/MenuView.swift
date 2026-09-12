import SwiftUI

struct MenuView: View {
    @Environment(AppSession.self) private var session
    @State private var showSwitcher = false
    var onOpen: (AppScreen) -> Void
    var onClose: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section("Workspace") {
                    workspacePickerRow
                }

                Section {
                    ForEach(menuScreens, id: \.self) { screen in
                        Button {
                            onOpen(screen)
                        } label: {
                            HStack {
                                Label(screen.title, systemImage: screen.symbol)
                                    .foregroundStyle(OzerPalette.plum)
                                Spacer()
                                if screen == .taskReview, session.pendingTaskReviewCount > 0 {
                                    Text("\(session.pendingTaskReviewCount)")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(Color.white)
                                        .padding(.horizontal, 7)
                                        .padding(.vertical, 2)
                                        .background(OzerPalette.coral, in: Capsule())
                                        .accessibilityLabel("\(session.pendingTaskReviewCount) waiting")
                                }
                            }
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
            .sheet(isPresented: $showSwitcher) {
                WorkspaceSwitcherView()
                    .presentationDetents([.medium, .large])
            }
            .task {
                if !session.workspacesLoaded {
                    await session.refreshWorkspaces()
                }
                await refreshReviewCount()
            }
        }
    }

    private func refreshReviewCount() async {
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            let payload = try await NativeAPIClient().taskReview(
                workspace: workspace,
                accessToken: token
            )
            session.setPendingTaskReviewCount(payload.counts.pendingCount)
        } catch {
            return
        }
    }

    private var menuScreens: [AppScreen] {
        session.selectedWorkspace?.menuScreens ?? [.home, .tasks, .taskReview, .notes, .messages, .shopping]
    }

    @ViewBuilder
    private var workspacePickerRow: some View {
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
            Button {
                showSwitcher = true
            } label: {
                HStack(spacing: 14) {
                    if let workspace = session.selectedWorkspace {
                        WorkspaceLogoView(workspace: workspace, size: 36)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(workspace.displayName)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(OzerPalette.plum)
                            if let subtitle = workspace.profileSubtitle {
                                Text(subtitle)
                                    .font(.footnote)
                                    .foregroundStyle(OzerPalette.plumMuted)
                            }
                        }
                    } else {
                        Text("Choose a workspace")
                            .foregroundStyle(OzerPalette.plum)
                    }
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(OzerPalette.plumMuted)
                }
            }
            .accessibilityLabel("Workspace, \(session.selectedWorkspaceTitle)")
            .listRowBackground(OzerPalette.panel)
        }
    }
}

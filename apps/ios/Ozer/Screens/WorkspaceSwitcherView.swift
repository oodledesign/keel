import SwiftUI

struct WorkspaceSwitcherView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if !session.workspacesLoaded && session.workspaces.isEmpty {
                    ProgressView()
                        .tint(OzerPalette.coral)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if session.workspaces.isEmpty {
                    emptyState
                } else {
                    workspaceList
                }
            }
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
        .task {
            await session.refreshWorkspaces()
        }
    }

    private var workspaceList: some View {
        List(session.workspaces) { workspace in
            Button {
                session.selectWorkspace(workspace)
                dismiss()
            } label: {
                WorkspaceMembershipRow(
                    workspace: workspace,
                    isSelected: session.selectedWorkspace?.id == workspace.id
                )
            }
            .listRowBackground(OzerPalette.panel)
        }
        .scrollContentBackground(.hidden)
        .refreshable {
            await session.refreshWorkspaces()
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Text("No workspaces yet")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("When your memberships load, they will show here.")
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
            Button("Try again") {
                Task { await session.refreshWorkspaces() }
            }
            .buttonStyle(OzerPrimaryButtonStyle())
            .frame(width: 140)
            .disabled(session.isRefreshingWorkspaces)
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct WorkspaceMembershipRow: View {
    let workspace: NativeWorkspace
    var isSelected: Bool
    var emphasizeTitle: Bool = true

    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text(workspace.displayName)
                    .font(emphasizeTitle ? .body.weight(.semibold) : .body)
                    .foregroundStyle(OzerPalette.plum)
                if let subtitle = workspace.profileSubtitle {
                    Text(subtitle)
                        .font(.footnote)
                        .foregroundStyle(OzerPalette.plumMuted)
                }
            }
            Spacer()
            if isSelected {
                Image(systemName: "checkmark")
                    .foregroundStyle(OzerPalette.coral)
                    .fontWeight(.semibold)
            }
        }
        .padding(.vertical, emphasizeTitle ? 6 : 0)
    }
}

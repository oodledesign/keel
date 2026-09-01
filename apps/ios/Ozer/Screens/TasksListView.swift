import SwiftUI

struct TasksListView: View {
    @Environment(AppSession.self) private var session
    @State private var payload: TasksPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false

    private let client = NativeAPIClient()

    /// Chip kind plus resolved slug/id, so we refetch after `/workspaces` lands.
    private var reloadKey: String {
        "\(session.workspace.rawValue)|\(session.workspaceQueryValue)"
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && payload == nil && loadError == nil {
                    ProgressView()
                        .tint(OzerPalette.coral)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let loadError {
                    statusCard(error: loadError)
                } else if let payload, !payload.items.isEmpty {
                    content(payload)
                } else {
                    emptyCard()
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 88)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Tasks")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    WorkspaceChip()
                }
            }
            .task(id: reloadKey) {
                await load()
            }
            .refreshable {
                await load()
            }
        }
    }

    private func content(_ payload: TasksPayload) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(payload.items) { item in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.title)
                            .font(.body.weight(.medium))
                            .foregroundStyle(OzerPalette.plum)
                        if let subtitle = item.displaySubtitle {
                            Text(subtitle)
                                .font(.subheadline)
                                .foregroundStyle(OzerPalette.plumMuted)
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                            .stroke(OzerPalette.border, lineWidth: 1)
                    }
                }
            }
            .padding(.top, 8)
        }
    }

    private func emptyCard() -> some View {
        VStack(spacing: 10) {
            Text("Nothing on this list")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("When there are tasks in this workspace, they will land here.")
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
    }

    private func statusCard(error: NativeAPIError) -> some View {
        VStack(spacing: 12) {
            Text(error == .notFound ? "Tasks aren’t available yet" : "Couldn’t load tasks")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text(error.localizedDescription)
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
            if error != .unauthorized && error != .notFound {
                Button("Try again") {
                    Task { await load() }
                }
                .buttonStyle(OzerPrimaryButtonStyle())
                .frame(width: 140)
            }
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let token = try await session.validAccessToken()
            if session.workspaces.isEmpty {
                await session.refreshWorkspaces()
            }
            payload = try await client.tasks(
                workspace: session.workspaceQueryValue,
                accessToken: token
            )
            loadError = nil
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            payload = nil
            loadError = error
        } catch {
            payload = nil
            loadError = .transport(error.localizedDescription)
        }
    }
}

import SwiftUI

struct HomeTodayView: View {
    @Environment(AppSession.self) private var session
    @State private var payload: TodayPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false

    private let client = NativeAPIClient()

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && payload == nil && loadError == nil {
                    ProgressView()
                        .tint(OzerPalette.coral)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let loadError {
                    statusCard(error: loadError)
                } else if session.workspacesLoaded && session.workspaceQueryValue.isEmpty {
                    membershipsEmptyCard
                } else if let payload, !payload.items.isEmpty {
                    content(payload)
                } else {
                    emptyCard(payload: payload)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 88)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Today")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    WorkspaceChip()
                }
            }
            .task(id: session.workspaceContentKey) {
                await load()
            }
            .refreshable {
                await session.refreshWorkspaces()
                await load()
            }
        }
    }

    private func content(_ payload: TodayPayload) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(payload.headline)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                if let supporting = payload.supportingText {
                    Text(supporting)
                        .font(.body)
                        .foregroundStyle(OzerPalette.plumMuted)
                }
                ForEach(payload.items) { item in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.title)
                            .font(.body.weight(.medium))
                            .foregroundStyle(OzerPalette.plum)
                        if let subtitle = item.subtitle {
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

    private var membershipsEmptyCard: some View {
        VStack(spacing: 12) {
            Text("No workspaces yet")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("When your memberships load, Today will open here.")
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
            Button("Try again") {
                Task {
                    await session.refreshWorkspaces()
                    await load()
                }
            }
            .buttonStyle(OzerPrimaryButtonStyle())
            .frame(width: 140)
            .disabled(session.isRefreshingWorkspaces)
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func emptyCard(payload: TodayPayload?) -> some View {
        VStack(spacing: 10) {
            Text(payload?.headline ?? "Nothing on today")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text(payload?.supportingText ?? "When there is something to do, it will land here.")
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
            Text(error == .notFound ? "Today is on its way" : "Couldn’t load today")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text(error.localizedDescription)
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
            if error == .notFound {
                Text("The native API may still be landing. This workspace is ready when it is.")
                    .font(.footnote)
                    .foregroundStyle(OzerPalette.plumSoft)
                    .multilineTextAlignment(.center)
            } else if error != .unauthorized {
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
            if !session.workspacesLoaded {
                await session.refreshWorkspaces()
            }
            try Task.checkCancellation()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else {
                payload = nil
                loadError = nil
                return
            }
            payload = try await client.today(
                workspace: workspace,
                accessToken: token
            )
            loadError = nil
        } catch is CancellationError {
            return
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            payload = nil
            loadError = error
        } catch {
            if error.isTaskCancellation { return }
            payload = nil
            loadError = .transport(error.localizedDescription)
        }
    }
}

struct WorkspaceChip: View {
    @Environment(AppSession.self) private var session
    @State private var showSwitcher = false

    var body: some View {
        Button {
            showSwitcher = true
        } label: {
            HStack(spacing: 6) {
                if let workspace = session.selectedWorkspace {
                    WorkspaceLogoView(workspace: workspace, size: 22)
                }
                Text(session.selectedWorkspaceTitle)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.caption.weight(.semibold))
            }
            .foregroundStyle(OzerPalette.plum)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(OzerPalette.creamDeep, in: Capsule())
        }
        .accessibilityLabel("Workspace, \(session.selectedWorkspaceTitle)")
        .sheet(isPresented: $showSwitcher) {
            WorkspaceSwitcherView()
                .presentationDetents([.medium, .large])
        }
    }
}

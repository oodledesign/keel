import SwiftUI

struct ClientsListView: View {
    @Environment(AppSession.self) private var session
    @State private var payload: ClientsPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false

    private let client = NativeAPIClient()

    /// Selected account id, or a pending/empty token until `/workspaces` lands.
    private var reloadKey: String {
        session.workspaceContentKey
    }

    private var showsClients: Bool {
        session.selectedWorkspace?.showsClients == true
    }

    var body: some View {
        NavigationStack {
            Group {
                if !showsClients && session.workspacesLoaded {
                    unavailableCard
                } else if isLoading && payload == nil && loadError == nil {
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
                    emptyCard()
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 88)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Clients")
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
                await session.refreshWorkspaces()
                await load()
            }
        }
    }

    private func content(_ payload: ClientsPayload) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(payload.items) { item in
                    NavigationLink {
                        ClientDetailView(client: item)
                    } label: {
                        clientRow(item)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 8)
        }
    }

    private func clientRow(_ item: ClientItem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.displayName)
                .font(.body.weight(.medium))
                .foregroundStyle(OzerPalette.plum)
            if let subtitle = item.displaySubtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .lineLimit(1)
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

    private var unavailableCard: some View {
        VStack(spacing: 10) {
            Text("Clients live on studio workspaces")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("Switch to Oodle, Bracketts, or another business workspace to see clients.")
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

    private var membershipsEmptyCard: some View {
        VStack(spacing: 12) {
            Text("No workspaces yet")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("When your memberships load, clients will land here.")
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

    private func emptyCard() -> some View {
        VStack(spacing: 10) {
            Text("Nothing on this list")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("When there are clients in this workspace, they will land here.")
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
            Text(error == .notFound ? "Clients aren’t available yet" : "Couldn’t load clients")
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
        guard showsClients else {
            payload = nil
            loadError = nil
            return
        }
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
            payload = try await client.clients(
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

struct ClientDetailView: View {
    @Environment(AppSession.self) private var session
    let client: ClientItem

    @State private var tasks: [TaskItem] = []
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var showEditor = false
    @State private var completingIds: Set<String> = []

    private let api = NativeAPIClient()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 16) {
                    Text(client.displayName)
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(OzerPalette.plum)
                    if let email = client.displaySubtitle {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Email")
                                .font(.footnote.weight(.medium))
                                .foregroundStyle(OzerPalette.plumMuted)
                            Text(email)
                                .font(.body)
                                .foregroundStyle(OzerPalette.plum)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                        .stroke(OzerPalette.border, lineWidth: 1)
                }

                HStack {
                    Text("Tasks")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(OzerPalette.plum)
                    Spacer()
                    Button {
                        showEditor = true
                    } label: {
                        Label("Add task", systemImage: "plus")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(OzerPalette.coral)
                    }
                }

                if isLoading && tasks.isEmpty && loadError == nil {
                    ProgressView()
                        .tint(OzerPalette.coral)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                } else if let loadError {
                    Text(loadError.localizedDescription)
                        .font(.body)
                        .foregroundStyle(OzerPalette.plumMuted)
                } else if tasks.isEmpty {
                    Text("No open tasks for this client yet.")
                        .font(.body)
                        .foregroundStyle(OzerPalette.plumMuted)
                } else {
                    ForEach(tasks) { item in
                        HStack(alignment: .top, spacing: 12) {
                            Button {
                                Task { await complete(item) }
                            } label: {
                                Image(systemName: item.isCompleted || completingIds.contains(item.id)
                                      ? "checkmark.circle.fill"
                                      : "circle")
                                    .font(.system(size: 22, weight: .medium))
                                    .foregroundStyle(OzerPalette.coral)
                            }
                            .buttonStyle(.plain)
                            .disabled(item.isCompleted || completingIds.contains(item.id))

                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.title)
                                    .font(.body.weight(.medium))
                                    .foregroundStyle(OzerPalette.plum)
                                    .strikethrough(item.isCompleted || completingIds.contains(item.id))
                                if let subtitle = item.displaySubtitle {
                                    Text(subtitle)
                                        .font(.subheadline)
                                        .foregroundStyle(OzerPalette.plumMuted)
                                }
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
            }
            .padding(.top, 8)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 88)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(OzerPalette.cream.ignoresSafeArea())
        .navigationTitle("Client")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: session.workspaceContentKey) {
            await loadTasks()
        }
        .sheet(isPresented: $showEditor) {
            TaskEditorView(initialClient: client) { _ in
                Task { await loadTasks() }
            }
            .presentationDetents([.medium, .large])
        }
    }

    private func complete(_ item: TaskItem) async {
        completingIds.insert(item.id)
        do {
            let token = try await session.validAccessToken()
            _ = try await api.updateTask(id: item.id, status: "completed", accessToken: token)
            await loadTasks()
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            completingIds.remove(item.id)
            loadError = error
        } catch {
            completingIds.remove(item.id)
            if error.isTaskCancellation { return }
            loadError = .transport(error.localizedDescription)
        }
    }

    private func loadTasks() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else {
                tasks = []
                return
            }
            let payload = try await api.tasks(
                workspace: workspace,
                clientId: client.id,
                accessToken: token
            )
            tasks = payload.items
            completingIds = []
            loadError = nil
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            loadError = error
        } catch {
            if error.isTaskCancellation { return }
            loadError = .transport(error.localizedDescription)
        }
    }
}

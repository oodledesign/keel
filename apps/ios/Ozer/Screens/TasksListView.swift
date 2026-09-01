import SwiftUI

struct TasksListView: View {
    @Environment(AppSession.self) private var session
    @State private var payload: TasksPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var completingIds: Set<String> = []
    @State private var showEditor = false
    @State private var editorTask: TaskItem?
    @State private var searchText = ""
    @State private var dueFilter: TaskDueFilter = .all
    @State private var statusFilter: TaskStatusFilter = .open
    @State private var clientFilter: TaskClientFilter = .all
    @State private var clients: [ClientItem] = []
    @State private var isLoadingClients = false
    @State private var clientsLoadError: NativeAPIError?
    @State private var showClientFilter = false

    private let client = NativeAPIClient()

    /// Selected account id, or a pending/empty token until `/workspaces` lands.
    private var reloadKey: String {
        session.workspaceContentKey
    }

    /// Reload when the workspace, status, or specific client changes.
    private var fetchKey: String {
        "\(reloadKey)|\(statusFilter.rawValue)|\(clientFilter.apiClientId ?? "")"
    }

    private var showsClientFilter: Bool {
        session.selectedWorkspace?.showsClients == true
    }

    private var visibleItems: [TaskItem] {
        guard let items = payload?.items else { return [] }
        return items.filter { item in
            item.matchesSearch(searchText)
                && item.matchesDue(dueFilter)
                && item.matchesClient(clientFilter)
        }
    }

    private var hasActiveFilters: Bool {
        !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || dueFilter != .all
            || statusFilter != .open
            || clientFilter != .all
    }

    private var showsFilterBar: Bool {
        !session.workspaceQueryValue.isEmpty
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if showsFilterBar {
                    filterBar
                }
                Group {
                    if isLoading && payload == nil && loadError == nil {
                        ProgressView()
                            .tint(OzerPalette.coral)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if let loadError {
                        statusCard(error: loadError)
                    } else if session.workspacesLoaded && session.workspaceQueryValue.isEmpty {
                        membershipsEmptyCard
                    } else if !visibleItems.isEmpty {
                        content(visibleItems)
                    } else {
                        emptyCard()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 88)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Tasks")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $searchText, prompt: "Search tasks")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    WorkspaceChip()
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        editorTask = nil
                        showEditor = true
                    } label: {
                        Image(systemName: "plus")
                            .fontWeight(.semibold)
                    }
                    .foregroundStyle(OzerPalette.coral)
                    .accessibilityLabel("Add task")
                    .disabled(session.workspaceQueryValue.isEmpty)
                }
            }
            .onChange(of: session.workspaceContentKey) { _, _ in
                resetFilters(clearClients: true)
            }
            .task(id: fetchKey) {
                await load()
            }
            .task(id: reloadKey) {
                await loadClients()
            }
            .refreshable {
                await session.refreshWorkspaces()
                await load()
                await loadClients()
            }
            .sheet(isPresented: $showEditor) {
                TaskEditorView(
                    existing: editorTask,
                    initialClient: editorTask.flatMap { task in
                        task.clientId.map { ClientItem(id: $0, name: task.clientName ?? "Client") }
                    },
                    onSaved: { _ in
                        Task { await load() }
                    }
                )
                .presentationDetents([.medium, .large])
            }
            .sheet(isPresented: $showClientFilter) {
                TaskClientFilterSheet(
                    initialClients: clients,
                    initialError: clientsLoadError,
                    selection: clientFilter,
                    onSelect: { clientFilter = $0 }
                )
                .presentationDetents([.medium, .large])
            }
            .onChange(of: showClientFilter) { _, presented in
                if presented, clients.isEmpty, !isLoadingClients {
                    Task { await loadClients() }
                }
            }
        }
    }

    private var filterBar: some View {
        VStack(alignment: .leading, spacing: 10) {
            chipRow(TaskDueFilter.allCases, selection: dueFilter) { dueFilter = $0 }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(TaskStatusFilter.allCases) { item in
                        TaskFilterChip(
                            title: item.label,
                            isSelected: item == statusFilter
                        ) {
                            statusFilter = item
                        }
                    }
                    if showsClientFilter {
                        TaskFilterChip(
                            title: clientFilter.label,
                            isSelected: clientFilter != .all
                        ) {
                            showClientFilter = true
                        }
                        .accessibilityLabel("Client filter, \(clientFilter.label)")
                    }
                }
            }
        }
        .padding(.top, 8)
        .padding(.bottom, 12)
    }

    private func chipRow<Item: TaskFilterChipItem>(
        _ items: [Item],
        selection: Item,
        set: @escaping (Item) -> Void
    ) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(items) { item in
                    TaskFilterChip(
                        title: item.label,
                        isSelected: item == selection
                    ) {
                        set(item)
                    }
                }
            }
        }
    }

    private func content(_ items: [TaskItem]) -> some View {
        List {
            ForEach(items) { item in
                Button {
                    editorTask = item
                    showEditor = true
                } label: {
                    taskRow(item)
                }
                .buttonStyle(.plain)
                .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 6, trailing: 0))
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    if !item.isCompleted {
                        Button {
                            Task { await complete(item) }
                        } label: {
                            Label("Done", systemImage: "checkmark")
                        }
                        .tint(OzerPalette.coral)
                    }
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }

    private func taskRow(_ item: TaskItem) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Button {
                Task { await complete(item) }
            } label: {
                Image(systemName: item.isCompleted || completingIds.contains(item.id)
                      ? "checkmark.circle.fill"
                      : "circle")
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(
                        item.isCompleted || completingIds.contains(item.id)
                            ? OzerPalette.coral
                            : OzerPalette.plumMuted
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel(item.isCompleted ? "Completed" : "Mark complete")
            .disabled(item.isCompleted || completingIds.contains(item.id))

            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(OzerPalette.plum)
                    .strikethrough(item.isCompleted || completingIds.contains(item.id))
                TaskDueClientSubtitle(
                    item: item,
                    treatAsCompleted: completingIds.contains(item.id)
                )
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
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
            Text("When your memberships load, tasks will land here.")
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
            if hasActiveFilters {
                Text("Nothing matches")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                Text("Nothing matches these filters. Clear them to see the full list.")
                    .font(.body)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .multilineTextAlignment(.center)
                Button("Clear filters") {
                    resetFilters(clearClients: false)
                }
                .buttonStyle(OzerPrimaryButtonStyle())
                .frame(width: 160)
                .padding(.top, 4)
            } else {
                Text("Nothing on this list")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                Text("When there are tasks in this workspace, they will land here.")
                    .font(.body)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .multilineTextAlignment(.center)
                Button("Add a task") {
                    editorTask = nil
                    showEditor = true
                }
                .buttonStyle(OzerPrimaryButtonStyle())
                .frame(width: 160)
                .padding(.top, 4)
                .disabled(session.workspaceQueryValue.isEmpty)
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

    private func resetFilters(clearClients: Bool) {
        searchText = ""
        dueFilter = .all
        statusFilter = .open
        clientFilter = .all
        if clearClients {
            clients = []
            clientsLoadError = nil
            isLoadingClients = false
        }
    }

    private func complete(_ item: TaskItem) async {
        completingIds.insert(item.id)
        do {
            let token = try await session.validAccessToken()
            _ = try await client.updateTask(
                id: item.id,
                status: "completed",
                accessToken: token
            )
            await load()
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

    private func loadClients() async {
        guard showsClientFilter else {
            clients = []
            clientsLoadError = nil
            isLoadingClients = false
            return
        }
        isLoadingClients = true
        defer { isLoadingClients = false }
        do {
            let token = try await session.validAccessToken()
            if !session.workspacesLoaded {
                await session.refreshWorkspaces()
            }
            try Task.checkCancellation()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else {
                clients = []
                clientsLoadError = nil
                return
            }
            let payload = try await client.clients(workspace: workspace, accessToken: token)
            clients = payload.items
            clientsLoadError = nil
        } catch is CancellationError {
            return
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            if clients.isEmpty {
                clientsLoadError = error
            }
        } catch {
            if error.isTaskCancellation { return }
            if clients.isEmpty {
                clientsLoadError = .transport(error.localizedDescription)
            }
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
            payload = try await client.tasks(
                workspace: workspace,
                clientId: clientFilter.apiClientId,
                status: statusFilter.queryValue,
                accessToken: token
            )
            completingIds = []
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

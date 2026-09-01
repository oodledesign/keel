import SwiftUI

struct TasksListView: View {
    @Environment(AppSession.self) private var session
    @State private var payload: TasksPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var completingIds: Set<String> = []
    @State private var showEditor = false
    @State private var editorTask: TaskItem?

    private let client = NativeAPIClient()

    /// Selected account id, or a pending/empty token until `/workspaces` lands.
    private var reloadKey: String {
        session.workspaceContentKey
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
            .navigationTitle("Tasks")
            .navigationBarTitleDisplayMode(.inline)
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
            .task(id: reloadKey) {
                await load()
            }
            .refreshable {
                await session.refreshWorkspaces()
                await load()
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
        }
    }

    private func content(_ payload: TasksPayload) -> some View {
        List {
            ForEach(payload.items) { item in
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
                if let subtitle = item.displaySubtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.plumMuted)
                }
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

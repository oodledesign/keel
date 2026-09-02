import SwiftUI

struct TaskEditorView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss

    var existing: TaskItem?
    var initialClient: ClientItem?
    var onSaved: (TaskItem) -> Void

    @State private var title: String
    @State private var hasDue: Bool
    @State private var dueDate: Date
    @State private var selectedClientId: String?
    @State private var clients: [ClientItem] = []
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let api = NativeAPIClient()

    init(
        existing: TaskItem? = nil,
        initialClient: ClientItem? = nil,
        onSaved: @escaping (TaskItem) -> Void
    ) {
        self.existing = existing
        self.initialClient = initialClient
        self.onSaved = onSaved
        _title = State(initialValue: existing?.title ?? "")
        _hasDue = State(initialValue: existing?.due != nil)
        _dueDate = State(initialValue: TaskItem.dueDate(from: existing?.due) ?? Date())
        _selectedClientId = State(initialValue: existing?.clientId ?? initialClient?.id)
    }

    private var showsClientPicker: Bool {
        session.selectedWorkspace?.showsClients == true
    }

    private var trimmedTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Title", text: $title, axis: .vertical)
                        .foregroundStyle(OzerPalette.plum)
                }

                Section {
                    Toggle("Due date", isOn: $hasDue)
                        .tint(OzerPalette.coral)
                    if hasDue {
                        DatePicker(
                            "Due",
                            selection: $dueDate,
                            displayedComponents: .date
                        )
                        .datePickerStyle(.compact)
                        .tint(OzerPalette.coral)
                    }
                }

                if showsClientPicker {
                    Section("Client") {
                        Picker("Client", selection: $selectedClientId) {
                            Text("None").tag(nil as String?)
                            ForEach(clients) { client in
                                Text(client.displayName).tag(client.id as String?)
                            }
                        }
                        .tint(OzerPalette.plum)
                    }
                }

                if existing != nil {
                    Section {
                        Button {
                            Task { await save(markComplete: true) }
                        } label: {
                            Label("Mark complete", systemImage: "checkmark.circle")
                                .foregroundStyle(OzerPalette.coral)
                        }
                        .disabled(isSaving || existing?.isCompleted == true)
                    }
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(OzerPalette.coral)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(OzerPalette.cream)
            .navigationTitle(existing == nil ? "New task" : "Edit task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(OzerPalette.plumMuted)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(existing == nil ? "Add" : "Save") {
                        Task { await save(markComplete: false) }
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(OzerPalette.coral)
                    .disabled(isSaving || trimmedTitle.isEmpty)
                }
            }
            .task {
                await loadClients()
            }
        }
    }

    private func loadClients() async {
        guard showsClientPicker else { return }
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            let payload = try await api.clients(workspace: workspace, accessToken: token)
            clients = payload.items
            if let initialClient,
               !clients.contains(where: { $0.id == initialClient.id }) {
                clients.insert(initialClient, at: 0)
            } else if let existing,
                      let id = existing.clientId,
                      !clients.contains(where: { $0.id == id }) {
                clients.insert(
                    ClientItem(id: id, name: existing.clientName ?? "Client"),
                    at: 0
                )
            }
        } catch let error as NativeAPIError where error == .unauthorized {
            await session.handleUnauthorized()
        } catch {
            // Picker stays empty; the task can still be saved without a client.
        }
    }

    private func save(markComplete: Bool) async {
        let nextTitle = trimmedTitle
        guard !nextTitle.isEmpty else { return }
        isSaving = true
        defer { isSaving = false }
        errorMessage = nil
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else {
                errorMessage = "Choose a workspace first."
                return
            }
            let due = hasDue ? TaskItem.dueString(from: dueDate) : nil
            let saved: TaskItem
            if let existing {
                saved = try await api.updateTask(
                    id: existing.id,
                    title: nextTitle,
                    due: due,
                    clearDue: !hasDue && existing.due != nil,
                    clientId: selectedClientId,
                    clearClient: showsClientPicker && selectedClientId == nil && existing.clientId != nil,
                    status: markComplete ? "completed" : nil,
                    accessToken: token
                )
            } else {
                saved = try await api.createTask(
                    title: nextTitle,
                    due: due,
                    clientId: showsClientPicker ? selectedClientId : nil,
                    workspace: workspace,
                    accessToken: token
                )
                if markComplete {
                    _ = try await api.updateTask(
                        id: saved.id,
                        status: "completed",
                        accessToken: token
                    )
                }
            }
            if !markComplete {
                persistCache(saved)
            }
            onSaved(saved)
            dismiss()
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func persistCache(_ task: TaskItem) {
        guard let userId = session.userId,
              let workspaceId = session.selectedWorkspace?.id
        else {
            return
        }
        WorkspaceListCache.upsertTask(
            userId: userId,
            workspaceId: workspaceId,
            task: task
        )
    }
}

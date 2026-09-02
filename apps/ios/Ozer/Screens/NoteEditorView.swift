import SwiftUI

struct NoteEditorView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss

    var existing: NoteItem?
    var categories: [NoteCategory]
    var embedsNavigation: Bool
    var onSaved: (NoteItem) -> Void

    @State private var title: String
    @State private var bodyText: String
    @State private var selectedCategory: String
    @State private var selectedClientId: String?
    @State private var clients: [ClientItem] = []
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let api = NativeAPIClient()

    init(
        existing: NoteItem? = nil,
        categories: [NoteCategory] = [],
        embedsNavigation: Bool = true,
        onSaved: @escaping (NoteItem) -> Void
    ) {
        self.existing = existing
        self.categories = categories
        self.embedsNavigation = embedsNavigation
        self.onSaved = onSaved
        _title = State(initialValue: existing?.title ?? "")
        _bodyText = State(initialValue: existing?.body ?? "")
        let incomingCategory = existing?.category?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        _selectedCategory = State(
            initialValue: incomingCategory.isEmpty ? NoteCategory.defaultSlug : incomingCategory
        )
        _selectedClientId = State(initialValue: existing?.clientId)
    }

    private var showsClientPicker: Bool {
        session.selectedWorkspace?.showsClients == true
    }

    private var pickerCategories: [NoteCategory] {
        NoteCategory.merged(api: categories, current: selectedCategory)
    }

    private var trimmedTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var trimmedBody: String {
        bodyText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var canSave: Bool {
        !isSaving && !trimmedBody.isEmpty && existing?.isPendingSync != true
    }

    var body: some View {
        if embedsNavigation {
            NavigationStack { editor }
        } else {
            editor
        }
    }

    private var editor: some View {
        Form {
                Section {
                    TextField("Title", text: $title, axis: .vertical)
                        .foregroundStyle(OzerPalette.plum)
                    ZStack(alignment: .topLeading) {
                        if bodyText.isEmpty {
                            Text("Write a note…")
                                .foregroundStyle(OzerPalette.plumSoft)
                                .padding(.top, 8)
                                .padding(.leading, 6)
                        }
                        TextEditor(text: $bodyText)
                            .foregroundStyle(OzerPalette.plum)
                            .scrollContentBackground(.hidden)
                            .frame(minHeight: 160)
                            .accessibilityLabel("Note")
                    }
                }

                Section("Category") {
                    Picker("Category", selection: $selectedCategory) {
                        ForEach(pickerCategories) { category in
                            Text(category.label).tag(category.slug)
                        }
                    }
                    .tint(OzerPalette.plum)
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

                if existing?.isPendingSync == true {
                    Section {
                        Text("This note is waiting to sync. You can edit it after it lands on the server.")
                            .foregroundStyle(OzerPalette.plumMuted)
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
            .navigationTitle(existing == nil ? "New note" : "Edit note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(OzerPalette.plumMuted)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(existing == nil ? "Add" : "Save") {
                        Task { await save() }
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(OzerPalette.coral)
                    .disabled(!canSave)
                }
            }
            .task {
                await loadClients()
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
            if let existing,
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
            // Picker stays empty; the note can still be saved without a client.
        }
    }

    private func save() async {
        guard !trimmedBody.isEmpty else {
            errorMessage = "Write a note first."
            return
        }
        if existing?.isPendingSync == true {
            errorMessage = "This note is still waiting to sync."
            return
        }

        isSaving = true
        defer { isSaving = false }
        errorMessage = nil

        let workspace = session.workspaceQueryValue
        guard !workspace.isEmpty else {
            errorMessage = "Choose a workspace first."
            return
        }

        let nextTitle = trimmedTitle.isEmpty
            ? SpeakerTurnSplitter.title(from: trimmedBody, fallback: String(trimmedBody.prefix(80)))
            : trimmedTitle
        let category = selectedCategory
        let clientId = showsClientPicker ? selectedClientId : nil

        if let existing {
            await saveExisting(
                existing,
                title: nextTitle,
                body: trimmedBody,
                category: category,
                clientId: clientId
            )
        } else {
            await saveNew(
                workspace: workspace,
                title: nextTitle,
                body: trimmedBody,
                category: category,
                clientId: clientId
            )
        }
    }

    private func saveNew(
        workspace: String,
        title: String,
        body: String,
        category: String,
        clientId: String?
    ) async {
        let pending = OfflineNoteQueue.shared.enqueue(
            workspace: workspace,
            title: title,
            body: body,
            category: category,
            clientId: clientId
        )
        await session.flushOfflineWork()
        onSaved(pending.asNoteItem())
        dismiss()
    }

    private func saveExisting(
        _ existing: NoteItem,
        title: String,
        body: String,
        category: String,
        clientId: String?
    ) async {
        if !NetworkPathMonitor.shared.isOnline {
            errorMessage = "You’re offline. Edits need a connection."
            return
        }

        do {
            let token = try await session.validAccessToken()
            let saved = try await api.updateNote(
                id: existing.id,
                title: title,
                body: body,
                category: category,
                clientId: clientId,
                clearClient: showsClientPicker && clientId == nil && existing.clientId != nil,
                accessToken: token
            )
            persistCache(saved)
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

    private func persistCache(_ note: NoteItem) {
        guard let userId = session.userId,
              let workspaceId = session.selectedWorkspace?.id
        else {
            return
        }
        WorkspaceListCache.upsertNote(
            userId: userId,
            workspaceId: workspaceId,
            note: note,
            categories: pickerCategories
        )
    }
}

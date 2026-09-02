import SwiftUI

struct NoteEditorView: View {
    @Environment(AppSession.self) private var session
    @Environment(WorkspaceTabBarState.self) private var tabBar
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase

    var existing: NoteItem?
    var categories: [NoteCategory]
    var embedsNavigation: Bool
    var onSaved: (NoteItem) -> Void

    @State private var title: String
    @State private var bodyText: String
    @State private var selectedCategory: String
    @State private var selectedClientId: String?
    @State private var clients: [ClientItem] = []
    @State private var persisted: NoteItem?
    @State private var pendingLocalId: String?
    @State private var isDirty = false
    @State private var isSaving = false
    @State private var saveState: SaveState = .idle
    @State private var errorMessage: String?
    @State private var format = NoteFormatController()
    @State private var autosaveTask: Task<Void, Never>?

    private let api = NativeAPIClient()

    enum SaveState {
        case idle
        case saving
        case saved
        case error
    }

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
        _persisted = State(initialValue: existing?.isPendingSync == true ? nil : existing)
        _pendingLocalId = State(initialValue: existing?.isPendingSync == true ? existing?.id : nil)
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

    private var isBlank: Bool {
        trimmedTitle.isEmpty && NoteMarkdown.isBlank(bodyText)
    }

    private var isNewNote: Bool {
        existing == nil && persisted == nil && pendingLocalId == nil
    }

    private var saveLabel: String {
        switch saveState {
        case .idle:
            isDirty ? "Editing" : " "
        case .saving:
            "Saving…"
        case .saved:
            "Saved"
        case .error:
            "Couldn’t save"
        }
    }

    var body: some View {
        if embedsNavigation {
            NavigationStack { editor }
        } else {
            editor
        }
    }

    private var editor: some View {
        VStack(alignment: .leading, spacing: 0) {
            TextField("Title", text: $title, axis: .vertical)
                .font(.title2.weight(.bold))
                .foregroundStyle(OzerPalette.plum)
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 8)
                .accessibilityLabel("Note title")

            ZStack(alignment: .topLeading) {
                if NoteMarkdown.isBlank(bodyText) {
                    Text("Write a note…")
                        .font(.body)
                        .foregroundStyle(OzerPalette.plumSoft)
                        .padding(.horizontal, 20)
                        .padding(.top, 10)
                        .allowsHitTesting(false)
                }
                NoteRichTextEditor(markdown: $bodyText, controller: format)
                    .padding(.horizontal, 20)
            }

            if existing?.isPendingSync == true {
                Text("This note is waiting to sync. You can edit it after it lands on the server.")
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.coral)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(OzerPalette.cream)
        .navigationTitle(existing == nil ? "New note" : "Edit note")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if embedsNavigation {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        Task { await flushAndDismiss() }
                    }
                    .foregroundStyle(OzerPalette.coral)
                    .fontWeight(.semibold)
                }
            }
            ToolbarItem(placement: .principal) {
                Text(saveLabel)
                    .font(.caption)
                    .foregroundStyle(saveState == .error ? OzerPalette.coral : OzerPalette.plumMuted)
                    .accessibilityAddTraits(.updatesFrequently)
            }
            ToolbarItem(placement: .topBarTrailing) {
                detailsMenu
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            NoteFormatBar(controller: format)
        }
        .task {
            tabBar.isHidden = true
            await loadClients()
        }
        .onDisappear {
            tabBar.isHidden = false
            autosaveTask?.cancel()
            autosaveTask = Task { await persistIfNeeded() }
        }
        .onChange(of: title) { _, _ in markDirtyAndSchedule() }
        .onChange(of: bodyText) { _, _ in markDirtyAndSchedule() }
        .onChange(of: selectedCategory) { _, _ in markDirtyAndSchedule() }
        .onChange(of: selectedClientId) { _, _ in markDirtyAndSchedule() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background || phase == .inactive {
                autosaveTask?.cancel()
                Task { await persistIfNeeded() }
            }
        }
    }

    private var detailsMenu: some View {
        Menu {
            Section("Category") {
                Picker("Category", selection: $selectedCategory) {
                    ForEach(pickerCategories) { category in
                        Text(category.label).tag(category.slug)
                    }
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
                }
            }
        } label: {
            Image(systemName: "ellipsis.circle")
                .foregroundStyle(OzerPalette.plum)
        }
        .accessibilityLabel("Note details")
    }

    private func markDirtyAndSchedule() {
        isDirty = true
        if saveState == .saved {
            saveState = .idle
        }
        scheduleAutosave()
    }

    private func scheduleAutosave() {
        autosaveTask?.cancel()
        autosaveTask = Task {
            try? await Task.sleep(for: .milliseconds(1000))
            guard !Task.isCancelled else { return }
            await persistIfNeeded()
        }
    }

    private func flushAndDismiss() async {
        autosaveTask?.cancel()
        await persistIfNeeded()
        dismiss()
    }

    private func persistIfNeeded() async {
        if existing?.isPendingSync == true {
            return
        }
        if isNewNote && isBlank {
            return
        }
        if !isDirty {
            return
        }
        if isSaving {
            return
        }
        if NoteMarkdown.isBlank(bodyText) && trimmedTitle.isEmpty {
            return
        }

        let snapshotTitle = title
        let snapshotBody = bodyText
        let snapshotCategory = selectedCategory
        let snapshotClientId = selectedClientId

        let bodyToSave: String
        if NoteMarkdown.isBlank(bodyText) {
            bodyToSave = trimmedTitle
        } else {
            bodyToSave = bodyText.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        guard !bodyToSave.isEmpty else { return }

        let nextTitle = trimmedTitle.isEmpty
            ? SpeakerTurnSplitter.title(from: bodyToSave, fallback: String(bodyToSave.prefix(80)))
            : trimmedTitle
        let category = selectedCategory
        let clientId = showsClientPicker ? selectedClientId : nil

        isSaving = true
        saveState = .saving
        defer { isSaving = false }

        let succeeded: Bool
        if let pendingLocalId {
            OfflineNoteQueue.shared.updatePending(
                id: pendingLocalId,
                title: nextTitle,
                body: bodyToSave,
                category: category,
                clientId: clientId
            )
            errorMessage = nil
            if let pending = OfflineNoteQueue.shared.pending.first(where: { $0.id == pendingLocalId }) {
                onSaved(pending.asNoteItem())
            }
            succeeded = true
        } else if let persisted {
            succeeded = await saveExisting(
                persisted,
                title: nextTitle,
                body: bodyToSave,
                category: category,
                clientId: clientId
            )
        } else {
            succeeded = await saveNew(
                title: nextTitle,
                body: bodyToSave,
                category: category,
                clientId: clientId
            )
        }

        if succeeded {
            markCleanIfUnchanged(
                title: snapshotTitle,
                body: snapshotBody,
                category: snapshotCategory,
                clientId: snapshotClientId
            )
            if isDirty {
                scheduleAutosave()
            }
        }
    }

    private func markCleanIfUnchanged(
        title: String,
        body: String,
        category: String,
        clientId: String?
    ) {
        guard self.title == title,
              bodyText == body,
              selectedCategory == category,
              selectedClientId == clientId
        else {
            return
        }
        isDirty = false
        saveState = .saved
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
               !clients.contains(where: { $0.id == id })
            {
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

    private func saveNew(
        title: String,
        body: String,
        category: String,
        clientId: String?
    ) async -> Bool {
        let workspace = session.workspaceQueryValue
        guard !workspace.isEmpty else {
            saveState = .error
            errorMessage = "Choose a workspace first."
            return false
        }

        if !NetworkPathMonitor.shared.isOnline {
            let pending = OfflineNoteQueue.shared.enqueue(
                workspace: workspace,
                title: title,
                body: body,
                category: category,
                clientId: clientId
            )
            pendingLocalId = pending.id
            errorMessage = nil
            onSaved(pending.asNoteItem())
            return true
        }

        do {
            let token = try await session.validAccessToken()
            let saved = try await api.createNote(
                title: title,
                body: body,
                workspace: workspace,
                category: category,
                clientId: clientId,
                accessToken: token
            )
            persisted = saved
            persistCache(saved)
            errorMessage = nil
            onSaved(saved)
            return true
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            saveState = .error
            errorMessage = error.localizedDescription
            return false
        } catch {
            saveState = .error
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func saveExisting(
        _ existing: NoteItem,
        title: String,
        body: String,
        category: String,
        clientId: String?
    ) async -> Bool {
        if !NetworkPathMonitor.shared.isOnline {
            saveState = .error
            errorMessage = "You’re offline. Edits need a connection."
            return false
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
            persisted = saved
            persistCache(saved)
            errorMessage = nil
            onSaved(saved)
            return true
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            saveState = .error
            errorMessage = error.localizedDescription
            return false
        } catch {
            saveState = .error
            errorMessage = error.localizedDescription
            return false
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

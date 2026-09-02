import SwiftUI

struct NotesListView: View {
    @Environment(AppSession.self) private var session
    @State private var payload: NotesPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var showDictation = false
    @State private var showEditor = false
    @State private var isShowingStaleCache = false
    @State private var noteQueue = OfflineNoteQueue.shared

    private let client = NativeAPIClient()

    /// Selected account id, or a pending/empty token until `/workspaces` lands.
    private var reloadKey: String {
        session.workspaceContentKey
    }

    private var displayedItems: [NoteItem] {
        Self.merge(
            pending: noteQueue.pending(for: session.workspaceQueryValue),
            remote: payload?.items ?? []
        )
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && displayedItems.isEmpty && loadError == nil {
                    ProgressView()
                        .tint(OzerPalette.coral)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let loadError, displayedItems.isEmpty {
                    statusCard(error: loadError)
                } else if session.workspacesLoaded && session.workspaceQueryValue.isEmpty {
                    membershipsEmptyCard
                } else if !displayedItems.isEmpty {
                    content(displayedItems)
                } else {
                    emptyCard()
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 88)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Notes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    WorkspaceChip()
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        showEditor = true
                    } label: {
                        Image(systemName: "plus")
                            .fontWeight(.semibold)
                    }
                    .foregroundStyle(OzerPalette.coral)
                    .accessibilityLabel("New note")
                    .disabled(session.workspaceQueryValue.isEmpty)

                    Button {
                        showDictation = true
                    } label: {
                        Image(systemName: "mic")
                    }
                    .foregroundStyle(OzerPalette.coral)
                    .accessibilityLabel("Dictate a note")
                    .disabled(session.workspaceQueryValue.isEmpty)
                }
            }
            .onChange(of: reloadKey) { _, _ in
                payload = nil
                loadError = nil
                isShowingStaleCache = false
                hydrateFromCache()
            }
            .task(id: reloadKey) {
                hydrateFromCache()
                await session.flushOfflineWork()
                await load()
            }
            .refreshable {
                await session.flushOfflineWork()
                await session.refreshWorkspaces()
                await load()
            }
            .sheet(isPresented: $showDictation) {
                DictationSheet { title, body in
                    await saveDictation(title: title, body: body)
                }
            }
            .sheet(isPresented: $showEditor) {
                NoteEditorView(
                    categories: payload?.categories ?? []
                ) { _ in
                    Task { await load() }
                }
                .presentationDetents([.large])
            }
        }
    }

    private func content(_ items: [NoteItem]) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let flushError = noteQueue.lastFlushError {
                    Text(flushError)
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(OzerPalette.creamDeep, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
                }

                if isShowingStaleCache {
                    Text("Showing saved notes. Couldn’t refresh just now.")
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(OzerPalette.creamDeep, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
                }

                ForEach(items) { item in
                    NavigationLink {
                        if item.isPendingSync {
                            NoteDetailView(note: item)
                        } else {
                            NoteEditorView(
                                existing: item,
                                categories: payload?.categories ?? [],
                                embedsNavigation: false
                            ) { _ in
                                Task { await load() }
                            }
                        }
                    } label: {
                        noteRow(item)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 8)
        }
    }

    private func noteRow(_ item: NoteItem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.displayTitle)
                .font(.body.weight(.medium))
                .foregroundStyle(OzerPalette.plum)
            if let subtitle = item.displaySubtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .lineLimit(2)
            }
            if let category = item.categoryLabel(in: payload?.categories ?? []) {
                Text(category)
                    .font(.caption)
                    .foregroundStyle(OzerPalette.plumSoft)
            }
            if item.isPendingSync {
                Text(noteQueue.lastFlushError == nil ? "Waiting to sync" : "Couldn’t sync")
                    .font(.caption)
                    .foregroundStyle(OzerPalette.plumSoft)
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

    private var membershipsEmptyCard: some View {
        VStack(spacing: 12) {
            Text("No workspaces yet")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("When your memberships load, notes will land here.")
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
            Text("When there are notes in this workspace, they will land here. Add one with the plus button, or use the mic to dictate — that works offline.")
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
            Button("New note") {
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
            Text(error == .notFound ? "Notes aren’t available yet" : "Couldn’t load notes")
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

    private func cacheIdentity() -> (userId: String, workspaceId: String)? {
        guard let userId = session.userId,
              let workspaceId = session.selectedWorkspace?.id,
              !workspaceId.isEmpty
        else {
            return nil
        }
        return (userId, workspaceId)
    }

    private func hydrateFromCache() {
        guard let identity = cacheIdentity() else { return }
        let cached = WorkspaceListCache.loadNotes(
            userId: identity.userId,
            workspaceId: identity.workspaceId
        )
        if !cached.items.isEmpty {
            payload = cached
            loadError = nil
        }
    }

    private func persistCache(_ next: NotesPayload) {
        guard let identity = cacheIdentity() else { return }
        WorkspaceListCache.saveNotes(
            userId: identity.userId,
            workspaceId: identity.workspaceId,
            payload: next
        )
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
                isShowingStaleCache = false
                return
            }
            let next = try await client.notes(
                workspace: workspace,
                accessToken: token
            )
            payload = next
            persistCache(next)
            loadError = nil
            isShowingStaleCache = false
        } catch is CancellationError {
            return
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            if displayedItems.isEmpty {
                payload = nil
                loadError = error
                isShowingStaleCache = false
            } else {
                isShowingStaleCache = true
            }
        } catch {
            if error.isTaskCancellation { return }
            if displayedItems.isEmpty {
                payload = nil
                loadError = .transport(error.localizedDescription)
                isShowingStaleCache = false
            } else {
                isShowingStaleCache = true
            }
        }
    }

    private func saveDictation(title: String, body: String) async {
        let workspace = session.workspaceQueryValue
        guard !workspace.isEmpty, !body.isEmpty else { return }
        _ = noteQueue.enqueue(
            workspace: workspace,
            title: title,
            body: body,
            category: NoteCategory.defaultSlug
        )
        await session.flushOfflineWork()
        await load()
    }

    static func merge(pending: [PendingNote], remote: [NoteItem]) -> [NoteItem] {
        pending.map { $0.asNoteItem() } + remote
    }
}

struct NoteDetailView: View {
    let note: NoteItem

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(note.displayTitle)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                if note.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text("This note has no body yet.")
                        .font(.body)
                        .foregroundStyle(OzerPalette.plumMuted)
                } else {
                    Text(note.body)
                        .font(.body)
                        .foregroundStyle(OzerPalette.plum)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                    .stroke(OzerPalette.border, lineWidth: 1)
            }
            .padding(.top, 8)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 88)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(OzerPalette.cream.ignoresSafeArea())
        .navigationTitle("Note")
        .navigationBarTitleDisplayMode(.inline)
    }
}

import SwiftUI

struct MessagesInboxView: View {
    @Environment(AppSession.self) private var session
    @State private var payload: MessageThreadsPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var query = ""
    @State private var path: [String] = []
    @State private var showNewChat = false

    private let client = NativeAPIClient()

    private var reloadKey: String {
        session.workspaceContentKey
    }

    private var threads: [MessageThreadItem] {
        let items = payload?.items ?? []
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return items }
        return items.filter { thread in
            thread.title.lowercased().contains(needle)
                || thread.previewText.lowercased().contains(needle)
                || thread.participants.contains { $0.displayName.lowercased().contains(needle) }
        }
    }

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if isLoading && payload == nil && loadError == nil {
                    ProgressView()
                        .tint(OzerPalette.coral)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let loadError {
                    statusCard(error: loadError)
                } else if session.workspacesLoaded && session.workspaceQueryValue.isEmpty {
                    membershipsEmptyCard
                } else if threads.isEmpty {
                    emptyCard()
                } else {
                    content
                }
            }
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Messages")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    WorkspaceChip()
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showNewChat = true
                    } label: {
                        Image(systemName: "square.and.pencil")
                    }
                    .foregroundStyle(OzerPalette.coral)
                    .accessibilityLabel("New chat")
                }
            }
            .searchable(text: $query, prompt: "Search chats")
            .navigationDestination(for: String.self) { threadId in
                MessageThreadView(
                    threadId: threadId,
                    thread: payload?.items.first(where: { $0.id == threadId })
                )
            }
            .sheet(isPresented: $showNewChat) {
                NewChatView { threadId in
                    showNewChat = false
                    path = [threadId]
                    Task { await load() }
                }
            }
            .task(id: reloadKey) {
                await load()
            }
            .refreshable {
                await session.refreshWorkspaces()
                await load()
            }
            .onChange(of: session.pendingThreadId) { _, id in
                openPendingThread(id)
            }
            .task {
                openPendingThread(session.pendingThreadId)
            }
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(threads) { thread in
                    NavigationLink(value: thread.id) {
                        threadRow(thread)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 88)
        }
    }

    private func threadRow(_ thread: MessageThreadItem) -> some View {
        HStack(alignment: .center, spacing: 12) {
            ZStack {
                Circle()
                    .fill(thread.unreadCount > 0 ? OzerPalette.coral : OzerPalette.creamDeep)
                Text(thread.initials(currentUserId: session.userId))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(thread.unreadCount > 0 ? Color.white : OzerPalette.plum)
            }
            .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(thread.title)
                        .font(.body.weight(thread.unreadCount > 0 ? .semibold : .medium))
                        .foregroundStyle(OzerPalette.plum)
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    if let time = thread.timeLabel {
                        Text(time)
                            .font(.caption)
                            .foregroundStyle(OzerPalette.plumSoft)
                    }
                }
                HStack(alignment: .center, spacing: 8) {
                    Text(thread.previewText)
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .lineLimit(2)
                    Spacer(minLength: 0)
                    if thread.unreadCount > 0 {
                        Text(thread.unreadCount > 99 ? "99+" : "\(thread.unreadCount)")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(Color.white)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(OzerPalette.coral, in: Capsule())
                    }
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

    private var membershipsEmptyCard: some View {
        VStack(spacing: 12) {
            Text("No workspaces yet")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("When your memberships load, chats will land here.")
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
        VStack(spacing: 12) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 28, weight: .medium))
                .foregroundStyle(OzerPalette.coral)
            Text(query.isEmpty ? "No chats yet" : "No matching chats")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text(
                query.isEmpty
                    ? "Start a chat with a teammate, contact, client, or project. Only people you add can see it."
                    : "Try another name."
            )
            .font(.body)
            .foregroundStyle(OzerPalette.plumMuted)
            .multilineTextAlignment(.center)
            if query.isEmpty {
                Button("New chat") {
                    showNewChat = true
                }
                .buttonStyle(OzerPrimaryButtonStyle())
                .frame(width: 160)
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
            Text(error.localizedDescription)
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
            Button("Try again") {
                Task { await load() }
            }
            .buttonStyle(OzerPrimaryButtonStyle())
            .frame(width: 140)
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func openPendingThread(_ id: String?) {
        guard let id, !id.isEmpty else { return }
        path = [id]
        session.clearPendingThread()
    }

    private func load() async {
        let workspace = session.workspaceQueryValue
        guard !workspace.isEmpty else {
            payload = .empty
            loadError = nil
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let token = try await session.validAccessToken()
            payload = try await client.messageThreads(workspace: workspace, accessToken: token)
            loadError = nil
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            loadError = error
        } catch {
            loadError = .transport(error.localizedDescription)
        }
    }
}

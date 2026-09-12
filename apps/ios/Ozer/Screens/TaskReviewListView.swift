import SwiftUI

private enum TaskReviewFilter: String, CaseIterable, Identifiable {
    case all
    case meeting
    case email

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: "All"
        case .meeting: "Meeting"
        case .email: "Email"
        }
    }

    var source: TaskReviewSource? {
        switch self {
        case .all: nil
        case .meeting: .meeting
        case .email: .email
        }
    }
}

struct TaskReviewListView: View {
    @Environment(AppSession.self) private var session

    @State private var payload: TaskReviewPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var filter: TaskReviewFilter = .all
    @State private var pendingIds: Set<String> = []
    @State private var editorItem: TaskReviewItem?
    @State private var actionError: String?

    private let client = NativeAPIClient()

    private var counts: TaskReviewCounts {
        payload?.counts ?? .empty
    }

    private var visibleItems: [TaskReviewItem] {
        let items = payload?.items ?? []
        guard let source = filter.source else { return items }
        return items.filter { $0.source == source }
    }

    private var meetingItems: [TaskReviewItem] {
        visibleItems.filter { $0.source == .meeting }
    }

    private var emailItems: [TaskReviewItem] {
        visibleItems.filter { $0.source == .email }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                filterBar
                Group {
                    if isLoading && payload == nil && loadError == nil {
                        ProgressView()
                            .tint(OzerPalette.coral)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if let loadError {
                        statusCard(error: loadError)
                    } else if session.workspacesLoaded && session.workspaceQueryValue.isEmpty {
                        emptyCard(
                            title: "No workspaces yet",
                            message: "When your memberships load, suggested tasks will land here."
                        )
                    } else if visibleItems.isEmpty {
                        emptyCard(
                            title: "All caught up",
                            message: emptyMessage
                        )
                    } else {
                        content
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Review")
            .navigationBarTitleDisplayMode(.inline)
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
            .sheet(item: $editorItem) { item in
                TaskReviewEditorView(item: item) { draft in
                    guard await accept(item, draft: draft) else {
                        throw NativeAPIError.badRequest(actionError ?? "Could not accept this suggestion.")
                    }
                }
                .presentationDetents([.medium, .large])
            }
        }
    }

    private var emptyMessage: String {
        switch filter {
        case .all:
            "When meetings or email extract a task, confirm it here before it lands on your list."
        case .meeting:
            "No meeting suggestions waiting in this workspace."
        case .email:
            "No email suggestions waiting in this workspace."
        }
    }

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(TaskReviewFilter.allCases) { item in
                    TaskFilterChip(
                        title: chipTitle(item),
                        isSelected: item == filter
                    ) {
                        filter = item
                    }
                }
            }
        }
        .padding(.top, 8)
        .padding(.bottom, 12)
    }

    private func chipTitle(_ item: TaskReviewFilter) -> String {
        switch item {
        case .all:
            counts.pendingCount > 0 ? "All \(counts.pendingCount)" : "All"
        case .meeting:
            counts.meetingCount > 0 ? "Meeting \(counts.meetingCount)" : "Meeting"
        case .email:
            counts.emailCount > 0 ? "Email \(counts.emailCount)" : "Email"
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let actionError {
                    Text(actionError)
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.coral)
                }
                if filter == .all {
                    if !meetingItems.isEmpty {
                        section(title: "Meeting", items: meetingItems)
                    }
                    if !emailItems.isEmpty {
                        section(title: "Email", items: emailItems)
                    }
                } else {
                    VStack(spacing: 12) {
                        ForEach(visibleItems) { item in
                            reviewCard(item)
                        }
                    }
                }
            }
            .padding(.bottom, 12)
        }
    }

    private func section(title: String, items: [TaskReviewItem]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(OzerPalette.plumMuted)
                .textCase(.uppercase)
            ForEach(items) { item in
                reviewCard(item)
            }
        }
    }

    private func reviewCard(_ item: TaskReviewItem) -> some View {
        let busy = pendingIds.contains(item.id)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Label(item.source.label, systemImage: item.source.symbol)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(OzerPalette.plumMuted)
                Spacer()
                if let context = item.contextLabel {
                    Text(context)
                        .font(.caption)
                        .foregroundStyle(OzerPalette.plumSoft)
                        .lineLimit(1)
                }
            }

            Text(item.displayTitle)
                .font(.body.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)

            if let snippet = item.displaySnippet {
                Text(snippet)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .lineLimit(3)
            }

            if let meta = item.metaLabel {
                Text(meta)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(OzerPalette.plumMuted)
            }

            HStack(spacing: 8) {
                Button {
                    Task { await accept(item) }
                } label: {
                    Text("Accept")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(OzerPrimaryButtonStyle())
                .disabled(busy)

                Button {
                    editorItem = item
                } label: {
                    Text("Edit")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(OzerSecondaryButtonStyle())
                .disabled(busy)

                Button {
                    Task { await dismissItem(item) }
                } label: {
                    Text("Dismiss")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(OzerSecondaryButtonStyle())
                .disabled(busy)
            }
            .font(.subheadline.weight(.semibold))
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
        .opacity(busy ? 0.6 : 1)
    }

    private func emptyCard(title: String, message: String) -> some View {
        VStack(spacing: 10) {
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text(message)
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
            Text(error == .notFound ? "Review is on its way" : "Couldn’t load review")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text(error.localizedDescription)
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
            if error != .unauthorized {
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
                session.setPendingTaskReviewCount(0)
                return
            }
            let next = try await client.taskReview(workspace: workspace, accessToken: token)
            payload = next
            loadError = nil
            actionError = nil
            session.setPendingTaskReviewCount(next.counts.pendingCount)
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

    private func accept(_ item: TaskReviewItem, draft: TaskReviewDraft? = nil) async -> Bool {
        await runAction(item) { token, workspace in
            _ = try await client.acceptTaskReview(
                id: item.id,
                source: item.source,
                workspace: workspace,
                title: draft?.title,
                detail: draft?.detail,
                due: draft?.due,
                clearDue: draft?.clearDue ?? false,
                durationMinutes: draft?.durationMinutes,
                clearDuration: draft?.clearDuration ?? false,
                clientId: draft?.clientId,
                clearClient: draft?.clearClient ?? false,
                accessToken: token
            )
        }
    }

    private func dismissItem(_ item: TaskReviewItem) async {
        await runAction(item) { token, workspace in
            try await client.dismissTaskReview(
                id: item.id,
                source: item.source,
                workspace: workspace,
                accessToken: token
            )
        }
    }

    private func runAction(
        _ item: TaskReviewItem,
        work: (String, String) async throws -> Void
    ) async -> Bool {
        pendingIds.insert(item.id)
        defer { pendingIds.remove(item.id) }
        actionError = nil
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else {
                actionError = "Choose a workspace first."
                return false
            }
            try await work(token, workspace)
            payload = TaskReviewPayload(
                items: (payload?.items ?? []).filter { $0.id != item.id },
                counts: adjustedCounts(removing: item)
            )
            session.setPendingTaskReviewCount(payload?.counts.pendingCount ?? 0)
            return true
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            actionError = error.localizedDescription
            return false
        } catch {
            actionError = error.localizedDescription
            return false
        }
    }

    private func adjustedCounts(removing item: TaskReviewItem) -> TaskReviewCounts {
        let current = payload?.counts ?? .empty
        let meeting = max(0, current.meetingCount - (item.source == .meeting ? 1 : 0))
        let email = max(0, current.emailCount - (item.source == .email ? 1 : 0))
        return TaskReviewCounts(
            pendingCount: meeting + email,
            meetingCount: meeting,
            emailCount: email
        )
    }
}

struct TaskReviewDraft {
    var title: String
    var detail: String?
    var due: String?
    var clearDue: Bool
    var durationMinutes: Int?
    var clearDuration: Bool
    var clientId: String?
    var clearClient: Bool
}

struct TaskReviewEditorView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss

    var item: TaskReviewItem
    var onAccept: (TaskReviewDraft) async throws -> Void

    @State private var title: String
    @State private var detail: String
    @State private var hasDue: Bool
    @State private var dueDate: Date
    @State private var hoursText: String
    @State private var minutesText: String
    @State private var selectedClientId: String?
    @State private var clients: [ClientItem] = []
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let api = NativeAPIClient()

    init(item: TaskReviewItem, onAccept: @escaping (TaskReviewDraft) async throws -> Void) {
        self.item = item
        self.onAccept = onAccept
        _title = State(initialValue: item.title)
        _detail = State(initialValue: item.detail ?? "")
        _hasDue = State(initialValue: item.due != nil)
        _dueDate = State(initialValue: TaskItem.dueDate(from: item.due) ?? Date())
        let parts = TaskItem.durationParts(from: item.durationMinutes)
        _hoursText = State(
            initialValue: item.durationMinutes == nil || parts.hours == 0
                ? ""
                : String(parts.hours)
        )
        _minutesText = State(
            initialValue: item.durationMinutes == nil || parts.minutes == 0
                ? ""
                : String(parts.minutes)
        )
        _selectedClientId = State(initialValue: item.clientId)
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
                    TextField("Notes", text: $detail, axis: .vertical)
                        .foregroundStyle(OzerPalette.plum)
                } footer: {
                    if let snippet = item.displaySnippet {
                        Text(snippet)
                    }
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

                Section {
                    HStack(spacing: 12) {
                        TextField("0", text: $hoursText)
                            .keyboardType(.numberPad)
                            .textFieldStyle(.plain)
                            .foregroundStyle(OzerPalette.plum)
                            .frame(width: 56)
                            .accessibilityLabel("Duration hours")
                        Text("h")
                            .foregroundStyle(OzerPalette.plumMuted)
                        TextField("00", text: $minutesText)
                            .keyboardType(.numberPad)
                            .textFieldStyle(.plain)
                            .foregroundStyle(OzerPalette.plum)
                            .frame(width: 56)
                            .accessibilityLabel("Duration minutes")
                        Text("m")
                            .foregroundStyle(OzerPalette.plumMuted)
                    }
                } header: {
                    Text("Duration")
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(OzerPalette.coral)
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
            }
            .scrollContentBackground(.hidden)
            .background(OzerPalette.cream)
            .navigationTitle("Edit suggestion")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(OzerPalette.plumMuted)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Accept") {
                        Task { await save() }
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
            if let id = item.clientId,
               !clients.contains(where: { $0.id == id }) {
                clients.insert(
                    ClientItem(id: id, name: item.clientName ?? "Client"),
                    at: 0
                )
            }
        } catch let error as NativeAPIError where error == .unauthorized {
            await session.handleUnauthorized()
        } catch {
            // Picker stays empty; accept can still use the existing client.
        }
    }

    private func save() async {
        let nextTitle = trimmedTitle
        guard !nextTitle.isEmpty else { return }
        isSaving = true
        defer { isSaving = false }
        let durationMinutes = parsedDurationMinutes()
        let trimmedDetail = detail.trimmingCharacters(in: .whitespacesAndNewlines)
        errorMessage = nil
        do {
            try await onAccept(
                TaskReviewDraft(
                    title: nextTitle,
                    detail: trimmedDetail.isEmpty ? nil : trimmedDetail,
                    due: hasDue ? TaskItem.dueString(from: dueDate) : nil,
                    clearDue: !hasDue && item.due != nil,
                    durationMinutes: durationMinutes,
                    clearDuration: durationMinutes == nil && item.durationMinutes != nil,
                    clientId: showsClientPicker ? selectedClientId : nil,
                    clearClient: showsClientPicker && selectedClientId == nil && item.clientId != nil
                )
            )
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func parsedDurationMinutes() -> Int? {
        let hours = Int(hoursText.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        let minutes = Int(minutesText.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        if hoursText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
           minutesText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        {
            return nil
        }
        return TaskItem.combineDuration(hours: hours, minutes: minutes)
    }
}

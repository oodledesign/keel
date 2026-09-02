import SwiftUI

struct HomeTodayView: View {
    @Environment(AppSession.self) private var session
    var onOpen: (AppScreen) -> Void = { _ in }

    @State private var payload: TodayPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var editorTask: TaskItem?
    @State private var showTaskEditor = false
    @State private var showDictation = false

    private let client = NativeAPIClient()

    private var workspace: NativeWorkspace? {
        session.selectedWorkspace
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
                } else {
                    dashboard
                }
            }
            .padding(.horizontal, 20)
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
            .sheet(isPresented: $showTaskEditor) {
                TaskEditorView(existing: editorTask) { _ in
                    Task { await load() }
                }
                .presentationDetents([.medium, .large])
            }
            .sheet(isPresented: $showDictation) {
                DictationSheet { title, body in
                    await saveNote(title: title, body: body)
                }
            }
        }
    }

    private var dashboard: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                quickActions
                if workspace?.showsInvoices == true, let finances = payload?.finances {
                    moneyCard(finances)
                }
                tasksCard
                notesCard
                if workspace?.showsMeetings == true {
                    meetingsCard
                }
            }
            .padding(.top, 8)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(payload?.headline ?? "Today")
                .font(.title.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            if let workspace {
                Text(workspace.displayName)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(OzerPalette.plumMuted)
            }
            if let dateLabel = payload?.dateLabel ?? Self.todayLabel() {
                Text(dateLabel)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumSoft)
            }
            if let supporting = payload?.supportingText {
                Text(supporting)
                    .font(.body)
                    .foregroundStyle(OzerPalette.plumMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var quickActions: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                actionChip("New task", symbol: "plus") {
                    editorTask = nil
                    showTaskEditor = true
                }
                actionChip("New note", symbol: "mic") {
                    showDictation = true
                }
                if workspace?.showsMeetings == true {
                    actionChip("Record", symbol: "record.circle") {
                        onOpen(.meetings)
                    }
                }
                if workspace?.showsPeople == true {
                    actionChip("People", symbol: "person.2") {
                        onOpen(.people)
                    }
                }
                if workspace?.isPersonalAccount == true || workspace?.profile == "family" {
                    actionChip("Shopping", symbol: "cart") {
                        onOpen(.shopping)
                    }
                }
            }
        }
    }

    private func actionChip(_ title: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(OzerPalette.panel, in: Capsule())
                .overlay {
                    Capsule().stroke(OzerPalette.border, lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
    }

    private func moneyCard(_ finances: FinancesPayload) -> some View {
        Button {
            onOpen(.invoices)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                sectionHeader("Money", seeAll: "See all")
                Text(finances.outstandingBalance.isEmpty ? "—" : finances.outstandingBalance)
                    .font(.title.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                if finances.overdueCount > 0 {
                    Text(
                        finances.overdueCount == 1
                            ? "1 overdue · \(finances.overdueAmount)"
                            : "\(finances.overdueCount) overdue · \(finances.overdueAmount)"
                    )
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(OzerPalette.coral)
                } else {
                    Text("Nothing overdue")
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
        .buttonStyle(.plain)
        .accessibilityLabel("Outstanding \(finances.outstandingBalance)")
    }

    private var tasksCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                onOpen(.tasks)
            } label: {
                sectionHeader("Tasks", seeAll: "See all")
            }
            .buttonStyle(.plain)

            let due = payload?.tasksDueToday ?? []
            let overdue = payload?.overdueTasks ?? []
            if due.isEmpty && overdue.isEmpty {
                emptyPanel("Nothing due today")
            } else {
                VStack(spacing: 8) {
                    ForEach(overdue + due) { item in
                        Button {
                            editorTask = item
                            showTaskEditor = true
                        } label: {
                            taskRow(item)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func taskRow(_ item: TaskItem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.title)
                .font(.body.weight(.medium))
                .foregroundStyle(OzerPalette.plum)
            TaskDueClientSubtitle(item: item)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var notesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                onOpen(.notes)
            } label: {
                sectionHeader("Notes", seeAll: "See all")
            }
            .buttonStyle(.plain)

            if let notes = payload?.recentNotes, !notes.isEmpty {
                VStack(spacing: 8) {
                    ForEach(notes.prefix(5)) { note in
                        NavigationLink {
                            NoteDetailView(note: note)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(note.displayTitle)
                                    .font(.body.weight(.medium))
                                    .foregroundStyle(OzerPalette.plum)
                                if let subtitle = note.displaySubtitle {
                                    Text(subtitle)
                                        .font(.subheadline)
                                        .foregroundStyle(OzerPalette.plumMuted)
                                        .lineLimit(2)
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
                        .buttonStyle(.plain)
                    }
                }
            } else {
                emptyPanel("No notes yet")
            }
        }
    }

    private var meetingsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                onOpen(.meetings)
            } label: {
                sectionHeader("Meetings", seeAll: "See all")
            }
            .buttonStyle(.plain)

            let remote = payload?.meetingsToday ?? []
            let local = MeetingStore.shared.meetings(for: session.workspaceQueryValue)
                .filter { Self.isToday($0.createdAt) }

            if remote.isEmpty && local.isEmpty {
                Button {
                    onOpen(.meetings)
                } label: {
                    emptyPanel("Record a meeting")
                }
                .buttonStyle(.plain)
            } else {
                VStack(spacing: 8) {
                    ForEach(local.prefix(3)) { meeting in
                        Button {
                            onOpen(.meetings)
                        } label: {
                            meetingRow(title: meeting.title, subtitle: meeting.durationLabel)
                        }
                        .buttonStyle(.plain)
                    }
                    ForEach(remote.prefix(3)) { meeting in
                        Button {
                            onOpen(.meetings)
                        } label: {
                            meetingRow(title: meeting.title, subtitle: "Today")
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func meetingRow(title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.body.weight(.medium))
                .foregroundStyle(OzerPalette.plum)
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(OzerPalette.plumMuted)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func sectionHeader(_ title: String, seeAll: String) -> some View {
        HStack {
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Spacer()
            HStack(spacing: 2) {
                Text(seeAll)
                Image(systemName: "chevron.right")
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(OzerPalette.plumMuted)
        }
    }

    private func emptyPanel(_ text: String) -> some View {
        Text(text)
            .font(.body)
            .foregroundStyle(OzerPalette.plumMuted)
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

    private func statusCard(error: NativeAPIError) -> some View {
        VStack(spacing: 12) {
            Text(error == .notFound ? "Today is on its way" : "Couldn’t load today")
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

    private func saveNote(title: String, body: String) async {
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            _ = try await client.createNote(
                title: title,
                body: body,
                workspace: workspace,
                accessToken: token
            )
            await load()
        } catch {
            return
        }
    }

    private static func todayLabel() -> String {
        Date.now.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated))
    }

    private static func isToday(_ iso: String) -> Bool {
        guard let date = NoteItem.parseISO8601(iso) else { return false }
        return Calendar.current.isDateInToday(date)
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

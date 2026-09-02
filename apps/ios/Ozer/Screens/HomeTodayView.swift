import SwiftUI

private enum HomeOverviewTab: String, CaseIterable, Identifiable {
    case tasks
    case notes
    case invoices
    case meetings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .tasks: "Tasks"
        case .notes: "Notes"
        case .invoices: "Invoices"
        case .meetings: "Meetings"
        }
    }
}

struct HomeTodayView: View {
    @Environment(AppSession.self) private var session
    var onOpen: (AppScreen) -> Void = { _ in }

    @State private var payload: TodayPayload?
    @State private var extraFinances: FinancesPayload?
    @State private var recentNotes: [NoteItem] = []
    @State private var invoiceItems: [InvoiceItem] = []
    @State private var overviewTab: HomeOverviewTab = .tasks
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var editorTask: TaskItem?
    @State private var showTaskEditor = false
    @State private var showDictation = false
    @State private var pendingInvoice: InvoiceItem?

    private let client = NativeAPIClient()

    private var workspace: NativeWorkspace? {
        session.selectedWorkspace
    }

    private var finances: FinancesPayload? {
        payload?.finances ?? extraFinances
    }

    private var visibleTabs: [HomeOverviewTab] {
        var tabs: [HomeOverviewTab] = [.tasks, .notes]
        if workspace?.showsInvoices == true {
            tabs.append(.invoices)
        }
        if workspace?.showsMeetings == true {
            tabs.append(.meetings)
        }
        return tabs
    }

    private var dashboardTasks: [TaskItem] {
        var seen = Set<String>()
        var items: [TaskItem] = []
        for item in (payload?.overdueTasks ?? []) + (payload?.tasksDueToday ?? []) {
            if seen.insert(item.id).inserted {
                items.append(item)
            }
            if items.count == 5 { break }
        }
        return items
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
            .onChange(of: session.workspaceContentKey) {
                if !visibleTabs.contains(overviewTab) {
                    overviewTab = .tasks
                }
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
            .navigationDestination(item: $pendingInvoice) { invoice in
                InvoiceDetailView(invoice: invoice)
            }
        }
    }

    private var dashboard: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                quickActions
                if workspace?.showsInvoices == true, let finances {
                    moneyCard(finances)
                }
                overviewCard
            }
            .padding(.top, 8)
            .padding(.bottom, 12)
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
            Text(payload?.dateLabel ?? Self.todayLabel())
                .font(.subheadline)
                .foregroundStyle(OzerPalette.plumSoft)
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
                HStack {
                    Text("Outstanding")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(OzerPalette.plumMuted)
                        .textCase(.uppercase)
                    Spacer()
                    Text("Invoices")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(OzerPalette.plumMuted)
                }
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

    private var overviewCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 4) {
                        ForEach(visibleTabs) { tab in
                            tabPill(tab)
                        }
                    }
                }
                Button(action: openCurrentTab) {
                    HStack(spacing: 2) {
                        Text("See all")
                        Image(systemName: "chevron.right")
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(OzerPalette.plumMuted)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)
            .padding(.bottom, 8)

            Group {
                switch overviewTab {
                case .tasks:
                    tasksTab
                case .notes:
                    notesTab
                case .invoices:
                    invoicesTab
                case .meetings:
                    meetingsTab
                }
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func tabPill(_ tab: HomeOverviewTab) -> some View {
        let selected = overviewTab == tab
        return Button {
            overviewTab = tab
        } label: {
            Text(tab.title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(selected ? Color.white : OzerPalette.plumMuted)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(selected ? OzerPalette.coral : Color.clear, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func openCurrentTab() {
        switch overviewTab {
        case .tasks: onOpen(.tasks)
        case .notes: onOpen(.notes)
        case .invoices: onOpen(.invoices)
        case .meetings: onOpen(.meetings)
        }
    }

    @ViewBuilder
    private var tasksTab: some View {
        let items = dashboardTasks
        if items.isEmpty {
            emptyRow("Nothing due today")
        } else {
            VStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    Button {
                        editorTask = item
                        showTaskEditor = true
                    } label: {
                        compactRow(
                            title: item.title,
                            subtitle: TaskItem.dueLabel(item.due),
                            highlight: item.showsOverdueDueDate
                        )
                    }
                    .buttonStyle(.plain)
                    if index < items.count - 1 {
                        Divider().overlay(OzerPalette.border)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var notesTab: some View {
        if recentNotes.isEmpty {
            emptyRow("No notes yet")
        } else {
            VStack(spacing: 0) {
                ForEach(Array(recentNotes.enumerated()), id: \.element.id) { index, note in
                    NavigationLink {
                        NoteDetailView(note: note)
                    } label: {
                        compactRow(title: note.displayTitle, subtitle: note.displaySubtitle)
                    }
                    .buttonStyle(.plain)
                    if index < recentNotes.count - 1 {
                        Divider().overlay(OzerPalette.border)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var invoicesTab: some View {
        if invoiceItems.isEmpty {
            emptyRow("No open invoices")
        } else {
            VStack(spacing: 0) {
                ForEach(Array(invoiceItems.enumerated()), id: \.element.id) { index, item in
                    Button {
                        pendingInvoice = item
                    } label: {
                        compactRow(
                            title: item.displayNumber,
                            subtitle: [item.displayClient, item.balance].filter { !$0.isEmpty }.joined(separator: " · "),
                            highlight: item.isOverdue
                        )
                    }
                    .buttonStyle(.plain)
                    if index < invoiceItems.count - 1 {
                        Divider().overlay(OzerPalette.border)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var meetingsTab: some View {
        let remote = payload?.meetingsToday ?? []
        let local = MeetingStore.shared.meetings(for: session.workspaceQueryValue)
            .filter { Self.isToday($0.createdAt) }
        if remote.isEmpty && local.isEmpty {
            Button {
                onOpen(.meetings)
            } label: {
                emptyRow("Record a meeting")
            }
            .buttonStyle(.plain)
        } else {
            VStack(spacing: 0) {
                ForEach(Array(local.prefix(5).enumerated()), id: \.element.id) { index, meeting in
                    Button {
                        onOpen(.meetings)
                    } label: {
                        compactRow(title: meeting.title, subtitle: meeting.durationLabel)
                    }
                    .buttonStyle(.plain)
                    if index < min(local.count, 5) - 1 || !remote.isEmpty {
                        Divider().overlay(OzerPalette.border)
                    }
                }
                ForEach(Array(remote.prefix(5).enumerated()), id: \.element.id) { index, meeting in
                    Button {
                        onOpen(.meetings)
                    } label: {
                        compactRow(title: meeting.title, subtitle: "Today")
                    }
                    .buttonStyle(.plain)
                    if index < min(remote.count, 5) - 1 {
                        Divider().overlay(OzerPalette.border)
                    }
                }
            }
        }
    }

    private func compactRow(title: String, subtitle: String?, highlight: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.body.weight(.medium))
                .foregroundStyle(OzerPalette.plum)
                .lineLimit(1)
            if let subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(highlight ? OzerPalette.coral : OzerPalette.plumMuted)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    private func emptyRow(_ text: String) -> some View {
        Text(text)
            .font(.body)
            .foregroundStyle(OzerPalette.plumMuted)
            .padding(.horizontal, 8)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
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
                extraFinances = nil
                recentNotes = []
                invoiceItems = []
                loadError = nil
                return
            }
            async let todayCall = client.today(workspace: workspace, accessToken: token)
            async let notesCall = client.notes(workspace: workspace, accessToken: token)
            let today = try await todayCall
            payload = today
            loadError = nil

            if !today.recentNotes.isEmpty {
                recentNotes = Array(today.recentNotes.prefix(5))
            } else if let notes = try? await notesCall {
                recentNotes = Array(notes.items.prefix(5))
            } else {
                recentNotes = []
            }

            if session.selectedWorkspace?.showsInvoices == true {
                if let pocket = today.finances {
                    extraFinances = pocket
                    invoiceItems = Array(pocket.recent.prefix(5))
                }
                if invoiceItems.isEmpty, let pocket = try? await client.finances(
                    workspace: workspace,
                    accessToken: token
                ) {
                    extraFinances = extraFinances ?? pocket
                    invoiceItems = Array(pocket.recent.prefix(5))
                }
                if invoiceItems.isEmpty, let list = try? await client.invoices(
                    workspace: workspace,
                    accessToken: token
                ) {
                    invoiceItems = Array(list.items.prefix(5))
                }
            } else {
                extraFinances = nil
                invoiceItems = []
            }
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

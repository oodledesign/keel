import SwiftUI

protocol TaskFilterChipItem: Hashable, Identifiable {
    var label: String { get }
}

enum TaskDueFilter: String, CaseIterable, Identifiable, TaskFilterChipItem {
    case all
    case today
    case overdue
    case upcoming
    case noDate

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: "All"
        case .today: "Today"
        case .overdue: "Overdue"
        case .upcoming: "Upcoming"
        case .noDate: "No date"
        }
    }
}

enum TaskStatusFilter: String, CaseIterable, Identifiable, TaskFilterChipItem {
    case open
    case done
    case all

    var id: String { rawValue }

    var label: String {
        switch self {
        case .open: "Open"
        case .done: "Done"
        case .all: "All"
        }
    }

    var queryValue: String { rawValue }
}

enum TaskClientFilter: Hashable, Identifiable {
    case all
    case none
    case client(id: String, name: String)

    var id: String {
        switch self {
        case .all: "all"
        case .none: "none"
        case .client(let id, _): id
        }
    }

    var label: String {
        switch self {
        case .all:
            return "All clients"
        case .none:
            return "No client"
        case .client(_, let name):
            let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? "Client" : trimmed
        }
    }

    var apiClientId: String? {
        switch self {
        case .client(let id, _): id
        default: nil
        }
    }
}

extension TaskItem {
    func matchesSearch(_ query: String) -> Bool {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if needle.isEmpty { return true }
        if title.localizedCaseInsensitiveContains(needle) { return true }
        if let clientName, clientName.localizedCaseInsensitiveContains(needle) {
            return true
        }
        return false
    }

    func matchesDue(_ filter: TaskDueFilter, today: Date = Date(), calendar: Calendar = .current) -> Bool {
        switch filter {
        case .all:
            true
        case .noDate:
            due == nil || due?.isEmpty == true
        case .today, .overdue, .upcoming:
            Self.matchesDatedDue(filter, due: due, today: today, calendar: calendar)
        }
    }

    func matchesClient(_ filter: TaskClientFilter) -> Bool {
        switch filter {
        case .all:
            true
        case .none:
            clientId == nil || clientId?.isEmpty == true
        case .client(let id, _):
            clientId == id
        }
    }

    /// Open tasks whose due calendar day is before today. Completed tasks stay muted.
    var showsOverdueDueDate: Bool {
        !isCompleted && matchesDue(.overdue)
    }

    private static func matchesDatedDue(
        _ filter: TaskDueFilter,
        due: String?,
        today: Date,
        calendar: Calendar
    ) -> Bool {
        guard let date = Self.dueDate(from: due) else { return false }
        let dueDay = calendar.startOfDay(for: date)
        let todayDay = calendar.startOfDay(for: today)
        switch filter {
        case .today:
            return dueDay == todayDay
        case .overdue:
            return dueDay < todayDay
        case .upcoming:
            return dueDay > todayDay
        default:
            return true
        }
    }
}

struct TaskFilterChip: View {
    var title: String
    var isSelected: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isSelected ? Color.white : OzerPalette.plum)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(
                    isSelected ? OzerPalette.coral : OzerPalette.panel,
                    in: Capsule()
                )
                .overlay {
                    Capsule()
                        .stroke(isSelected ? Color.clear : OzerPalette.border, lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// Due date (coral when overdue) plus client name. Used on the Tasks list row.
struct TaskDueClientSubtitle: View {
    var item: TaskItem
    var treatAsCompleted: Bool = false

    private var dueText: String? {
        TaskItem.dueLabel(item.due)
    }

    private var clientText: String? {
        let client = item.clientName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return client.isEmpty ? nil : client
    }

    private var isOverdue: Bool {
        !treatAsCompleted && item.showsOverdueDueDate
    }

    var body: some View {
        if dueText != nil || clientText != nil {
            HStack(spacing: 0) {
                if let dueText {
                    Text(dueText)
                        .foregroundStyle(isOverdue ? OzerPalette.coral : OzerPalette.plumMuted)
                        .accessibilityLabel(isOverdue ? "Overdue, \(dueText)" : dueText)
                }
                if dueText != nil, clientText != nil {
                    Text(" · ")
                        .foregroundStyle(OzerPalette.plumMuted)
                }
                if let clientText {
                    Text(clientText)
                        .foregroundStyle(OzerPalette.plumMuted)
                }
            }
            .font(.subheadline)
        } else if let subtitle = item.subtitle, !subtitle.isEmpty {
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(OzerPalette.plumMuted)
        }
    }
}

struct TaskClientFilterSheet: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss

    var selection: TaskClientFilter
    var onSelect: (TaskClientFilter) -> Void

    @State private var clients: [ClientItem]
    @State private var isLoading: Bool
    @State private var loadError: NativeAPIError?
    @State private var searchText = ""
    private let api = NativeAPIClient()

    init(
        initialClients: [ClientItem] = [],
        initialError: NativeAPIError? = nil,
        selection: TaskClientFilter,
        onSelect: @escaping (TaskClientFilter) -> Void
    ) {
        self.selection = selection
        self.onSelect = onSelect
        _clients = State(initialValue: initialClients)
        _loadError = State(initialValue: initialClients.isEmpty ? initialError : nil)
        _isLoading = State(initialValue: initialClients.isEmpty && initialError == nil)
    }

    private var query: String {
        searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var visibleClients: [ClientItem] {
        let sorted = clients.sorted {
            $0.displayName.localizedStandardCompare($1.displayName) == .orderedAscending
        }
        guard !query.isEmpty else { return sorted }
        return sorted.filter { $0.matchesSearch(query) }
    }

    var body: some View {
        NavigationStack {
            List {
                row("All clients", selected: selection == .all) {
                    onSelect(.all)
                    dismiss()
                }
                row("No client", selected: selection == .none) {
                    onSelect(.none)
                    dismiss()
                }
                clientRows
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(OzerPalette.cream)
            .navigationTitle("Client")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $searchText, prompt: "Search clients")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(OzerPalette.plumMuted)
                }
            }
            .task(id: session.workspaceContentKey) {
                await load()
            }
        }
    }

    @ViewBuilder
    private var clientRows: some View {
        if isLoading && clients.isEmpty && loadError == nil {
            HStack {
                Spacer()
                ProgressView()
                    .tint(OzerPalette.coral)
                Spacer()
            }
            .listRowBackground(OzerPalette.panel)
            .accessibilityLabel("Loading clients")
        } else if let loadError, clients.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text(loadError == .notFound ? "Clients aren’t available yet" : "Couldn’t load clients")
                    .foregroundStyle(OzerPalette.plum)
                Text(loadError.localizedDescription)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
                if loadError != .unauthorized && loadError != .notFound {
                    Button("Try again") {
                        Task { await load() }
                    }
                    .foregroundStyle(OzerPalette.coral)
                }
            }
            .listRowBackground(OzerPalette.panel)
        } else if visibleClients.isEmpty {
            Text(query.isEmpty ? "No clients" : "No matches")
                .foregroundStyle(OzerPalette.plumMuted)
                .listRowBackground(OzerPalette.panel)
        } else {
            ForEach(visibleClients) { client in
                row(client.displayName, selected: selection.id == client.id) {
                    onSelect(.client(id: client.id, name: client.displayName))
                    dismiss()
                }
            }
        }
    }

    private func row(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .foregroundStyle(OzerPalette.plum)
                Spacer()
                if selected {
                    Image(systemName: "checkmark")
                        .fontWeight(.semibold)
                        .foregroundStyle(OzerPalette.coral)
                }
            }
        }
        .listRowBackground(OzerPalette.panel)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    /// Same clients request as the Clients tab (`GET /api/native/v1/clients`).
    private func load() async {
        if clients.isEmpty {
            isLoading = true
            loadError = nil
        }
        defer { isLoading = false }
        do {
            let token = try await session.validAccessToken()
            if !session.workspacesLoaded {
                await session.refreshWorkspaces()
            }
            try Task.checkCancellation()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else {
                clients = []
                loadError = nil
                return
            }
            let payload = try await api.clients(workspace: workspace, accessToken: token)
            clients = payload.items
            loadError = nil
        } catch is CancellationError {
            return
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            if clients.isEmpty {
                loadError = error
            }
        } catch {
            if error.isTaskCancellation { return }
            if clients.isEmpty {
                loadError = .transport(error.localizedDescription)
            }
        }
    }
}

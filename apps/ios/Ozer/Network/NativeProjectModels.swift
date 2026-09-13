import Foundation

struct ProjectsPayload: Decodable, Equatable {
    var items: [ProjectItem]
    var statuses: [ProjectStatusColumn]

    static let empty = ProjectsPayload(items: [], statuses: ProjectStatusColumn.defaults)

    enum CodingKeys: String, CodingKey {
        case items, statuses
    }

    init(items: [ProjectItem], statuses: [ProjectStatusColumn] = ProjectStatusColumn.defaults) {
        self.items = items
        self.statuses = statuses.isEmpty ? ProjectStatusColumn.defaults : statuses
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        items = try container.decodeIfPresent([ProjectItem].self, forKey: .items) ?? []
        let decoded = try container.decodeIfPresent([ProjectStatusColumn].self, forKey: .statuses) ?? []
        statuses = decoded.isEmpty ? ProjectStatusColumn.defaults : decoded
    }
}

struct ProjectStatusColumn: Decodable, Identifiable, Equatable, Hashable {
    var slug: String
    var label: String
    var category: String

    var id: String { slug }

    static let defaults: [ProjectStatusColumn] = [
        ProjectStatusColumn(slug: "pending", label: "Pending", category: "open"),
        ProjectStatusColumn(slug: "in_progress", label: "In progress", category: "open"),
        ProjectStatusColumn(slug: "on_hold", label: "On hold", category: "open"),
        ProjectStatusColumn(slug: "completed", label: "Completed", category: "completed"),
        ProjectStatusColumn(slug: "cancelled", label: "Cancelled", category: "cancelled"),
    ]

    var isOpen: Bool { category == "open" }
}

struct ProjectTaskCounts: Decodable, Equatable, Hashable {
    var open: Int
    var done: Int
    var total: Int

    static let empty = ProjectTaskCounts(open: 0, done: 0, total: 0)

    init(open: Int = 0, done: Int = 0, total: Int = 0) {
        self.open = open
        self.done = done
        self.total = total
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        open = try container.decodeIfPresent(Int.self, forKey: .open) ?? 0
        done = try container.decodeIfPresent(Int.self, forKey: .done) ?? 0
        total = try container.decodeIfPresent(Int.self, forKey: .total) ?? (open + done)
    }

    private enum CodingKeys: String, CodingKey {
        case open, done, total
    }
}

struct ProjectItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var status: String
    var statusLabel: String
    var clientId: String?
    var clientName: String?
    var start: String?
    var due: String?
    var isOngoing: Bool
    var isPhased: Bool
    var value: String?
    var valuePence: Int?
    var progressPct: Int
    var taskCounts: ProjectTaskCounts
    var descriptionText: String?
    var phases: [ProjectPhaseItem]
    var tasks: [ProjectTaskItem]
    var defaultBoardMode: ProjectBoardMode

    enum CodingKeys: String, CodingKey {
        case id, title, status, start, due, value, description, name
        case statusLabel = "status_label"
        case clientId = "client_id"
        case clientName = "client_name"
        case isOngoing = "is_ongoing"
        case isPhased = "is_phased"
        case valuePence = "value_pence"
        case progressPct = "progress_pct"
        case taskCounts = "task_counts"
        case phases, tasks
        case defaultBoardMode = "default_board_mode"
    }

    init(
        id: String,
        title: String,
        status: String = "pending",
        statusLabel: String = "Pending",
        clientId: String? = nil,
        clientName: String? = nil,
        start: String? = nil,
        due: String? = nil,
        isOngoing: Bool = false,
        isPhased: Bool = false,
        value: String? = nil,
        valuePence: Int? = nil,
        progressPct: Int = 0,
        taskCounts: ProjectTaskCounts = .empty,
        descriptionText: String? = nil,
        phases: [ProjectPhaseItem] = [],
        tasks: [ProjectTaskItem] = [],
        defaultBoardMode: ProjectBoardMode = .progress
    ) {
        self.id = id
        self.title = title
        self.status = status
        self.statusLabel = statusLabel
        self.clientId = clientId
        self.clientName = clientName
        self.start = start
        self.due = due
        self.isOngoing = isOngoing
        self.isPhased = isPhased
        self.value = value
        self.valuePence = valuePence
        self.progressPct = progressPct
        self.taskCounts = taskCounts
        self.descriptionText = descriptionText
        self.phases = phases
        self.tasks = tasks
        self.defaultBoardMode = defaultBoardMode
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        let decodedTitle = try container.decodeIfPresent(String.self, forKey: .title)
            ?? container.decodeIfPresent(String.self, forKey: .name)
            ?? ""
        title = decodedTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "Untitled project"
            : decodedTitle
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "pending"
        statusLabel = try container.decodeIfPresent(String.self, forKey: .statusLabel)
            ?? status.replacingOccurrences(of: "_", with: " ").capitalized
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
        start = try container.decodeIfPresent(String.self, forKey: .start)
        due = try container.decodeIfPresent(String.self, forKey: .due)
        isOngoing = try container.decodeIfPresent(Bool.self, forKey: .isOngoing) ?? false
        isPhased = try container.decodeIfPresent(Bool.self, forKey: .isPhased) ?? false
        value = try container.decodeIfPresent(String.self, forKey: .value)
        valuePence = try container.decodeIfPresent(Int.self, forKey: .valuePence)
        progressPct = try container.decodeIfPresent(Int.self, forKey: .progressPct) ?? 0
        taskCounts = try container.decodeIfPresent(ProjectTaskCounts.self, forKey: .taskCounts) ?? .empty
        descriptionText = try container.decodeIfPresent(String.self, forKey: .description)
        phases = try container.decodeIfPresent([ProjectPhaseItem].self, forKey: .phases) ?? []
        tasks = try container.decodeIfPresent([ProjectTaskItem].self, forKey: .tasks) ?? []
        defaultBoardMode = try container.decodeIfPresent(ProjectBoardMode.self, forKey: .defaultBoardMode)
            ?? (isPhased ? .phase : .progress)
    }

    var displayTitle: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Untitled project" : trimmed
    }

    var displayClient: String? {
        let trimmed = clientName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }

    var displayValue: String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }

    var displayStatus: String {
        let trimmed = statusLabel.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Pending" : trimmed
    }

    var dueLabel: String? {
        if isOngoing { return "Ongoing" }
        return TaskItem.dueLabel(due)
    }

    var startLabel: String? {
        TaskItem.dueLabel(start)
    }

    var dateRangeLabel: String? {
        switch (startLabel, dueLabel) {
        case let (start?, due?):
            return "\(start) – \(due)"
        case let (start?, nil):
            return "From \(start)"
        case let (nil, due?):
            return due
        default:
            return nil
        }
    }

    var subtitleParts: [String] {
        var parts: [String] = [displayStatus]
        if let client = displayClient { parts.append(client) }
        if let dates = dateRangeLabel { parts.append(dates) }
        if let value = displayValue { parts.append(value) }
        return parts
    }

    var displaySubtitle: String {
        subtitleParts.joined(separator: " · ")
    }
}

enum ProjectBoardMode: String, Decodable, CaseIterable, Identifiable {
    case phase
    case progress

    var id: String { rawValue }

    var label: String {
        switch self {
        case .phase: "Phase"
        case .progress: "Progress"
        }
    }
}

enum ProjectHubView: String, CaseIterable, Identifiable {
    case list
    case board

    var id: String { rawValue }

    var label: String {
        switch self {
        case .list: "List"
        case .board: "Board"
        }
    }
}

enum ProjectDetailViewMode: String, CaseIterable, Identifiable {
    case list
    case timeline
    case board

    var id: String { rawValue }

    var label: String {
        switch self {
        case .list: "List"
        case .timeline: "Timeline"
        case .board: "Board"
        }
    }
}

enum ProjectListFilter: String, CaseIterable, Identifiable {
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

struct ProjectPhaseItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var name: String
    var status: String
    var statusLabel: String
    var isMilestone: Bool
    var colour: String?
    var start: String?
    var due: String?
    var progressPct: Int
    var taskCount: Int

    enum CodingKeys: String, CodingKey {
        case id, name, status, colour, start, due
        case statusLabel = "status_label"
        case isMilestone = "is_milestone"
        case progressPct = "progress_pct"
        case taskCount = "task_count"
    }

    init(
        id: String,
        name: String,
        status: String = "not_started",
        statusLabel: String = "Not started",
        isMilestone: Bool = false,
        colour: String? = nil,
        start: String? = nil,
        due: String? = nil,
        progressPct: Int = 0,
        taskCount: Int = 0
    ) {
        self.id = id
        self.name = name
        self.status = status
        self.statusLabel = statusLabel
        self.isMilestone = isMilestone
        self.colour = colour
        self.start = start
        self.due = due
        self.progressPct = progressPct
        self.taskCount = taskCount
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? "Untitled phase"
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "not_started"
        statusLabel = try container.decodeIfPresent(String.self, forKey: .statusLabel)
            ?? status.replacingOccurrences(of: "_", with: " ").capitalized
        isMilestone = try container.decodeIfPresent(Bool.self, forKey: .isMilestone) ?? false
        colour = try container.decodeIfPresent(String.self, forKey: .colour)
        start = try container.decodeIfPresent(String.self, forKey: .start)
        due = try container.decodeIfPresent(String.self, forKey: .due)
        progressPct = try container.decodeIfPresent(Int.self, forKey: .progressPct) ?? 0
        taskCount = try container.decodeIfPresent(Int.self, forKey: .taskCount) ?? 0
    }

    var dateRangeLabel: String? {
        let startLabel = TaskItem.dueLabel(start)
        let dueLabel = TaskItem.dueLabel(due)
        switch (startLabel, dueLabel) {
        case let (start?, due?):
            return "\(start) – \(due)"
        case let (start?, nil):
            return "From \(start)"
        case let (nil, due?):
            return due
        default:
            return nil
        }
    }
}

struct ProjectTaskItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var status: String?
    var due: String?
    var durationMinutes: Int?
    var clientId: String?
    var clientName: String?
    var phaseId: String?
    var phaseName: String?
    var parentTaskId: String?

    enum CodingKeys: String, CodingKey {
        case id, title, status, due
        case durationMinutes = "duration_minutes"
        case clientId = "client_id"
        case clientName = "client_name"
        case phaseId = "phase_id"
        case phaseName = "phase_name"
        case parentTaskId = "parent_task_id"
    }

    init(
        id: String,
        title: String,
        status: String? = nil,
        due: String? = nil,
        durationMinutes: Int? = nil,
        clientId: String? = nil,
        clientName: String? = nil,
        phaseId: String? = nil,
        phaseName: String? = nil,
        parentTaskId: String? = nil
    ) {
        self.id = id
        self.title = title
        self.status = status
        self.due = due
        self.durationMinutes = durationMinutes
        self.clientId = clientId
        self.clientName = clientName
        self.phaseId = phaseId
        self.phaseName = phaseName
        self.parentTaskId = parentTaskId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "Untitled"
        status = try container.decodeIfPresent(String.self, forKey: .status)
        due = try container.decodeIfPresent(String.self, forKey: .due)
        durationMinutes = try container.decodeIfPresent(Int.self, forKey: .durationMinutes)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
        phaseId = try container.decodeIfPresent(String.self, forKey: .phaseId)
        phaseName = try container.decodeIfPresent(String.self, forKey: .phaseName)
        parentTaskId = try container.decodeIfPresent(String.self, forKey: .parentTaskId)
    }

    var asTaskItem: TaskItem {
        TaskItem(
            id: id,
            title: title,
            status: status,
            due: due,
            durationMinutes: durationMinutes,
            subtitle: nil,
            clientId: clientId,
            clientName: clientName
        )
    }

    var isCompleted: Bool { asTaskItem.isCompleted }

    var progressColumn: String {
        switch status?.lowercased() {
        case "in_progress":
            return "in_progress"
        case "client_review", "review":
            return "client_review"
        case "completed", "done", "complete", "cancelled":
            return "done"
        default:
            return "todo"
        }
    }
}

enum ProjectProgressColumn: String, CaseIterable, Identifiable {
    case todo
    case inProgress = "in_progress"
    case review = "client_review"
    case done

    var id: String { rawValue }

    var label: String {
        switch self {
        case .todo: "To do"
        case .inProgress: "In progress"
        case .review: "Review"
        case .done: "Done"
        }
    }
}

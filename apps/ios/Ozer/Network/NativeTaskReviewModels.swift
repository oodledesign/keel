import Foundation

enum TaskReviewSource: String, Codable, CaseIterable, Identifiable {
    case meeting
    case email

    var id: String { rawValue }

    var label: String {
        switch self {
        case .meeting: "Meeting"
        case .email: "Email"
        }
    }

    var symbol: String {
        switch self {
        case .meeting: "waveform"
        case .email: "envelope"
        }
    }
}

struct TaskReviewCounts: Decodable, Equatable {
    var pendingCount: Int
    var meetingCount: Int
    var emailCount: Int

    static let empty = TaskReviewCounts(pendingCount: 0, meetingCount: 0, emailCount: 0)

    enum CodingKeys: String, CodingKey {
        case pendingCount = "pending_count"
        case meetingCount = "meeting_count"
        case emailCount = "email_count"
    }

    init(pendingCount: Int, meetingCount: Int, emailCount: Int) {
        self.pendingCount = pendingCount
        self.meetingCount = meetingCount
        self.emailCount = emailCount
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        pendingCount = try container.decodeIfPresent(Int.self, forKey: .pendingCount) ?? 0
        meetingCount = try container.decodeIfPresent(Int.self, forKey: .meetingCount) ?? 0
        emailCount = try container.decodeIfPresent(Int.self, forKey: .emailCount) ?? 0
    }

    var sourceSummary: String {
        var parts: [String] = []
        if meetingCount > 0 {
            parts.append(meetingCount == 1 ? "1 meeting" : "\(meetingCount) meeting")
        }
        if emailCount > 0 {
            parts.append(emailCount == 1 ? "1 email" : "\(emailCount) email")
        }
        if parts.isEmpty {
            return "Nothing waiting"
        }
        return parts.joined(separator: " · ")
    }
}

struct TaskReviewPayload: Decodable, Equatable {
    var items: [TaskReviewItem]
    var counts: TaskReviewCounts

    static let empty = TaskReviewPayload(items: [], counts: .empty)

    enum CodingKeys: String, CodingKey {
        case items
        case pendingCount = "pending_count"
        case meetingCount = "meeting_count"
        case emailCount = "email_count"
    }

    init(items: [TaskReviewItem], counts: TaskReviewCounts) {
        self.items = items
        self.counts = counts
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        items = try container.decodeIfPresent([TaskReviewItem].self, forKey: .items) ?? []
        counts = TaskReviewCounts(
            pendingCount: try container.decodeIfPresent(Int.self, forKey: .pendingCount) ?? items.count,
            meetingCount: try container.decodeIfPresent(Int.self, forKey: .meetingCount)
                ?? items.filter { $0.source == .meeting }.count,
            emailCount: try container.decodeIfPresent(Int.self, forKey: .emailCount)
                ?? items.filter { $0.source == .email }.count
        )
    }
}

struct TaskReviewAcceptResult: Decodable, Equatable {
    var ok: Bool
    var taskId: String?

    enum CodingKeys: String, CodingKey {
        case ok
        case taskId = "task_id"
    }
}

struct TaskReviewItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var source: TaskReviewSource
    var title: String
    var detail: String?
    var snippet: String?
    var due: String?
    var durationMinutes: Int?
    var clientId: String?
    var clientName: String?
    var projectId: String?
    var projectName: String?
    var contextTitle: String?
    var contextDate: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, source, title, detail, snippet, due
        case durationMinutes = "duration_minutes"
        case clientId = "client_id"
        case clientName = "client_name"
        case projectId = "project_id"
        case projectName = "project_name"
        case contextTitle = "context_title"
        case contextDate = "context_date"
        case createdAt = "created_at"
    }

    init(
        id: String,
        source: TaskReviewSource,
        title: String,
        detail: String? = nil,
        snippet: String? = nil,
        due: String? = nil,
        durationMinutes: Int? = nil,
        clientId: String? = nil,
        clientName: String? = nil,
        projectId: String? = nil,
        projectName: String? = nil,
        contextTitle: String? = nil,
        contextDate: String? = nil,
        createdAt: String? = nil
    ) {
        self.id = id
        self.source = source
        self.title = title
        self.detail = detail
        self.snippet = snippet
        self.due = due
        self.durationMinutes = TaskItem.clampDurationMinutes(durationMinutes)
        self.clientId = clientId
        self.clientName = clientName
        self.projectId = projectId
        self.projectName = projectName
        self.contextTitle = contextTitle
        self.contextDate = contextDate
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        source = try container.decodeIfPresent(TaskReviewSource.self, forKey: .source) ?? .meeting
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "Task"
        detail = try container.decodeIfPresent(String.self, forKey: .detail)
        snippet = try container.decodeIfPresent(String.self, forKey: .snippet)
        due = try container.decodeIfPresent(String.self, forKey: .due)
        if let value = try? container.decodeIfPresent(Int.self, forKey: .durationMinutes) {
            durationMinutes = TaskItem.clampDurationMinutes(value)
        } else if let value = try? container.decodeIfPresent(Double.self, forKey: .durationMinutes) {
            durationMinutes = TaskItem.clampDurationMinutes(Int(value.rounded()))
        } else {
            durationMinutes = nil
        }
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
        projectId = try container.decodeIfPresent(String.self, forKey: .projectId)
        projectName = try container.decodeIfPresent(String.self, forKey: .projectName)
        contextTitle = try container.decodeIfPresent(String.self, forKey: .contextTitle)
        contextDate = try container.decodeIfPresent(String.self, forKey: .contextDate)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
    }

    var displayTitle: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Task" : trimmed
    }

    var displaySnippet: String? {
        let excerpt = snippet?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !excerpt.isEmpty { return excerpt }
        let extra = detail?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return extra.isEmpty ? nil : extra
    }

    var durationLabel: String? {
        TaskItem.formatDuration(durationMinutes)
    }

    var dueLabel: String? {
        TaskItem.dueLabel(due)
    }

    var clientOrProjectLabel: String? {
        let project = projectName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !project.isEmpty { return project }
        let client = clientName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return client.isEmpty ? nil : client
    }

    var contextLabel: String? {
        let title = contextTitle?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return title.isEmpty ? source.label : title
    }

    var metaLabel: String? {
        var parts: [String] = []
        if let dueLabel { parts.append(dueLabel) }
        if let durationLabel { parts.append(durationLabel) }
        if let clientOrProjectLabel { parts.append(clientOrProjectLabel) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

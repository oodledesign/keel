import Foundation

extension Error {
    var isTaskCancellation: Bool {
        self is CancellationError || (self as? URLError)?.code == .cancelled
    }
}

enum NativeAPIError: LocalizedError, Equatable {
    case notFound
    case unauthorized
    case http(Int)
    case decoding
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .notFound:
            "This isn’t available yet for this workspace."
        case .unauthorized:
            "Your session expired. Please sign in again."
        case .http(let code):
            "The server returned \(code)."
        case .decoding:
            "The server response could not be read."
        case .transport(let message):
            message
        }
    }
}

/// Bearer JSON client for `{OZER_API_BASE}/api/native/v1`. No cookies.
actor NativeAPIClient {
    private let session: URLSession

    init() {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieAcceptPolicy = .never
        configuration.httpShouldSetCookies = false
        configuration.httpCookieStorage = nil
        session = URLSession(configuration: configuration)
    }

    func workspaces(accessToken: String) async throws -> [NativeWorkspace] {
        let data = try await get(
            path: "api/native/v1/workspaces",
            queryItems: [],
            accessToken: accessToken
        )
        if data.isEmpty {
            return []
        }
        do {
            return try JSONDecoder().decode([NativeWorkspace].self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func today(workspace: String, accessToken: String) async throws -> TodayPayload {
        let data = try await get(
            path: "api/native/v1/today",
            queryItems: [URLQueryItem(name: "workspace", value: workspace)],
            accessToken: accessToken
        )
        if data.isEmpty {
            return TodayPayload.empty
        }
        do {
            return try JSONDecoder().decode(TodayPayload.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func tasks(workspace: String, accessToken: String) async throws -> TasksPayload {
        let data = try await get(
            path: "api/native/v1/tasks",
            queryItems: [URLQueryItem(name: "workspace", value: workspace)],
            accessToken: accessToken
        )
        if data.isEmpty {
            return TasksPayload.empty
        }
        do {
            return try JSONDecoder().decode(TasksPayload.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    private func get(
        path: String,
        queryItems: [URLQueryItem],
        accessToken: String
    ) async throws -> Data {
        var components = URLComponents(
            url: AppConfiguration.apiBaseURL.appending(path: path),
            resolvingAgainstBaseURL: false
        )
        if !queryItems.isEmpty {
            components?.queryItems = queryItems
        }
        guard let url = components?.url else {
            throw NativeAPIError.transport("Could not build the request URL.")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.httpShouldHandleCookies = false

        let data: Data
        let http: HTTPURLResponse
        do {
            let result = try await session.data(for: request)
            data = result.0
            guard let response = result.1 as? HTTPURLResponse else {
                throw NativeAPIError.transport("No HTTP response.")
            }
            http = response
        } catch let error as NativeAPIError {
            throw error
        } catch {
            throw NativeAPIError.transport(error.localizedDescription)
        }

        switch http.statusCode {
        case 200:
            return data
        case 401:
            throw NativeAPIError.unauthorized
        case 404:
            throw NativeAPIError.notFound
        default:
            throw NativeAPIError.http(http.statusCode)
        }
    }
}

struct NativeWorkspace: Decodable, Equatable, Identifiable {
    var id: String
    var slug: String
    var name: String
    var profile: String
    var isPersonal: Bool
    /// Public HTTPS logo or photo. Missing or non-https values stay nil.
    var image: String?

    var queryValue: String {
        slug.isEmpty ? id : slug
    }

    enum CodingKeys: String, CodingKey {
        case id, slug, name, profile, isPersonal, image
    }

    init(
        id: String,
        slug: String,
        name: String,
        profile: String,
        isPersonal: Bool,
        image: String? = nil
    ) {
        self.id = id
        self.slug = slug
        self.name = name
        self.profile = profile
        self.isPersonal = isPersonal
        self.image = image
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        slug = try container.decodeIfPresent(String.self, forKey: .slug) ?? ""
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? slug
        profile = try container.decodeIfPresent(String.self, forKey: .profile) ?? ""
        isPersonal = try container.decodeIfPresent(Bool.self, forKey: .isPersonal)
            ?? (profile == "personal")
        image = try container.decodeIfPresent(String.self, forKey: .image)
    }
}

struct TodayPayload: Decodable, Equatable {
    var title: String?
    var greeting: String?
    var message: String?
    var summary: String?
    var items: [TodayItem]

    static let empty = TodayPayload(title: nil, greeting: nil, message: nil, summary: nil, items: [])

    enum CodingKeys: String, CodingKey {
        case title, greeting, message, summary, items, tasks, cards
        case tasksDueToday = "tasks_due_today"
        case overdueTasks = "overdue_tasks"
    }

    init(title: String?, greeting: String?, message: String?, summary: String?, items: [TodayItem]) {
        self.title = title
        self.greeting = greeting
        self.message = message
        self.summary = summary
        self.items = items
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        greeting = try container.decodeIfPresent(String.self, forKey: .greeting)
        message = try container.decodeIfPresent(String.self, forKey: .message)
        summary = try container.decodeIfPresent(String.self, forKey: .summary)

        let dueToday = try container.decodeIfPresent([TodayItem].self, forKey: .tasksDueToday)
        let overdue = try container.decodeIfPresent([TodayItem].self, forKey: .overdueTasks)
        if dueToday != nil || overdue != nil {
            items = Self.mergeHomeItems(dueToday: dueToday ?? [], overdue: overdue ?? [])
            return
        }

        if let items = try container.decodeIfPresent([TodayItem].self, forKey: .items) {
            self.items = items
        } else if let tasks = try container.decodeIfPresent([TodayItem].self, forKey: .tasks) {
            self.items = tasks
        } else if let cards = try container.decodeIfPresent([TodayItem].self, forKey: .cards) {
            self.items = cards
        } else {
            items = []
        }
    }

    /// Due today first, then overdue. Same id keeps the due-today row.
    static func mergeHomeItems(dueToday: [TodayItem], overdue: [TodayItem]) -> [TodayItem] {
        var seen = Set<String>()
        var merged: [TodayItem] = []
        for item in dueToday + overdue {
            if seen.insert(item.id).inserted {
                merged.append(item)
            }
        }
        return merged
    }

    var headline: String {
        greeting ?? title ?? "Today"
    }

    var supportingText: String? {
        message ?? summary
    }
}

struct TasksPayload: Decodable, Equatable {
    var items: [TaskItem]

    static let empty = TasksPayload(items: [])

    enum CodingKeys: String, CodingKey {
        case items, tasks
    }

    init(items: [TaskItem]) {
        self.items = items
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let items = try container.decodeIfPresent([TaskItem].self, forKey: .items) {
            self.items = items
        } else if let tasks = try container.decodeIfPresent([TaskItem].self, forKey: .tasks) {
            self.items = tasks
        } else {
            items = []
        }
    }
}

struct TaskItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var due: String?
    var subtitle: String?

    enum CodingKeys: String, CodingKey {
        case id, title, due, subtitle, name, description, body
    }

    init(id: String, title: String, due: String?, subtitle: String?) {
        self.id = id
        self.title = title
        self.due = due
        self.subtitle = subtitle
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let id = try container.decodeIfPresent(String.self, forKey: .id) {
            self.id = id
        } else {
            id = UUID().uuidString
        }
        title = try container.decodeIfPresent(String.self, forKey: .title)
            ?? container.decodeIfPresent(String.self, forKey: .name)
            ?? "Untitled"
        due = try container.decodeIfPresent(String.self, forKey: .due)
        subtitle = try container.decodeIfPresent(String.self, forKey: .subtitle)
            ?? container.decodeIfPresent(String.self, forKey: .description)
            ?? container.decodeIfPresent(String.self, forKey: .body)
    }

    var displaySubtitle: String? {
        subtitle ?? Self.dueLabel(due)
    }

    /// Calendar date only. Parse and format in UTC so the day does not shift.
    /// `en_GB` matches the web recorder short label (`Mon 1 Sep`).
    static func dueLabel(_ due: String?) -> String? {
        guard let due, !due.isEmpty else { return nil }
        guard let date = Self.dueParser.date(from: due) else { return due }
        return Self.dueDisplay.string(from: date)
    }

    private static let dueParser: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let dueDisplay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_GB")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "EEE d MMM"
        return formatter
    }()
}

struct TodayItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var subtitle: String?

    enum CodingKeys: String, CodingKey {
        case id, title, subtitle, name, description, body
    }

    init(id: String, title: String, subtitle: String?) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let id = try container.decodeIfPresent(String.self, forKey: .id) {
            self.id = id
        } else {
            id = UUID().uuidString
        }
        title = try container.decodeIfPresent(String.self, forKey: .title)
            ?? container.decodeIfPresent(String.self, forKey: .name)
            ?? "Untitled"
        subtitle = try container.decodeIfPresent(String.self, forKey: .subtitle)
            ?? container.decodeIfPresent(String.self, forKey: .description)
            ?? container.decodeIfPresent(String.self, forKey: .body)
    }
}

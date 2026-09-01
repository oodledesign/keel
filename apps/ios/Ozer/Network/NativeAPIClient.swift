import Foundation

extension Error {
    var isTaskCancellation: Bool {
        self is CancellationError || (self as? URLError)?.code == .cancelled
    }
}

enum NativeAPIError: LocalizedError, Equatable {
    case notFound
    case unauthorized
    case badRequest(String)
    case http(Int)
    case decoding
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .notFound:
            "This isn’t available yet for this workspace."
        case .unauthorized:
            "Your session expired. Please sign in again."
        case .badRequest(let message):
            message
        case .http(let code):
            "The server returned \(code)."
        case .decoding:
            "The server response could not be read."
        case .transport(let message):
            message
        }
    }
}

private struct NativeErrorBody: Decodable {
    var error: String?
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
        let data = try await send(
            method: "GET",
            path: "api/native/v1/workspaces",
            queryItems: [],
            body: nil,
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
        let data = try await send(
            method: "GET",
            path: "api/native/v1/today",
            queryItems: [URLQueryItem(name: "workspace", value: workspace)],
            body: nil,
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

    func tasks(
        workspace: String,
        clientId: String? = nil,
        status: String? = nil,
        accessToken: String
    ) async throws -> TasksPayload {
        var query = [URLQueryItem(name: "workspace", value: workspace)]
        if let clientId, !clientId.isEmpty {
            query.append(URLQueryItem(name: "client", value: clientId))
        }
        // Server defaults to open, so the phone omits that value.
        if let status, !status.isEmpty, status != "open" {
            query.append(URLQueryItem(name: "status", value: status))
        }
        let data = try await send(
            method: "GET",
            path: "api/native/v1/tasks",
            queryItems: query,
            body: nil,
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

    func createTask(
        title: String,
        due: String?,
        clientId: String?,
        workspace: String,
        accessToken: String
    ) async throws -> TaskItem {
        var body: [String: Any] = [
            "title": title,
            "workspace": workspace,
        ]
        if let due, !due.isEmpty {
            body["due"] = due
        }
        if let clientId, !clientId.isEmpty {
            body["client_id"] = clientId
        }
        let data = try await send(
            method: "POST",
            path: "api/native/v1/tasks",
            queryItems: [],
            body: body,
            accessToken: accessToken
        )
        do {
            return try JSONDecoder().decode(TaskItem.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func updateTask(
        id: String,
        title: String? = nil,
        due: String? = nil,
        clearDue: Bool = false,
        clientId: String? = nil,
        clearClient: Bool = false,
        status: String? = nil,
        accessToken: String
    ) async throws -> TaskItem {
        var body: [String: Any] = [:]
        if let title {
            body["title"] = title
        }
        if clearDue {
            body["due"] = NSNull()
        } else if let due {
            body["due"] = due
        }
        if clearClient {
            body["client_id"] = NSNull()
        } else if let clientId {
            body["client_id"] = clientId
        }
        if let status {
            body["status"] = status
        }
        let data = try await send(
            method: "PATCH",
            path: "api/native/v1/tasks/\(id)",
            queryItems: [],
            body: body,
            accessToken: accessToken
        )
        do {
            return try JSONDecoder().decode(TaskItem.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func clients(workspace: String, accessToken: String) async throws -> ClientsPayload {
        let data = try await send(
            method: "GET",
            path: "api/native/v1/clients",
            queryItems: [URLQueryItem(name: "workspace", value: workspace)],
            body: nil,
            accessToken: accessToken
        )
        if data.isEmpty {
            return ClientsPayload.empty
        }
        do {
            return try JSONDecoder().decode(ClientsPayload.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func client(id: String, workspace: String, accessToken: String) async throws -> ClientItem {
        let data = try await send(
            method: "GET",
            path: "api/native/v1/clients/\(id)",
            queryItems: [URLQueryItem(name: "workspace", value: workspace)],
            body: nil,
            accessToken: accessToken
        )
        do {
            return try JSONDecoder().decode(ClientItem.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func createNote(
        title: String,
        body: String,
        workspace: String,
        tags: [String] = [],
        category: String? = nil,
        clientId: String? = nil,
        accessToken: String
    ) async throws -> NoteItem {
        var payload: [String: Any] = [
            "title": title,
            "body": body,
            "workspace": workspace,
        ]
        if !tags.isEmpty {
            payload["tags"] = tags
        }
        if let category, !category.isEmpty {
            payload["category"] = category
        }
        if let clientId, !clientId.isEmpty {
            payload["client_id"] = clientId
        }
        let data = try await send(
            method: "POST",
            path: "api/native/v1/notes",
            queryItems: [],
            body: payload,
            accessToken: accessToken
        )
        do {
            return try JSONDecoder().decode(NoteItem.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func notes(workspace: String, accessToken: String) async throws -> NotesPayload {
        let data = try await send(
            method: "GET",
            path: "api/native/v1/notes",
            queryItems: [URLQueryItem(name: "workspace", value: workspace)],
            body: nil,
            accessToken: accessToken
        )
        if data.isEmpty {
            return NotesPayload.empty
        }
        do {
            return try JSONDecoder().decode(NotesPayload.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func people(workspace: String, accessToken: String) async throws -> PeoplePayload {
        let data = try await send(
            method: "GET",
            path: "api/native/v1/people",
            queryItems: [URLQueryItem(name: "workspace", value: workspace)],
            body: nil,
            accessToken: accessToken
        )
        if data.isEmpty {
            return PeoplePayload.empty
        }
        do {
            return try JSONDecoder().decode(PeoplePayload.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    private func send(
        method: String,
        path: String,
        queryItems: [URLQueryItem],
        body: [String: Any]?,
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
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.httpShouldHandleCookies = false
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            do {
                request.httpBody = try JSONSerialization.data(withJSONObject: body)
            } catch {
                throw NativeAPIError.transport("Could not encode the request.")
            }
        }

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
        case 200, 201:
            return data
        case 400:
            let message = (try? JSONDecoder().decode(NativeErrorBody.self, from: data))?.error
            throw NativeAPIError.badRequest(message ?? "Invalid request.")
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
    var status: String?
    var due: String?
    var subtitle: String?
    var clientId: String?
    var clientName: String?

    enum CodingKeys: String, CodingKey {
        case id, title, status, due, subtitle, name, description, body
        case clientId = "client_id"
        case clientName = "client_name"
    }

    init(
        id: String,
        title: String,
        status: String? = nil,
        due: String?,
        subtitle: String?,
        clientId: String? = nil,
        clientName: String? = nil
    ) {
        self.id = id
        self.title = title
        self.status = status
        self.due = due
        self.subtitle = subtitle
        self.clientId = clientId
        self.clientName = clientName
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
        status = try container.decodeIfPresent(String.self, forKey: .status)
        due = try container.decodeIfPresent(String.self, forKey: .due)
        subtitle = try container.decodeIfPresent(String.self, forKey: .subtitle)
            ?? container.decodeIfPresent(String.self, forKey: .description)
            ?? container.decodeIfPresent(String.self, forKey: .body)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
    }

    var isCompleted: Bool {
        switch status?.lowercased() {
        case "completed", "done", "complete":
            true
        default:
            false
        }
    }

    /// Due date plus client name when present.
    var displaySubtitle: String? {
        let dueText = Self.dueLabel(due)
        let client = clientName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if let dueText, !client.isEmpty {
            return "\(dueText) · \(client)"
        }
        if let dueText {
            return dueText
        }
        if !client.isEmpty {
            return client
        }
        return subtitle
    }

    /// Calendar date only. Parse and format in UTC so the day does not shift.
    /// `en_GB` matches the web recorder short label (`Mon 1 Sep`).
    static func dueLabel(_ due: String?) -> String? {
        guard let due, !due.isEmpty else { return nil }
        guard let date = Self.dueParser.date(from: due) else { return due }
        return Self.dueDisplay.string(from: date)
    }

    static func dueDate(from due: String?) -> Date? {
        guard let due, !due.isEmpty else { return nil }
        let parts = due.split(separator: "-")
        guard parts.count == 3,
              let year = Int(parts[0]),
              let month = Int(parts[1]),
              let day = Int(parts[2])
        else {
            return Self.dueParser.date(from: due)
        }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        return calendar.date(from: DateComponents(year: year, month: month, day: day))
    }

    static func dueString(from date: Date) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        guard let year = parts.year, let month = parts.month, let day = parts.day else {
            return Self.dueParser.string(from: date)
        }
        return String(format: "%04d-%02d-%02d", year, month, day)
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

struct ClientsPayload: Decodable, Equatable {
    var items: [ClientItem]

    static let empty = ClientsPayload(items: [])

    enum CodingKeys: String, CodingKey {
        case items, clients
    }

    init(items: [ClientItem]) {
        self.items = items
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let items = try container.decodeIfPresent([ClientItem].self, forKey: .items) {
            self.items = items
        } else if let clients = try container.decodeIfPresent([ClientItem].self, forKey: .clients) {
            self.items = clients
        } else {
            items = []
        }
    }
}

struct ClientContact: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var name: String
    var role: String?
    var email: String?
    var phone: String?
    var isPrimary: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, role, email, phone
        case isPrimary = "is_primary"
        case fullName = "full_name"
    }

    init(
        id: String,
        name: String,
        role: String? = nil,
        email: String? = nil,
        phone: String? = nil,
        isPrimary: Bool = false
    ) {
        self.id = id
        self.name = name
        self.role = role
        self.email = email
        self.phone = phone
        self.isPrimary = isPrimary
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let id = try container.decodeIfPresent(String.self, forKey: .id) {
            self.id = id
        } else {
            id = UUID().uuidString
        }
        let decodedName = try container.decodeIfPresent(String.self, forKey: .name)
            ?? container.decodeIfPresent(String.self, forKey: .fullName)
            ?? ""
        name = decodedName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "Contact"
            : decodedName
        role = try container.decodeIfPresent(String.self, forKey: .role)
        email = try container.decodeIfPresent(String.self, forKey: .email)
        phone = try container.decodeIfPresent(String.self, forKey: .phone)
        isPrimary = try container.decodeIfPresent(Bool.self, forKey: .isPrimary) ?? false
    }

    var displayName: String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Contact" : trimmed
    }

    var displayRole: String? {
        let trimmed = role?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }
}

struct ClientItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var name: String
    var email: String?
    var companyName: String?
    var clientType: String?
    var image: String?
    var logo: String?
    var contacts: [ClientContact]

    enum CodingKeys: String, CodingKey {
        case id, name, email, image, logo, contacts
        case companyName = "company_name"
        case clientType = "client_type"
        case displayName = "display_name"
    }

    init(
        id: String,
        name: String,
        email: String? = nil,
        companyName: String? = nil,
        clientType: String? = nil,
        image: String? = nil,
        logo: String? = nil,
        contacts: [ClientContact] = []
    ) {
        self.id = id
        self.name = name
        self.email = email
        self.companyName = companyName
        self.clientType = clientType
        self.image = image
        self.logo = logo
        self.contacts = contacts
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let id = try container.decodeIfPresent(String.self, forKey: .id) {
            self.id = id
        } else {
            id = UUID().uuidString
        }
        let decodedName = try container.decodeIfPresent(String.self, forKey: .name)
            ?? container.decodeIfPresent(String.self, forKey: .displayName)
            ?? ""
        name = decodedName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "Untitled"
            : decodedName
        email = try container.decodeIfPresent(String.self, forKey: .email)
        companyName = try container.decodeIfPresent(String.self, forKey: .companyName)
        clientType = try container.decodeIfPresent(String.self, forKey: .clientType)
        image = try container.decodeIfPresent(String.self, forKey: .image)
        logo = try container.decodeIfPresent(String.self, forKey: .logo)
        contacts = try container.decodeIfPresent([ClientContact].self, forKey: .contacts) ?? []
    }

    var displayName: String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Untitled" : trimmed
    }

    func matchesSearch(_ query: String) -> Bool {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if needle.isEmpty { return true }
        if displayName.localizedCaseInsensitiveContains(needle) { return true }
        if let companyName, companyName.localizedCaseInsensitiveContains(needle) {
            return true
        }
        if let email, email.localizedCaseInsensitiveContains(needle) {
            return true
        }
        return false
    }

    var displaySubtitle: String? {
        let mail = email?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return mail.isEmpty ? nil : mail
    }

    var displayCompany: String? {
        let company = companyName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if company.isEmpty { return nil }
        if company.caseInsensitiveCompare(displayName) == .orderedSame { return nil }
        return company
    }

    var initials: String {
        let words = displayName.split { $0.isWhitespace || $0 == "-" }.filter { !$0.isEmpty }
        let letters = words.compactMap { word in word.first(where: \.isLetter) }
        switch letters.count {
        case 0:
            return ""
        case 1:
            return String(letters[0]).uppercased()
        default:
            return String([letters[0], letters[1]]).uppercased()
        }
    }

    /// HTTPS logo only. Relative, http, and junk values are ignored.
    var httpsImageURL: URL? {
        Self.httpsURL(image) ?? Self.httpsURL(logo)
    }

    static func httpsURL(_ raw: String?) -> URL? {
        guard let raw,
              let url = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.scheme?.lowercased() == "https"
        else {
            return nil
        }
        return url
    }

    static func mailtoURL(_ email: String) -> URL? {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        var components = URLComponents()
        components.scheme = "mailto"
        components.path = trimmed
        return components.url
    }

    static func telURL(_ phone: String) -> URL? {
        let digits = phone.filter { $0.isNumber || $0 == "+" }
        guard !digits.isEmpty else { return nil }
        return URL(string: "tel:\(digits)")
    }
}

struct NotesPayload: Decodable, Equatable {
    var items: [NoteItem]

    static let empty = NotesPayload(items: [])

    enum CodingKeys: String, CodingKey {
        case items, notes
    }

    init(items: [NoteItem]) {
        self.items = items
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let items = try container.decodeIfPresent([NoteItem].self, forKey: .items) {
            self.items = items
        } else if let notes = try container.decodeIfPresent([NoteItem].self, forKey: .notes) {
            self.items = notes
        } else {
            items = []
        }
    }
}

struct NoteItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var body: String
    var workspace: String?
    var createdAt: String?
    var updatedAt: String?
    var category: String?
    var tags: [String]
    var isPendingSync: Bool
    var clientId: String?

    enum CodingKeys: String, CodingKey {
        case id, title, body, workspace, category, tags
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case clientId = "client_id"
    }

    init(
        id: String,
        title: String,
        body: String,
        workspace: String?,
        createdAt: String?,
        updatedAt: String?,
        category: String? = nil,
        tags: [String] = [],
        isPendingSync: Bool = false,
        clientId: String? = nil
    ) {
        self.id = id
        self.title = title
        self.body = body
        self.workspace = workspace
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.category = category
        self.tags = tags
        self.isPendingSync = isPendingSync
        self.clientId = clientId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let id = try container.decodeIfPresent(String.self, forKey: .id) {
            self.id = id
        } else {
            id = UUID().uuidString
        }
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? ""
        body = try container.decodeIfPresent(String.self, forKey: .body) ?? ""
        workspace = try container.decodeIfPresent(String.self, forKey: .workspace)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        category = try container.decodeIfPresent(String.self, forKey: .category)
        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []
        isPendingSync = false
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
    }

    var isMeetingNote: Bool {
        if category == "meeting_transcript" { return true }
        return tags.contains { $0.caseInsensitiveCompare("meeting") == .orderedSame }
    }

    /// Explicit title, else first non-empty body line, else “Untitled”.
    var displayTitle: String {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedTitle.isEmpty { return trimmedTitle }
        if let line = body.split(whereSeparator: \.isNewline)
            .map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) })
            .first(where: { !$0.isEmpty })
        {
            return line
        }
        return "Untitled"
    }

    /// Truncated body when it adds more than the title; otherwise a relative date.
    var displaySubtitle: String? {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedTitle.isEmpty {
            // Title came from the first body line — subtitle is the rest, else a date.
            let remainder = bodyRemainderAfterFirstLine
            if !remainder.isEmpty { return remainder }
            return Self.relativeDateLabel(updatedAt ?? createdAt)
        }
        let collapsed = collapsedBody
        if !collapsed.isEmpty, collapsed != displayTitle {
            return collapsed
        }
        return Self.relativeDateLabel(updatedAt ?? createdAt)
    }

    var collapsedBody: String {
        bodyLines.joined(separator: " ")
    }

    private var bodyLines: [String] {
        body.split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private var bodyRemainderAfterFirstLine: String {
        bodyLines.dropFirst().joined(separator: " ")
    }

    static func relativeDateLabel(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty, let date = parseISO8601(iso) else { return nil }
        return relativeFormatter.localizedString(for: date, relativeTo: Date())
    }

    static func parseISO8601(_ value: String) -> Date? {
        if let date = isoFractional.date(from: value) { return date }
        return isoBasic.date(from: value)
    }

    private static let isoFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoBasic: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter
    }()
}

struct PeoplePayload: Decodable, Equatable {
    var items: [PersonItem]

    static let empty = PeoplePayload(items: [])

    enum CodingKeys: String, CodingKey {
        case items, people
    }

    init(items: [PersonItem]) {
        self.items = items
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let items = try container.decodeIfPresent([PersonItem].self, forKey: .items) {
            self.items = items
        } else if let people = try container.decodeIfPresent([PersonItem].self, forKey: .people) {
            self.items = people
        } else {
            items = []
        }
    }
}

struct PersonItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var fullName: String
    var nickname: String?
    var relationshipLabel: String?
    var email: String?
    var phone: String?
    var avatarUrl: String?
    var circleTier: String?
    var catchupOverdue: Bool
    var birthdayThisWeek: Bool
    var daysUntilBirthday: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case fullName = "full_name"
        case nickname
        case relationshipLabel = "relationship_label"
        case email, phone
        case avatarUrl = "avatar_url"
        case circleTier = "circle_tier"
        case catchupOverdue = "catchup_overdue"
        case birthdayThisWeek = "birthday_this_week"
        case daysUntilBirthday = "days_until_birthday"
    }

    init(
        id: String,
        fullName: String,
        nickname: String?,
        relationshipLabel: String?,
        email: String?,
        phone: String?,
        avatarUrl: String?,
        circleTier: String?,
        catchupOverdue: Bool,
        birthdayThisWeek: Bool,
        daysUntilBirthday: Int?
    ) {
        self.id = id
        self.fullName = fullName
        self.nickname = nickname
        self.relationshipLabel = relationshipLabel
        self.email = email
        self.phone = phone
        self.avatarUrl = avatarUrl
        self.circleTier = circleTier
        self.catchupOverdue = catchupOverdue
        self.birthdayThisWeek = birthdayThisWeek
        self.daysUntilBirthday = daysUntilBirthday
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let id = try container.decodeIfPresent(String.self, forKey: .id) {
            self.id = id
        } else {
            id = UUID().uuidString
        }
        fullName = try container.decodeIfPresent(String.self, forKey: .fullName) ?? ""
        nickname = try container.decodeIfPresent(String.self, forKey: .nickname)
        relationshipLabel = try container.decodeIfPresent(String.self, forKey: .relationshipLabel)
        email = try container.decodeIfPresent(String.self, forKey: .email)
        phone = try container.decodeIfPresent(String.self, forKey: .phone)
        avatarUrl = try container.decodeIfPresent(String.self, forKey: .avatarUrl)
        circleTier = try container.decodeIfPresent(String.self, forKey: .circleTier)
        catchupOverdue = try container.decodeIfPresent(Bool.self, forKey: .catchupOverdue) ?? false
        birthdayThisWeek = try container.decodeIfPresent(Bool.self, forKey: .birthdayThisWeek) ?? false
        daysUntilBirthday = try container.decodeIfPresent(Int.self, forKey: .daysUntilBirthday)
    }

    /// `full_name`, else nickname, else “Untitled”.
    var displayName: String {
        let full = fullName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !full.isEmpty { return full }
        let nick = nickname?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !nick.isEmpty { return nick }
        return "Untitled"
    }

    var displaySubtitle: String? {
        let relationship = relationshipLabel?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !relationship.isEmpty { return relationship }
        let mail = email?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return mail.isEmpty ? nil : mail
    }

    var initials: String {
        let parts = displayName.split { !$0.isLetter && !$0.isNumber }.filter { !$0.isEmpty }
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        if let first = parts.first, !first.isEmpty {
            return String(first.prefix(min(2, first.count))).uppercased()
        }
        return "?"
    }

    /// Only `https` URLs — never block the list on a missing or custom-scheme photo.
    var httpsAvatarURL: URL? {
        guard let raw = avatarUrl?.trimmingCharacters(in: .whitespacesAndNewlines),
              let url = URL(string: raw),
              url.scheme?.lowercased() == "https"
        else {
            return nil
        }
        return url
    }
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

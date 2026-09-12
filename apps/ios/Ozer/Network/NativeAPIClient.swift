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
        durationMinutes: Int? = nil,
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
        if let durationMinutes = TaskItem.clampDurationMinutes(durationMinutes) {
            body["duration_minutes"] = durationMinutes
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
        durationMinutes: Int? = nil,
        clearDuration: Bool = false,
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
        if clearDuration {
            body["duration_minutes"] = NSNull()
        } else if let durationMinutes = TaskItem.clampDurationMinutes(durationMinutes) {
            body["duration_minutes"] = durationMinutes
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

    func updateNote(
        id: String,
        title: String? = nil,
        body: String? = nil,
        category: String? = nil,
        clientId: String? = nil,
        clearClient: Bool = false,
        accessToken: String
    ) async throws -> NoteItem {
        var payload: [String: Any] = [:]
        if let title {
            payload["title"] = title
        }
        if let body {
            payload["body"] = body
        }
        if let category, !category.isEmpty {
            payload["category"] = category
        }
        if clearClient {
            payload["client_id"] = NSNull()
        } else if let clientId {
            payload["client_id"] = clientId
        }
        let data = try await send(
            method: "PATCH",
            path: "api/native/v1/notes/\(id)",
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

    func createMeeting(
        title: String,
        content: String,
        workspace: String,
        clientId: String,
        meetingDate: String?,
        source: String = "iphone",
        durationSeconds: Int? = nil,
        accessToken: String
    ) async throws -> MeetingItem {
        var payload: [String: Any] = [
            "title": title,
            "content": content,
            "workspace": workspace,
            "client_id": clientId,
            "source": source,
        ]
        if let meetingDate, !meetingDate.isEmpty {
            payload["meeting_date"] = meetingDate
        }
        if let durationSeconds {
            payload["duration_seconds"] = durationSeconds
        }
        let data = try await send(
            method: "POST",
            path: "api/native/v1/meetings",
            queryItems: [],
            body: payload,
            accessToken: accessToken
        )
        do {
            return try JSONDecoder().decode(MeetingItem.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func meetings(workspace: String, accessToken: String) async throws -> MeetingsPayload {
        let data = try await send(
            method: "GET",
            path: "api/native/v1/meetings",
            queryItems: [URLQueryItem(name: "workspace", value: workspace)],
            body: nil,
            accessToken: accessToken
        )
        if data.isEmpty {
            return MeetingsPayload.empty
        }
        do {
            return try JSONDecoder().decode(MeetingsPayload.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func meeting(id: String, workspace: String, accessToken: String) async throws -> MeetingItem {
        let data = try await send(
            method: "GET",
            path: "api/native/v1/meetings/\(id)",
            queryItems: [URLQueryItem(name: "workspace", value: workspace)],
            body: nil,
            accessToken: accessToken
        )
        do {
            return try JSONDecoder().decode(MeetingItem.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func task(id: String, workspace: String, accessToken: String) async throws -> TaskItem {
        let data = try await send(
            method: "GET",
            path: "api/native/v1/tasks/\(id)",
            queryItems: [URLQueryItem(name: "workspace", value: workspace)],
            body: nil,
            accessToken: accessToken
        )
        do {
            return try JSONDecoder().decode(TaskItem.self, from: data)
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

    func invoices(
        workspace: String,
        status: String? = nil,
        accessToken: String
    ) async throws -> InvoicesPayload {
        var query = [URLQueryItem(name: "workspace", value: workspace)]
        if let status, !status.isEmpty, status != "open" {
            query.append(URLQueryItem(name: "status", value: status))
        }
        let data = try await send(
            method: "GET",
            path: "api/native/v1/invoices",
            queryItems: query,
            body: nil,
            accessToken: accessToken
        )
        if data.isEmpty {
            return InvoicesPayload.empty
        }
        do {
            return try JSONDecoder().decode(InvoicesPayload.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func invoice(id: String, workspace: String, accessToken: String) async throws -> InvoiceItem {
        let data = try await send(
            method: "GET",
            path: "api/native/v1/invoices/\(id)",
            queryItems: [URLQueryItem(name: "workspace", value: workspace)],
            body: nil,
            accessToken: accessToken
        )
        do {
            return try JSONDecoder().decode(InvoiceItem.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func finances(workspace: String, accessToken: String) async throws -> FinancesPayload {
        let data = try await send(
            method: "GET",
            path: "api/native/v1/finances",
            queryItems: [URLQueryItem(name: "workspace", value: workspace)],
            body: nil,
            accessToken: accessToken
        )
        if data.isEmpty {
            return FinancesPayload.empty
        }
        do {
            return try JSONDecoder().decode(FinancesPayload.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func registerDevice(
        token: String,
        workspace: String?,
        accessToken: String
    ) async throws {
        var body: [String: Any] = [
            "token": token,
            "platform": "ios",
        ]
        if let workspace, !workspace.isEmpty {
            body["workspace"] = workspace
        }
        _ = try await send(
            method: "POST",
            path: "api/native/v1/devices",
            queryItems: [],
            body: body,
            accessToken: accessToken
        )
    }

    func messageThreads(workspace: String, accessToken: String) async throws -> MessageThreadsPayload {
        let data = try await send(
            method: "GET",
            path: "api/native/v1/messages/threads",
            queryItems: [URLQueryItem(name: "workspace", value: workspace)],
            body: nil,
            accessToken: accessToken
        )
        if data.isEmpty {
            return .empty
        }
        do {
            return try JSONDecoder().decode(MessageThreadsPayload.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func messageThread(id: String, workspace: String, accessToken: String) async throws -> MessageThreadItem {
        let data = try await send(
            method: "GET",
            path: "api/native/v1/messages/threads/\(id)",
            queryItems: [URLQueryItem(name: "workspace", value: workspace)],
            body: nil,
            accessToken: accessToken
        )
        do {
            return try JSONDecoder().decode(MessageThreadItem.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func threadMessages(
        threadId: String,
        workspace: String,
        before: String? = nil,
        accessToken: String
    ) async throws -> ChatMessagesPayload {
        var query = [URLQueryItem(name: "workspace", value: workspace)]
        if let before, !before.isEmpty {
            query.append(URLQueryItem(name: "before", value: before))
        }
        let data = try await send(
            method: "GET",
            path: "api/native/v1/messages/threads/\(threadId)/messages",
            queryItems: query,
            body: nil,
            accessToken: accessToken
        )
        if data.isEmpty {
            return .empty
        }
        do {
            return try JSONDecoder().decode(ChatMessagesPayload.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func createMessageThread(
        workspace: String,
        type: String,
        title: String?,
        jobId: String?,
        clientId: String?,
        memberUserIds: [String],
        contactIds: [String],
        accessToken: String
    ) async throws -> CreatedMessageThread {
        var body: [String: Any] = [
            "workspace": workspace,
            "type": type,
            "member_user_ids": memberUserIds,
            "contact_ids": contactIds,
        ]
        if let title, !title.isEmpty {
            body["title"] = title
        }
        if let jobId, !jobId.isEmpty {
            body["job_id"] = jobId
        }
        if let clientId, !clientId.isEmpty {
            body["client_id"] = clientId
        }
        let data = try await send(
            method: "POST",
            path: "api/native/v1/messages/threads",
            queryItems: [],
            body: body,
            accessToken: accessToken
        )
        do {
            return try JSONDecoder().decode(CreatedMessageThread.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func sendThreadMessage(
        threadId: String,
        workspace: String,
        body: String,
        imageUrl: String?,
        accessToken: String
    ) async throws -> ChatMessageItem {
        var payload: [String: Any] = [
            "workspace": workspace,
            "body": body,
        ]
        if let imageUrl, !imageUrl.isEmpty {
            payload["image_url"] = imageUrl
        }
        let data = try await send(
            method: "POST",
            path: "api/native/v1/messages/threads/\(threadId)/messages",
            queryItems: [],
            body: payload,
            accessToken: accessToken
        )
        do {
            return try JSONDecoder().decode(ChatMessageItem.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func markThreadRead(threadId: String, workspace: String, accessToken: String) async throws {
        _ = try await send(
            method: "POST",
            path: "api/native/v1/messages/threads/\(threadId)/read",
            queryItems: [],
            body: ["workspace": workspace],
            accessToken: accessToken
        )
    }

    func messageCompose(workspace: String, query: String, accessToken: String) async throws -> MessageComposePayload {
        var items = [URLQueryItem(name: "workspace", value: workspace)]
        if !query.isEmpty {
            items.append(URLQueryItem(name: "q", value: query))
        }
        let data = try await send(
            method: "GET",
            path: "api/native/v1/messages/compose",
            queryItems: items,
            body: nil,
            accessToken: accessToken
        )
        if data.isEmpty {
            return .empty
        }
        do {
            return try JSONDecoder().decode(MessageComposePayload.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func uploadMessageImage(
        threadId: String,
        workspace: String,
        imageData: Data,
        filename: String,
        mimeType: String,
        accessToken: String
    ) async throws -> String {
        let data = try await sendMultipart(
            path: "api/native/v1/messages/images",
            workspace: workspace,
            threadId: threadId,
            fileData: imageData,
            filename: filename,
            mimeType: mimeType,
            accessToken: accessToken
        )
        do {
            return try JSONDecoder().decode(UploadedMessageImage.self, from: data).imageUrl
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func taskReview(
        workspace: String,
        source: TaskReviewSource? = nil,
        accessToken: String
    ) async throws -> TaskReviewPayload {
        var query = [URLQueryItem(name: "workspace", value: workspace)]
        if let source {
            query.append(URLQueryItem(name: "source", value: source.rawValue))
        }
        let data = try await send(
            method: "GET",
            path: "api/native/v1/task-review",
            queryItems: query,
            body: nil,
            accessToken: accessToken
        )
        if data.isEmpty {
            return .empty
        }
        do {
            return try JSONDecoder().decode(TaskReviewPayload.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func acceptTaskReview(
        id: String,
        source: TaskReviewSource,
        workspace: String,
        title: String? = nil,
        detail: String? = nil,
        due: String? = nil,
        clearDue: Bool = false,
        durationMinutes: Int? = nil,
        clearDuration: Bool = false,
        clientId: String? = nil,
        clearClient: Bool = false,
        accessToken: String
    ) async throws -> TaskReviewAcceptResult {
        var body: [String: Any] = [
            "workspace": workspace,
            "source": source.rawValue,
        ]
        if let title, !title.isEmpty {
            body["title"] = title
        }
        if let detail {
            body["detail"] = detail.isEmpty ? NSNull() : detail
        }
        if clearDue {
            body["due"] = NSNull()
        } else if let due, !due.isEmpty {
            body["due"] = due
        }
        if clearDuration {
            body["duration_minutes"] = NSNull()
        } else if let durationMinutes = TaskItem.clampDurationMinutes(durationMinutes) {
            body["duration_minutes"] = durationMinutes
        }
        if clearClient {
            body["client_id"] = NSNull()
        } else if let clientId, !clientId.isEmpty {
            body["client_id"] = clientId
        }
        let data = try await send(
            method: "POST",
            path: "api/native/v1/task-review/\(id)/accept",
            queryItems: [],
            body: body,
            accessToken: accessToken
        )
        do {
            return try JSONDecoder().decode(TaskReviewAcceptResult.self, from: data)
        } catch {
            throw NativeAPIError.decoding
        }
    }

    func dismissTaskReview(
        id: String,
        source: TaskReviewSource,
        workspace: String,
        accessToken: String
    ) async throws {
        _ = try await send(
            method: "POST",
            path: "api/native/v1/task-review/\(id)/dismiss",
            queryItems: [],
            body: [
                "workspace": workspace,
                "source": source.rawValue,
            ],
            accessToken: accessToken
        )
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
        case 403:
            let message = (try? JSONDecoder().decode(NativeErrorBody.self, from: data))?.error
            throw NativeAPIError.badRequest(message ?? "You don’t have access.")
        case 404:
            throw NativeAPIError.notFound
        default:
            throw NativeAPIError.http(http.statusCode)
        }
    }

    private func sendMultipart(
        path: String,
        workspace: String,
        threadId: String,
        fileData: Data,
        filename: String,
        mimeType: String,
        accessToken: String
    ) async throws -> Data {
        let url = AppConfiguration.apiBaseURL.appending(path: path)
        let boundary = "ozer-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpShouldHandleCookies = false

        var body = Data()
        func appendField(name: String, value: String) {
            body.append(Data("--\(boundary)\r\n".utf8))
            body.append(Data("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".utf8))
            body.append(Data("\(value)\r\n".utf8))
        }
        appendField(name: "workspace", value: workspace)
        appendField(name: "threadId", value: threadId)
        body.append(Data("--\(boundary)\r\n".utf8))
        body.append(
            Data(
                "Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".utf8
            )
        )
        body.append(Data("Content-Type: \(mimeType)\r\n\r\n".utf8))
        body.append(fileData)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))
        request.httpBody = body

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
        case 403:
            let message = (try? JSONDecoder().decode(NativeErrorBody.self, from: data))?.error
            throw NativeAPIError.badRequest(message ?? "You don’t have access.")
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
    var date: String?
    var dateLabel: String?
    var items: [TodayItem]
    var tasksDueToday: [TaskItem]
    var overdueTasks: [TaskItem]
    var recentNotes: [NoteItem]
    var meetingsToday: [MeetingTodayItem]
    var finances: FinancesPayload?
    var taskReview: TaskReviewCounts?

    static let empty = TodayPayload(
        title: nil,
        greeting: nil,
        message: nil,
        summary: nil,
        date: nil,
        dateLabel: nil,
        items: [],
        tasksDueToday: [],
        overdueTasks: [],
        recentNotes: [],
        meetingsToday: [],
        finances: nil,
        taskReview: .empty
    )

    enum CodingKeys: String, CodingKey {
        case title, greeting, message, summary, items, tasks, cards, date, finances
        case dateLabel = "date_label"
        case tasksDueToday = "tasks_due_today"
        case overdueTasks = "overdue_tasks"
        case recentNotes = "recent_notes"
        case meetingsToday = "meetings_today"
        case taskReview = "task_review"
    }

    init(
        title: String?,
        greeting: String?,
        message: String?,
        summary: String?,
        date: String? = nil,
        dateLabel: String? = nil,
        items: [TodayItem],
        tasksDueToday: [TaskItem] = [],
        overdueTasks: [TaskItem] = [],
        recentNotes: [NoteItem] = [],
        meetingsToday: [MeetingTodayItem] = [],
        finances: FinancesPayload? = nil,
        taskReview: TaskReviewCounts? = nil
    ) {
        self.title = title
        self.greeting = greeting
        self.message = message
        self.summary = summary
        self.date = date
        self.dateLabel = dateLabel
        self.items = items
        self.tasksDueToday = tasksDueToday
        self.overdueTasks = overdueTasks
        self.recentNotes = recentNotes
        self.meetingsToday = meetingsToday
        self.finances = finances
        self.taskReview = taskReview
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        greeting = try container.decodeIfPresent(String.self, forKey: .greeting)
        message = try container.decodeIfPresent(String.self, forKey: .message)
        summary = try container.decodeIfPresent(String.self, forKey: .summary)
        date = try container.decodeIfPresent(String.self, forKey: .date)
        dateLabel = try container.decodeIfPresent(String.self, forKey: .dateLabel)
        tasksDueToday = try container.decodeIfPresent([TaskItem].self, forKey: .tasksDueToday) ?? []
        overdueTasks = try container.decodeIfPresent([TaskItem].self, forKey: .overdueTasks) ?? []
        recentNotes = try container.decodeIfPresent([NoteItem].self, forKey: .recentNotes) ?? []
        meetingsToday = try container.decodeIfPresent([MeetingTodayItem].self, forKey: .meetingsToday) ?? []
        finances = try container.decodeIfPresent(FinancesPayload.self, forKey: .finances)
        taskReview = try container.decodeIfPresent(TaskReviewCounts.self, forKey: .taskReview)

        if !tasksDueToday.isEmpty || !overdueTasks.isEmpty {
            items = Self.mergeHomeItems(
                dueToday: tasksDueToday.map(\.asTodayItem),
                overdue: overdueTasks.map(\.asTodayItem)
            )
        } else if let items = try container.decodeIfPresent([TodayItem].self, forKey: .items) {
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

struct TasksPayload: Codable, Equatable {
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

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(items, forKey: .items)
    }
}

struct TaskItem: Codable, Identifiable, Equatable, Hashable {
    static let maxDurationMinutes = 10_080

    var id: String
    var title: String
    var status: String?
    var due: String?
    var durationMinutes: Int?
    var subtitle: String?
    var clientId: String?
    var clientName: String?

    enum CodingKeys: String, CodingKey {
        case id, title, status, due, subtitle, name, description, body
        case durationMinutes = "duration_minutes"
        case clientId = "client_id"
        case clientName = "client_name"
    }

    init(
        id: String,
        title: String,
        status: String? = nil,
        due: String?,
        durationMinutes: Int? = nil,
        subtitle: String?,
        clientId: String? = nil,
        clientName: String? = nil
    ) {
        self.id = id
        self.title = title
        self.status = status
        self.due = due
        self.durationMinutes = Self.clampDurationMinutes(durationMinutes)
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
        if let value = try? container.decodeIfPresent(Int.self, forKey: .durationMinutes) {
            durationMinutes = Self.clampDurationMinutes(value)
        } else if let value = try? container.decodeIfPresent(Double.self, forKey: .durationMinutes) {
            durationMinutes = Self.clampDurationMinutes(Int(value.rounded()))
        } else {
            durationMinutes = nil
        }
        subtitle = try container.decodeIfPresent(String.self, forKey: .subtitle)
            ?? container.decodeIfPresent(String.self, forKey: .description)
            ?? container.decodeIfPresent(String.self, forKey: .body)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encodeIfPresent(status, forKey: .status)
        try container.encodeIfPresent(due, forKey: .due)
        try container.encodeIfPresent(durationMinutes, forKey: .durationMinutes)
        try container.encodeIfPresent(subtitle, forKey: .subtitle)
        try container.encodeIfPresent(clientId, forKey: .clientId)
        try container.encodeIfPresent(clientName, forKey: .clientName)
    }

    var isCompleted: Bool {
        switch status?.lowercased() {
        case "completed", "done", "complete":
            true
        default:
            false
        }
    }

    var asTodayItem: TodayItem {
        TodayItem(id: id, title: title, subtitle: displaySubtitle)
    }

    var isOverdue: Bool {
        guard let dueDate = Self.dueDate(from: due) else { return false }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        return calendar.startOfDay(for: dueDate) < calendar.startOfDay(for: Date())
    }

    var durationLabel: String? {
        Self.formatDuration(durationMinutes)
    }

    /// Due date, compact duration, and client name when present.
    var displaySubtitle: String? {
        let dueText = Self.dueLabel(due)
        let durationText = durationLabel
        let client = clientName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        var parts: [String] = []
        if let dueText { parts.append(dueText) }
        if let durationText { parts.append(durationText) }
        if !client.isEmpty { parts.append(client) }
        if !parts.isEmpty {
            return parts.joined(separator: " · ")
        }
        return subtitle
    }

    static func clampDurationMinutes(_ value: Int?) -> Int? {
        guard let value, value > 0, value <= maxDurationMinutes else { return nil }
        return value
    }

    static func formatDuration(_ minutes: Int?) -> String? {
        guard let minutes = clampDurationMinutes(minutes) else { return nil }
        let hours = minutes / 60
        let remainder = minutes % 60
        if hours > 0, remainder > 0 {
            return "\(hours)h \(remainder)m"
        }
        if hours > 0 {
            return "\(hours)h"
        }
        return "\(remainder)m"
    }

    static func durationParts(from total: Int?) -> (hours: Int, minutes: Int) {
        guard let total = clampDurationMinutes(total) else { return (0, 0) }
        return (total / 60, total % 60)
    }

    static func combineDuration(hours: Int, minutes: Int) -> Int? {
        guard hours >= 0, minutes >= 0 else { return nil }
        return clampDurationMinutes(hours * 60 + minutes)
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

struct MeetingsPayload: Decodable, Equatable {
    var items: [MeetingItem]
    var upcoming: [UpcomingMeetingItem]

    static let empty = MeetingsPayload(items: [], upcoming: [])

    enum CodingKeys: String, CodingKey {
        case items, meetings, upcoming
    }

    init(items: [MeetingItem], upcoming: [UpcomingMeetingItem] = []) {
        self.items = items
        self.upcoming = upcoming
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let items = try container.decodeIfPresent([MeetingItem].self, forKey: .items) {
            self.items = items
        } else if let meetings = try container.decodeIfPresent([MeetingItem].self, forKey: .meetings) {
            self.items = meetings
        } else {
            items = []
        }
        upcoming = try container.decodeIfPresent([UpcomingMeetingItem].self, forKey: .upcoming) ?? []
    }
}

struct UpcomingMeetingItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var startAt: String
    var inviteeName: String?
    var conferencingUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, title
        case startAt = "start_at"
        case inviteeName = "invitee_name"
        case conferencingUrl = "conferencing_url"
    }

    var whenLabel: String? {
        MeetingDisplay.upcomingWhen(startAt)
    }

    var httpsConferencingURL: URL? {
        guard let raw = conferencingUrl?.trimmingCharacters(in: .whitespacesAndNewlines),
              let url = URL(string: raw),
              let scheme = url.scheme?.lowercased(),
              scheme == "https"
        else {
            return nil
        }
        return url
    }
}

struct MeetingNotes: Decodable, Equatable, Hashable {
    var text: String
    var generatedAt: String?

    enum CodingKeys: String, CodingKey {
        case text
        case generatedAt = "generated_at"
    }

    var trimmedText: String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

struct MeetingTaskItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var due: String?
    var status: String?
    var assigneeName: String?
    var plannerTaskId: String?
    var clientId: String?
    var clientName: String?

    enum CodingKeys: String, CodingKey {
        case id, title, due, status
        case assigneeName = "assignee_name"
        case plannerTaskId = "planner_task_id"
        case clientId = "client_id"
        case clientName = "client_name"
    }

    var canOpenTask: Bool {
        let planner = plannerTaskId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return !planner.isEmpty
    }

    var asTaskItem: TaskItem {
        let planner = plannerTaskId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return TaskItem(
            id: planner.isEmpty ? id : planner,
            title: title,
            status: status,
            due: due,
            subtitle: assigneeName,
            clientId: clientId,
            clientName: clientName
        )
    }

    var displaySubtitle: String? {
        var parts: [String] = []
        if let due = TaskItem.dueLabel(due) {
            parts.append(due)
        }
        let assignee = assigneeName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !assignee.isEmpty {
            parts.append(assignee)
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

struct MeetingItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var content: String
    var workspace: String?
    var clientId: String?
    var clientName: String?
    var meetingDate: String?
    var source: String?
    var durationSeconds: Int?
    var hasExtractedTasks: Bool
    var createdAt: String?
    var updatedAt: String?
    var notes: MeetingNotes?
    var tasks: [MeetingTaskItem]

    enum CodingKeys: String, CodingKey {
        case id, title, content, workspace, source, notes, tasks
        case clientId = "client_id"
        case clientName = "client_name"
        case meetingDate = "meeting_date"
        case durationSeconds = "duration_seconds"
        case hasExtractedTasks = "has_extracted_tasks"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    init(
        id: String,
        title: String,
        content: String,
        workspace: String? = nil,
        clientId: String? = nil,
        clientName: String? = nil,
        meetingDate: String? = nil,
        source: String? = nil,
        durationSeconds: Int? = nil,
        hasExtractedTasks: Bool = false,
        createdAt: String? = nil,
        updatedAt: String? = nil,
        notes: MeetingNotes? = nil,
        tasks: [MeetingTaskItem] = []
    ) {
        self.id = id
        self.title = title
        self.content = content
        self.workspace = workspace
        self.clientId = clientId
        self.clientName = clientName
        self.meetingDate = meetingDate
        self.source = source
        self.durationSeconds = durationSeconds
        self.hasExtractedTasks = hasExtractedTasks
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.notes = notes
        self.tasks = tasks
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let id = try container.decodeIfPresent(String.self, forKey: .id) {
            self.id = id
        } else {
            id = UUID().uuidString
        }
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "Meeting transcript"
        content = try container.decodeIfPresent(String.self, forKey: .content) ?? ""
        workspace = try container.decodeIfPresent(String.self, forKey: .workspace)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
        meetingDate = try container.decodeIfPresent(String.self, forKey: .meetingDate)
        source = try container.decodeIfPresent(String.self, forKey: .source)
        if let value = try? container.decodeIfPresent(Int.self, forKey: .durationSeconds) {
            durationSeconds = value
        } else if let value = try? container.decodeIfPresent(Double.self, forKey: .durationSeconds) {
            durationSeconds = Int(value.rounded())
        } else {
            durationSeconds = nil
        }
        hasExtractedTasks = try container.decodeIfPresent(Bool.self, forKey: .hasExtractedTasks) ?? false
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        notes = try container.decodeIfPresent(MeetingNotes.self, forKey: .notes)
        tasks = try container.decodeIfPresent([MeetingTaskItem].self, forKey: .tasks) ?? []
    }

    var displayTitle: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }
        return SpeakerTurnSplitter.title(from: content, fallback: "Meeting transcript")
    }

    var displayClientName: String? {
        let client = clientName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return client.isEmpty ? nil : client
    }

    var dateTimeLabel: String? {
        MeetingDisplay.dateTimeLabel(meetingDate: meetingDate, instant: createdAt ?? updatedAt)
    }

    var durationLabel: String? {
        MeetingDisplay.durationLabel(seconds: durationSeconds ?? 0)
    }

    var displaySubtitle: String? {
        var parts: [String] = []
        if let client = displayClientName {
            parts.append(client)
        }
        if let date = dateTimeLabel {
            parts.append(date)
        }
        if let duration = durationLabel {
            parts.append(duration)
        }
        if !parts.isEmpty {
            return parts.joined(separator: " · ")
        }
        return NoteItem.relativeDateLabel(updatedAt ?? createdAt)
    }

    func asLocalMeeting() -> LocalMeeting {
        LocalMeeting(
            id: id,
            workspace: workspace ?? "",
            title: displayTitle,
            transcript: content,
            createdAt: createdAt ?? updatedAt ?? OfflineNoteQueue.isoString(from: Date()),
            durationSeconds: max(0, durationSeconds ?? 0),
            audioFileName: nil,
            remoteNoteId: id,
            turns: [],
            clientId: clientId,
            clientName: clientName,
            syncTarget: "meeting"
        )
    }
}

struct NoteCategory: Codable, Identifiable, Equatable, Hashable {
    var slug: String
    var label: String
    var isCustom: Bool

    var id: String { slug }

    enum CodingKeys: String, CodingKey {
        case slug, label
        case isCustom = "is_custom"
    }

    init(slug: String, label: String, isCustom: Bool = false) {
        self.slug = slug
        self.label = label
        self.isCustom = isCustom
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        slug = try container.decode(String.self, forKey: .slug)
        label = try container.decodeIfPresent(String.self, forKey: .label)
            ?? Self.displayLabel(for: slug)
        isCustom = try container.decodeIfPresent(Bool.self, forKey: .isCustom) ?? false
    }

    /// Same system slugs and labels as the web notes picker.
    static let system: [NoteCategory] = [
        NoteCategory(slug: "idea", label: "Idea"),
        NoteCategory(slug: "future", label: "Future"),
        NoteCategory(slug: "development", label: "Development"),
        NoteCategory(slug: "meeting_transcript", label: "Meeting transcript"),
    ]

    static let defaultSlug = "idea"

    static func displayLabel(for slug: String) -> String {
        let trimmed = slug.trimmingCharacters(in: .whitespacesAndNewlines)
        if let system = system.first(where: { $0.slug == trimmed }) {
            return system.label
        }
        return trimmed
            .replacingOccurrences(of: "_", with: " ")
            .split(separator: " ")
            .map(\.localizedCapitalized)
            .joined(separator: " ")
    }

    static func merged(api: [NoteCategory], current: String? = nil) -> [NoteCategory] {
        var items = system
        for extra in api where !items.contains(where: { $0.slug == extra.slug }) {
            items.append(extra)
        }
        let slug = current?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !slug.isEmpty, !items.contains(where: { $0.slug == slug }) {
            items.append(NoteCategory(slug: slug, label: displayLabel(for: slug)))
        }
        return items
    }
}

struct NotesPayload: Codable, Equatable {
    var items: [NoteItem]
    var categories: [NoteCategory]

    static let empty = NotesPayload(items: [], categories: [])

    enum CodingKeys: String, CodingKey {
        case items, notes, categories
    }

    init(items: [NoteItem], categories: [NoteCategory] = []) {
        self.items = items
        self.categories = categories
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
        categories = try container.decodeIfPresent([NoteCategory].self, forKey: .categories) ?? []
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(items, forKey: .items)
        try container.encode(categories, forKey: .categories)
    }
}

struct NoteItem: Codable, Identifiable, Equatable, Hashable {
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
    var clientName: String?

    enum CodingKeys: String, CodingKey {
        case id, title, body, workspace, category, tags
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case clientId = "client_id"
        case clientName = "client_name"
        case isPendingSync
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
        clientId: String? = nil,
        clientName: String? = nil
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
        self.clientName = clientName
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
        isPendingSync = try container.decodeIfPresent(Bool.self, forKey: .isPendingSync) ?? false
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(body, forKey: .body)
        try container.encodeIfPresent(workspace, forKey: .workspace)
        try container.encodeIfPresent(createdAt, forKey: .createdAt)
        try container.encodeIfPresent(updatedAt, forKey: .updatedAt)
        try container.encodeIfPresent(category, forKey: .category)
        try container.encode(tags, forKey: .tags)
        try container.encode(isPendingSync, forKey: .isPendingSync)
        try container.encodeIfPresent(clientId, forKey: .clientId)
        try container.encodeIfPresent(clientName, forKey: .clientName)
    }

    var isMeetingNote: Bool {
        if category == "meeting_transcript" { return true }
        return tags.contains { $0.caseInsensitiveCompare("meeting") == .orderedSame }
    }

    /// Explicit title, else first non-empty body line, else “Untitled”.
    var displayTitle: String {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedTitle.isEmpty { return trimmedTitle }
        if let line = NoteMarkdown.plainText(from: body)
            .split(whereSeparator: \.isNewline)
            .map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) })
            .first(where: { !$0.isEmpty })
        {
            return line
        }
        return "Untitled"
    }

    func categoryLabel(in categories: [NoteCategory]) -> String? {
        let slug = category?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !slug.isEmpty else { return nil }
        return NoteCategory.merged(api: categories, current: slug)
            .first { $0.slug == slug }?
            .label
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
        NoteMarkdown.plainText(from: body)
            .split(whereSeparator: \.isNewline)
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

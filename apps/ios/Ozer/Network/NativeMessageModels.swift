import Foundation

struct MessageThreadsPayload: Decodable, Equatable {
    var items: [MessageThreadItem]

    static let empty = MessageThreadsPayload(items: [])
}

struct MessageThreadParticipant: Decodable, Equatable, Hashable, Identifiable {
    var kind: String
    var userId: String?
    var clientId: String?
    var contactId: String?
    var displayName: String
    var email: String?

    var id: String {
        userId ?? contactId ?? clientId ?? displayName
    }

    enum CodingKeys: String, CodingKey {
        case kind, email
        case userId = "user_id"
        case clientId = "client_id"
        case contactId = "contact_id"
        case displayName = "display_name"
    }
}

struct MessageThreadItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var accountId: String?
    var type: String
    var title: String
    var jobId: String?
    var clientId: String?
    var isClientWide: Bool
    var createdAt: String?
    var updatedAt: String?
    var lastMessageAt: String?
    var unreadCount: Int
    var lastMessagePreview: String?
    var participants: [MessageThreadParticipant]

    enum CodingKeys: String, CodingKey {
        case id, type, title, participants
        case accountId = "account_id"
        case jobId = "job_id"
        case clientId = "client_id"
        case isClientWide = "is_client_wide"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case lastMessageAt = "last_message_at"
        case unreadCount = "unread_count"
        case lastMessagePreview = "last_message_preview"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        accountId = try container.decodeIfPresent(String.self, forKey: .accountId)
        type = try container.decodeIfPresent(String.self, forKey: .type) ?? "group"
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "Conversation"
        jobId = try container.decodeIfPresent(String.self, forKey: .jobId)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        isClientWide = try container.decodeIfPresent(Bool.self, forKey: .isClientWide) ?? false
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        lastMessageAt = try container.decodeIfPresent(String.self, forKey: .lastMessageAt)
        unreadCount = try container.decodeIfPresent(Int.self, forKey: .unreadCount) ?? 0
        lastMessagePreview = try container.decodeIfPresent(String.self, forKey: .lastMessagePreview)
        participants = try container.decodeIfPresent([MessageThreadParticipant].self, forKey: .participants) ?? []
    }

    var previewText: String {
        let preview = lastMessagePreview?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return preview.isEmpty ? "No messages yet" : preview
    }

    var timeLabel: String? {
        NoteItem.relativeDateLabel(lastMessageAt ?? updatedAt ?? createdAt)
    }

    func initials(currentUserId: String?) -> String {
        let names = participants
            .filter { $0.userId != currentUserId }
            .map(\.displayName)
        let source = names.first?.trimmingCharacters(in: .whitespacesAndNewlines)
            ?? title.trimmingCharacters(in: .whitespacesAndNewlines)
        let parts = source.split { !$0.isLetter && !$0.isNumber }.filter { !$0.isEmpty }
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        if let first = parts.first, !first.isEmpty {
            return String(first.prefix(min(2, first.count))).uppercased()
        }
        return "💬"
    }
}

struct ChatMessagesPayload: Decodable, Equatable {
    var items: [ChatMessageItem]

    static let empty = ChatMessagesPayload(items: [])
}

struct ChatMessageAttachment: Decodable, Equatable, Hashable, Identifiable {
    var type: String
    var id: String
    var title: String
    var href: String?
}

struct ChatMessageItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var threadId: String
    var senderUserId: String
    var body: String
    var imageUrl: String?
    var createdAt: String
    var senderLabel: String
    var senderAvatarUrl: String?
    var attachments: [ChatMessageAttachment]
    var isMine: Bool

    enum CodingKeys: String, CodingKey {
        case id, body, attachments
        case threadId = "thread_id"
        case senderUserId = "sender_user_id"
        case imageUrl = "image_url"
        case createdAt = "created_at"
        case senderLabel = "sender_label"
        case senderAvatarUrl = "sender_avatar_url"
        case isMine = "is_mine"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        threadId = try container.decodeIfPresent(String.self, forKey: .threadId) ?? ""
        senderUserId = try container.decodeIfPresent(String.self, forKey: .senderUserId) ?? ""
        body = try container.decodeIfPresent(String.self, forKey: .body) ?? ""
        imageUrl = try container.decodeIfPresent(String.self, forKey: .imageUrl)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        senderLabel = try container.decodeIfPresent(String.self, forKey: .senderLabel) ?? "Someone"
        senderAvatarUrl = try container.decodeIfPresent(String.self, forKey: .senderAvatarUrl)
        attachments = try container.decodeIfPresent([ChatMessageAttachment].self, forKey: .attachments) ?? []
        isMine = try container.decodeIfPresent(Bool.self, forKey: .isMine) ?? false
    }

    var displayBody: String {
        let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }
        if imageUrl != nil { return "Image" }
        if attachments.count == 1 { return attachments[0].title }
        if attachments.count > 1 { return "\(attachments.count) attachments" }
        return ""
    }

    var httpsImageURL: URL? {
        guard let raw = imageUrl?.trimmingCharacters(in: .whitespacesAndNewlines),
              let url = URL(string: raw),
              url.scheme?.lowercased() == "https"
        else {
            return nil
        }
        return url
    }

    var timeLabel: String {
        guard let date = NoteItem.parseISO8601(createdAt) else { return "" }
        return date.formatted(date: .omitted, time: .shortened)
    }
}

struct CreatedMessageThread: Decodable, Equatable {
    var threadId: String

    enum CodingKeys: String, CodingKey {
        case threadId, thread_id, id
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let value = try container.decodeIfPresent(String.self, forKey: .threadId) {
            threadId = value
        } else if let value = try container.decodeIfPresent(String.self, forKey: .thread_id) {
            threadId = value
        } else {
            threadId = try container.decode(String.self, forKey: .id)
        }
    }
}

struct MessageComposePayload: Decodable, Equatable {
    var canMessageClients: Bool
    var items: [MessageComposeOption]

    static let empty = MessageComposePayload(canMessageClients: false, items: [])

    enum CodingKeys: String, CodingKey {
        case items
        case canMessageClients = "can_message_clients"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        canMessageClients = try container.decodeIfPresent(Bool.self, forKey: .canMessageClients) ?? false
        items = try container.decodeIfPresent([MessageComposeOption].self, forKey: .items) ?? []
    }
}

struct MessageComposeOption: Decodable, Identifiable, Equatable, Hashable {
    var kind: String
    var id: String
    var name: String
    var subtitle: String?
    var email: String?

    var symbol: String {
        switch kind {
        case "contact": "person.crop.circle"
        case "client": "building.2"
        case "job": "folder"
        default: "person"
        }
    }

    var kindLabel: String {
        switch kind {
        case "contact": "Contact"
        case "client": "Client"
        case "job": "Project"
        default: "Teammate"
        }
    }
}

struct UploadedMessageImage: Decodable, Equatable {
    var imageUrl: String

    enum CodingKeys: String, CodingKey {
        case imageUrl, image_url
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let value = try container.decodeIfPresent(String.self, forKey: .imageUrl) {
            imageUrl = value
        } else {
            imageUrl = try container.decode(String.self, forKey: .image_url)
        }
    }
}

enum MessageDeepLink {
    static func threadId(from url: URL) -> String? {
        let host = url.host?.lowercased() ?? ""
        let parts = url.pathComponents.filter { $0 != "/" }
        if host == "message" || host == "messages" || host == "thread" || host == "chat" {
            return parts.first
        }
        if let first = parts.first,
           first == "message" || first == "messages" || first == "thread" || first == "chat"
        {
            return parts.dropFirst().first
        }
        return nil
    }

    static func workspace(from url: URL) -> String? {
        URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == "workspace" })?
            .value
    }
}

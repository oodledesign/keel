import Foundation

struct NativeMemoriesPayload: Decodable, Equatable {
    var accountId: String
    var accountSlug: String
    var people: [NativeMemoryPerson]
    var children: [NativeMemoryPerson]
    var memories: [NativeMemoryItem]

    static let empty = NativeMemoriesPayload(
        accountId: "",
        accountSlug: "",
        people: [],
        children: [],
        memories: []
    )

    enum CodingKeys: String, CodingKey {
        case accountId = "account_id"
        case accountSlug = "account_slug"
        case people, children, memories
    }

    init(
        accountId: String,
        accountSlug: String,
        people: [NativeMemoryPerson],
        children: [NativeMemoryPerson],
        memories: [NativeMemoryItem]
    ) {
        self.accountId = accountId
        self.accountSlug = accountSlug
        self.people = people
        self.children = children
        self.memories = memories
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        accountId = try container.decodeIfPresent(String.self, forKey: .accountId) ?? ""
        accountSlug = try container.decodeIfPresent(String.self, forKey: .accountSlug) ?? ""
        people = try container.decodeIfPresent([NativeMemoryPerson].self, forKey: .people) ?? []
        children = try container.decodeIfPresent([NativeMemoryPerson].self, forKey: .children) ?? []
        memories = try container.decodeIfPresent([NativeMemoryItem].self, forKey: .memories) ?? []
    }
}

struct NativeMemoryPerson: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var accountId: String
    var fullName: String
    var displayName: String
    var nickname: String?
    var relationshipLabel: String?
    var isChild: Bool
    var dateOfBirth: String?
    var avatarUrl: String?
    var ageLabel: String?
    var memoryCount: Int

    enum CodingKeys: String, CodingKey {
        case id
        case accountId = "account_id"
        case fullName = "full_name"
        case displayName = "display_name"
        case nickname
        case relationshipLabel = "relationship_label"
        case isChild = "is_child"
        case dateOfBirth = "date_of_birth"
        case avatarUrl = "avatar_url"
        case ageLabel = "age_label"
        case memoryCount = "memory_count"
    }

    init(
        id: String,
        accountId: String = "",
        fullName: String = "",
        displayName: String,
        nickname: String? = nil,
        relationshipLabel: String? = nil,
        isChild: Bool,
        dateOfBirth: String? = nil,
        avatarUrl: String? = nil,
        ageLabel: String? = nil,
        memoryCount: Int = 0
    ) {
        self.id = id
        self.accountId = accountId
        self.fullName = fullName
        self.displayName = displayName
        self.nickname = nickname
        self.relationshipLabel = relationshipLabel
        self.isChild = isChild
        self.dateOfBirth = dateOfBirth
        self.avatarUrl = avatarUrl
        self.ageLabel = ageLabel
        self.memoryCount = memoryCount
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        accountId = try container.decodeIfPresent(String.self, forKey: .accountId) ?? ""
        fullName = try container.decodeIfPresent(String.self, forKey: .fullName) ?? ""
        let decodedDisplay = try container.decodeIfPresent(String.self, forKey: .displayName) ?? ""
        displayName = decodedDisplay.isEmpty
            ? (fullName.isEmpty ? "Untitled" : fullName)
            : decodedDisplay
        nickname = try container.decodeIfPresent(String.self, forKey: .nickname)
        relationshipLabel = try container.decodeIfPresent(String.self, forKey: .relationshipLabel)
        isChild = try container.decodeIfPresent(Bool.self, forKey: .isChild) ?? false
        dateOfBirth = try container.decodeIfPresent(String.self, forKey: .dateOfBirth)
        avatarUrl = try container.decodeIfPresent(String.self, forKey: .avatarUrl)
        ageLabel = try container.decodeIfPresent(String.self, forKey: .ageLabel)
        memoryCount = try container.decodeIfPresent(Int.self, forKey: .memoryCount) ?? 0
    }

    var httpsAvatarURL: URL? {
        guard let avatarUrl,
              let url = URL(string: avatarUrl.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.scheme?.lowercased() == "https"
        else {
            return nil
        }
        return url
    }

    var initials: String {
        MemoryDisplay.initials(displayName)
    }

    var subtitle: String {
        let age = ageLabel ?? "Add a birthday"
        return "\(age) · \(MemoryDisplay.memoryCountLabel(memoryCount))"
    }
}

struct NativeMemoryItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var content: String
    var occurredOn: String
    var kind: String?
    var childIds: [String]
    var children: [NativeMemoryLinkedChild]
    var media: [NativeMemoryMedia]
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, content, kind, children, media
        case occurredOn = "occurred_on"
        case childIds = "child_ids"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    init(
        id: String,
        title: String,
        content: String,
        occurredOn: String,
        kind: String? = nil,
        childIds: [String] = [],
        children: [NativeMemoryLinkedChild] = [],
        media: [NativeMemoryMedia] = [],
        createdAt: String = "",
        updatedAt: String = ""
    ) {
        self.id = id
        self.title = title
        self.content = content
        self.occurredOn = occurredOn
        self.kind = kind
        self.childIds = childIds
        self.children = children
        self.media = media
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? ""
        content = try container.decodeIfPresent(String.self, forKey: .content) ?? ""
        occurredOn = try container.decodeIfPresent(String.self, forKey: .occurredOn) ?? ""
        kind = try container.decodeIfPresent(String.self, forKey: .kind)
        childIds = try container.decodeIfPresent([String].self, forKey: .childIds) ?? []
        children = try container.decodeIfPresent([NativeMemoryLinkedChild].self, forKey: .children) ?? []
        media = try container.decodeIfPresent([NativeMemoryMedia].self, forKey: .media) ?? []
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt) ?? ""
    }

    var kindLabel: String? {
        MemoryKind.parse(kind)?.label
    }

    var previewVisual: NativeMemoryMedia? {
        media.first(where: { $0.kind == .image || $0.kind == .video || ($0.mimeType ?? "").hasPrefix("image/") || ($0.mimeType ?? "").hasPrefix("video/") })
    }

    var previewPhotoURL: URL? {
        media.first(where: { $0.resolvedKind == .image })?.httpsURL
            ?? media.first(where: { ($0.mimeType ?? "").hasPrefix("image/") })?.httpsURL
    }

    var extraMediaCount: Int {
        max(0, media.filter { $0.resolvedKind != .audio }.count - 1)
    }

    var audioItems: [NativeMemoryMedia] {
        media.filter { $0.resolvedKind == .audio }
    }

    var displayTitle: String? {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

struct NativeMemoryLinkedChild: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var displayName: String
    var avatarUrl: String?
    var ageLabel: String?

    enum CodingKeys: String, CodingKey {
        case id
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case ageLabel = "age_label"
    }

    init(id: String, displayName: String, avatarUrl: String? = nil, ageLabel: String? = nil) {
        self.id = id
        self.displayName = displayName
        self.avatarUrl = avatarUrl
        self.ageLabel = ageLabel
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        displayName = try container.decodeIfPresent(String.self, forKey: .displayName) ?? ""
        avatarUrl = try container.decodeIfPresent(String.self, forKey: .avatarUrl)
        ageLabel = try container.decodeIfPresent(String.self, forKey: .ageLabel)
    }

    var httpsAvatarURL: URL? {
        guard let avatarUrl,
              let url = URL(string: avatarUrl.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.scheme?.lowercased() == "https"
        else {
            return nil
        }
        return url
    }

    var initials: String {
        MemoryDisplay.initials(displayName)
    }
}

struct NativeMemoryMedia: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var mimeType: String?
    var url: String?
    var kind: MemoryMediaKind?

    enum CodingKeys: String, CodingKey {
        case id, title, url, kind
        case mimeType = "mime_type"
    }

    init(
        id: String,
        title: String,
        mimeType: String? = nil,
        url: String? = nil,
        kind: MemoryMediaKind? = nil
    ) {
        self.id = id
        self.title = title
        self.mimeType = mimeType
        self.url = url
        self.kind = kind
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? ""
        mimeType = try container.decodeIfPresent(String.self, forKey: .mimeType)
        url = try container.decodeIfPresent(String.self, forKey: .url)
        if let raw = try container.decodeIfPresent(String.self, forKey: .kind) {
            kind = MemoryMediaKind(rawValue: raw)
        } else {
            kind = MemoryMedia.kind(mimeType: mimeType, filename: title)
        }
    }

    var resolvedKind: MemoryMediaKind? {
        kind ?? MemoryMedia.kind(mimeType: mimeType, filename: title)
    }

    var httpsURL: URL? {
        guard let url,
              let parsed = URL(string: url.trimmingCharacters(in: .whitespacesAndNewlines)),
              parsed.scheme?.lowercased() == "https"
        else {
            return nil
        }
        return parsed
    }
}

struct NativeMemoryWriteResult: Decodable, Equatable {
    var id: String
    var ok: Bool

    init(id: String, ok: Bool = true) {
        self.id = id
        self.ok = ok
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
            ?? container.decodeIfPresent(String.self, forKey: .noteId)
            ?? ""
        ok = try container.decodeIfPresent(Bool.self, forKey: .ok) ?? !id.isEmpty
    }

    enum CodingKeys: String, CodingKey {
        case id, ok
        case noteId = "note_id"
    }
}

struct NativeMemoryPhotoResult: Decodable, Equatable {
    var id: String
    var title: String
    var mimeType: String?
    var url: String?
    var kind: String?

    enum CodingKeys: String, CodingKey {
        case id, title, url, kind
        case mimeType = "mime_type"
    }
}

struct NativeMemoryMediaPrepare: Decodable, Equatable {
    var bucket: String
    var path: String
    var token: String
    var signedUrl: String
    var mimeType: String?
    var maxBytes: Int?

    enum CodingKeys: String, CodingKey {
        case bucket, path, token
        case signedUrl = "signed_url"
        case mimeType = "mime_type"
        case maxBytes = "max_bytes"
    }
}

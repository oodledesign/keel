import Foundation

struct SurveysPayload: Decodable, Equatable {
    var items: [SurveyItem]

    static let empty = SurveysPayload(items: [])
}

struct SurveyItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var workspace: String?
    var status: String
    var surveyType: String
    var surveyTypeLabel: String
    var clientId: String?
    var clientName: String?
    var sessionCount: Int
    var photoCount: Int
    var createdAt: String?
    var updatedAt: String?
    var isLocal: Bool

    var typeLabel: String {
        surveyTypeLabel.isEmpty ? SurveyTypeOption.parse(surveyType).label : surveyTypeLabel
    }

    enum CodingKeys: String, CodingKey {
        case id, title, workspace, status
        case surveyType = "survey_type"
        case surveyTypeLabel = "survey_type_label"
        case clientId = "client_id"
        case clientName = "client_name"
        case sessionCount = "session_count"
        case photoCount = "photo_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case isLocal = "is_local"
    }

    init(
        id: String,
        title: String,
        workspace: String? = nil,
        status: String = "draft",
        surveyType: String = SurveyTypeOption.default.rawValue,
        surveyTypeLabel: String = SurveyTypeOption.default.label,
        clientId: String? = nil,
        clientName: String? = nil,
        sessionCount: Int = 0,
        photoCount: Int = 0,
        createdAt: String? = nil,
        updatedAt: String? = nil,
        isLocal: Bool = false
    ) {
        self.id = id
        self.title = title
        self.workspace = workspace
        self.status = status
        self.surveyType = surveyType
        self.surveyTypeLabel = surveyTypeLabel
        self.clientId = clientId
        self.clientName = clientName
        self.sessionCount = sessionCount
        self.photoCount = photoCount
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.isLocal = isLocal
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "Building survey"
        workspace = try container.decodeIfPresent(String.self, forKey: .workspace)
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "draft"
        surveyType = try container.decodeIfPresent(String.self, forKey: .surveyType)
            ?? SurveyTypeOption.default.rawValue
        surveyTypeLabel = try container.decodeIfPresent(String.self, forKey: .surveyTypeLabel)
            ?? SurveyTypeOption.parse(surveyType).label
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
        sessionCount = try container.decodeIfPresent(Int.self, forKey: .sessionCount) ?? 0
        photoCount = try container.decodeIfPresent(Int.self, forKey: .photoCount) ?? 0
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        isLocal = try container.decodeIfPresent(Bool.self, forKey: .isLocal) ?? false
    }
}

struct SurveySessionItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var content: String
    var durationSeconds: Int?
    var source: String?
    var meetingDate: String?
    var createdAt: String?
    var isPending: Bool

    enum CodingKeys: String, CodingKey {
        case id, title, content, source
        case durationSeconds = "duration_seconds"
        case meetingDate = "meeting_date"
        case createdAt = "created_at"
    }

    init(
        id: String,
        title: String,
        content: String,
        durationSeconds: Int? = nil,
        source: String? = nil,
        meetingDate: String? = nil,
        createdAt: String? = nil,
        isPending: Bool = false
    ) {
        self.id = id
        self.title = title
        self.content = content
        self.durationSeconds = durationSeconds
        self.source = source
        self.meetingDate = meetingDate
        self.createdAt = createdAt
        self.isPending = isPending
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "Site notes"
        content = try container.decodeIfPresent(String.self, forKey: .content) ?? ""
        durationSeconds = try container.decodeIfPresent(Int.self, forKey: .durationSeconds)
        source = try container.decodeIfPresent(String.self, forKey: .source)
        meetingDate = try container.decodeIfPresent(String.self, forKey: .meetingDate)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        isPending = false
    }
}

struct SurveyPhotoItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var mimeType: String?
    var createdAt: String?
    var previewUrl: String?
    var isPending: Bool

    enum CodingKeys: String, CodingKey {
        case id, title
        case mimeType = "mime_type"
        case createdAt = "created_at"
        case previewUrl = "preview_url"
    }

    init(
        id: String,
        title: String,
        mimeType: String? = nil,
        createdAt: String? = nil,
        previewUrl: String? = nil,
        isPending: Bool = false
    ) {
        self.id = id
        self.title = title
        self.mimeType = mimeType
        self.createdAt = createdAt
        self.previewUrl = previewUrl
        self.isPending = isPending
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "Survey photo"
        mimeType = try container.decodeIfPresent(String.self, forKey: .mimeType)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        previewUrl = try container.decodeIfPresent(String.self, forKey: .previewUrl)
        isPending = false
    }
}

struct SurveyDetailPayload: Decodable, Equatable {
    var survey: SurveyItem
    var sessions: [SurveySessionItem]
    var photos: [SurveyPhotoItem]

    enum CodingKeys: String, CodingKey {
        case id, title, workspace, status, sessions, photos
        case surveyType = "survey_type"
        case surveyTypeLabel = "survey_type_label"
        case clientId = "client_id"
        case clientName = "client_name"
        case sessionCount = "session_count"
        case photoCount = "photo_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let id = try container.decode(String.self, forKey: .id)
        survey = SurveyItem(
            id: id,
            title: try container.decodeIfPresent(String.self, forKey: .title) ?? "Building survey",
            workspace: try container.decodeIfPresent(String.self, forKey: .workspace),
            status: try container.decodeIfPresent(String.self, forKey: .status) ?? "draft",
            surveyType: try container.decodeIfPresent(String.self, forKey: .surveyType)
                ?? SurveyTypeOption.default.rawValue,
            surveyTypeLabel: try container.decodeIfPresent(String.self, forKey: .surveyTypeLabel)
                ?? SurveyTypeOption.default.label,
            clientId: try container.decodeIfPresent(String.self, forKey: .clientId),
            clientName: try container.decodeIfPresent(String.self, forKey: .clientName),
            sessionCount: try container.decodeIfPresent(Int.self, forKey: .sessionCount) ?? 0,
            photoCount: try container.decodeIfPresent(Int.self, forKey: .photoCount) ?? 0,
            createdAt: try container.decodeIfPresent(String.self, forKey: .createdAt),
            updatedAt: try container.decodeIfPresent(String.self, forKey: .updatedAt)
        )
        sessions = try container.decodeIfPresent([SurveySessionItem].self, forKey: .sessions) ?? []
        photos = try container.decodeIfPresent([SurveyPhotoItem].self, forKey: .photos) ?? []
    }
}

struct SurveySessionUploadResult: Decodable, Equatable {
    var session: SurveySessionItem
    var groupingSource: String?

    enum CodingKeys: String, CodingKey {
        case session
        case groupingSource = "grouping_source"
    }
}

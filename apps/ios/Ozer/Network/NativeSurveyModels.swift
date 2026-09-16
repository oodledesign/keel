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
    var surveyLevel: Int
    var propertyAddress: String?
    var propertyPostcode: String?
    var createdAt: String?
    var updatedAt: String?
    var isLocal: Bool

    var displayAddress: String {
        let stored = propertyAddress?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return stored.isEmpty ? title : stored
    }

    /// Prep responses omit client / counts — keep the local row and take address fields only.
    func mergingAddress(from other: SurveyItem) -> SurveyItem {
        var copy = self
        copy.title = other.title
        copy.propertyAddress = other.propertyAddress ?? other.title
        copy.propertyPostcode = other.propertyPostcode
        copy.updatedAt = other.updatedAt ?? copy.updatedAt
        return copy
    }

    var typeLabel: String {
        surveyTypeLabel.isEmpty ? SurveyTypeOption.parse(surveyType).label : surveyTypeLabel
    }

    var resolvedSurveyLevel: Int {
        surveyLevel == 3 ? 3 : 2
    }

    enum CodingKeys: String, CodingKey {
        case id, title, workspace, status
        case surveyType = "survey_type"
        case surveyTypeLabel = "survey_type_label"
        case clientId = "client_id"
        case clientName = "client_name"
        case sessionCount = "session_count"
        case photoCount = "photo_count"
        case surveyLevel = "survey_level"
        case propertyAddress = "survey_property_address"
        case propertyPostcode = "survey_property_postcode"
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
        surveyLevel: Int? = nil,
        propertyAddress: String? = nil,
        propertyPostcode: String? = nil,
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
        self.surveyLevel = surveyLevel ?? SurveyDisplay.surveyLevel(from: surveyType)
        self.propertyAddress = propertyAddress
        self.propertyPostcode = propertyPostcode
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
        let decodedLevel = try container.decodeIfPresent(Int.self, forKey: .surveyLevel)
        propertyAddress = try container.decodeIfPresent(String.self, forKey: .propertyAddress)
        propertyPostcode = try container.decodeIfPresent(String.self, forKey: .propertyPostcode)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        isLocal = try container.decodeIfPresent(Bool.self, forKey: .isLocal) ?? false
        surveyLevel = decodedLevel == 3 ? 3 : SurveyDisplay.surveyLevel(from: surveyType)
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
    var ricsCode: String?
    var sectionKey: String?
    var isPending: Bool

    enum CodingKeys: String, CodingKey {
        case id, title, content, source
        case durationSeconds = "duration_seconds"
        case meetingDate = "meeting_date"
        case createdAt = "created_at"
        case ricsCode = "rics_code"
        case sectionKey = "section_key"
    }

    init(
        id: String,
        title: String,
        content: String,
        durationSeconds: Int? = nil,
        source: String? = nil,
        meetingDate: String? = nil,
        createdAt: String? = nil,
        ricsCode: String? = nil,
        sectionKey: String? = nil,
        isPending: Bool = false
    ) {
        self.id = id
        self.title = title
        self.content = content
        self.durationSeconds = durationSeconds
        self.source = source
        self.meetingDate = meetingDate
        self.createdAt = createdAt
        self.ricsCode = ricsCode
        self.sectionKey = sectionKey
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
        ricsCode = try container.decodeIfPresent(String.self, forKey: .ricsCode)
        sectionKey = try container.decodeIfPresent(String.self, forKey: .sectionKey)
        isPending = false
    }
}

struct SurveyPhotoItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var mimeType: String?
    var createdAt: String?
    var previewUrl: String?
    var ricsCode: String?
    var sectionKey: String?
    var isPending: Bool

    enum CodingKeys: String, CodingKey {
        case id, title
        case mimeType = "mime_type"
        case createdAt = "created_at"
        case previewUrl = "preview_url"
        case ricsCode = "rics_code"
        case sectionKey = "section_key"
    }

    init(
        id: String,
        title: String,
        mimeType: String? = nil,
        createdAt: String? = nil,
        previewUrl: String? = nil,
        ricsCode: String? = nil,
        sectionKey: String? = nil,
        isPending: Bool = false
    ) {
        self.id = id
        self.title = title
        self.mimeType = mimeType
        self.createdAt = createdAt
        self.previewUrl = previewUrl
        self.ricsCode = ricsCode
        self.sectionKey = sectionKey
        self.isPending = isPending
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "Survey photo"
        mimeType = try container.decodeIfPresent(String.self, forKey: .mimeType)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        previewUrl = try container.decodeIfPresent(String.self, forKey: .previewUrl)
        ricsCode = try container.decodeIfPresent(String.self, forKey: .ricsCode)
        sectionKey = try container.decodeIfPresent(String.self, forKey: .sectionKey)
        isPending = false
    }
}

struct SurveySectionItem: Decodable, Identifiable, Equatable, Hashable {
    var key: String
    var heading: String
    var group: String
    var letter: String
    var ricsCode: String
    var label: String
    var allowsPhotos: Bool
    var note: String
    var photoCount: Int

    var id: String { ricsCode.isEmpty ? key : ricsCode }

    var displayLabel: String {
        if !label.isEmpty { return label }
        return SurveySectionCatalogue.displayLabel(
            heading: heading,
            ricsCode: ricsCode,
            letter: letter
        )
    }

    enum CodingKeys: String, CodingKey {
        case key, heading, group, letter, label, note
        case ricsCode = "rics_code"
        case allowsPhotos = "allows_photos"
        case photoCount = "photo_count"
    }

    init(
        key: String,
        heading: String,
        group: String,
        letter: String,
        ricsCode: String,
        label: String = "",
        allowsPhotos: Bool = true,
        note: String = "",
        photoCount: Int = 0
    ) {
        self.key = key
        self.heading = heading
        self.group = group
        self.letter = letter
        self.ricsCode = ricsCode
        self.label = label.isEmpty
            ? SurveySectionCatalogue.displayLabel(heading: heading, ricsCode: ricsCode, letter: letter)
            : label
        self.allowsPhotos = allowsPhotos
        self.note = note
        self.photoCount = photoCount
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        key = try container.decode(String.self, forKey: .key)
        heading = try container.decodeIfPresent(String.self, forKey: .heading) ?? key
        group = try container.decodeIfPresent(String.self, forKey: .group) ?? ""
        letter = try container.decodeIfPresent(String.self, forKey: .letter) ?? ""
        ricsCode = try container.decodeIfPresent(String.self, forKey: .ricsCode) ?? key
        let decodedLabel = try container.decodeIfPresent(String.self, forKey: .label) ?? ""
        label = decodedLabel.isEmpty
            ? SurveySectionCatalogue.displayLabel(heading: heading, ricsCode: ricsCode, letter: letter)
            : decodedLabel
        allowsPhotos = try container.decodeIfPresent(Bool.self, forKey: .allowsPhotos) ?? true
        note = try container.decodeIfPresent(String.self, forKey: .note) ?? ""
        photoCount = try container.decodeIfPresent(Int.self, forKey: .photoCount) ?? 0
    }

    static func fromCatalogue(_ item: SurveySectionDefinition, note: String = "", photoCount: Int = 0) -> SurveySectionItem {
        SurveySectionItem(
            key: item.key,
            heading: item.heading,
            group: item.group,
            letter: item.letter,
            ricsCode: item.ricsCode,
            label: item.label,
            allowsPhotos: item.allowsPhotos,
            note: note,
            photoCount: photoCount
        )
    }
}

struct SurveyDetailPayload: Decodable, Equatable {
    var survey: SurveyItem
    var sessions: [SurveySessionItem]
    var photos: [SurveyPhotoItem]
    var sections: [SurveySectionItem]

    enum CodingKeys: String, CodingKey {
        case id, title, workspace, status, sessions, photos, sections
        case surveyType = "survey_type"
        case surveyTypeLabel = "survey_type_label"
        case clientId = "client_id"
        case clientName = "client_name"
        case sessionCount = "session_count"
        case photoCount = "photo_count"
        case surveyLevel = "survey_level"
        case propertyAddress = "survey_property_address"
        case propertyPostcode = "survey_property_postcode"
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
            surveyLevel: try container.decodeIfPresent(Int.self, forKey: .surveyLevel),
            propertyAddress: try container.decodeIfPresent(String.self, forKey: .propertyAddress),
            propertyPostcode: try container.decodeIfPresent(String.self, forKey: .propertyPostcode),
            createdAt: try container.decodeIfPresent(String.self, forKey: .createdAt),
            updatedAt: try container.decodeIfPresent(String.self, forKey: .updatedAt)
        )
        sessions = try container.decodeIfPresent([SurveySessionItem].self, forKey: .sessions) ?? []
        photos = try container.decodeIfPresent([SurveyPhotoItem].self, forKey: .photos) ?? []
        sections = try container.decodeIfPresent([SurveySectionItem].self, forKey: .sections) ?? []
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

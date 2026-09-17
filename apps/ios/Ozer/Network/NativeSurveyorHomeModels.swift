import Foundation

struct SurveyorHomePayload: Decodable, Equatable {
    var openCount: Int
    var enquiryCount: Int
    var bookedCount: Int
    var surveyedCount: Int
    var recentSurveys: [SurveyorHomeSurvey]
    var pipeline: [SurveyorHomeDeal]

    static let empty = SurveyorHomePayload(
        openCount: 0,
        enquiryCount: 0,
        bookedCount: 0,
        surveyedCount: 0,
        recentSurveys: [],
        pipeline: []
    )

    enum CodingKeys: String, CodingKey {
        case openCount = "open_count"
        case enquiryCount = "enquiry_count"
        case bookedCount = "booked_count"
        case surveyedCount = "surveyed_count"
        case recentSurveys = "recent_surveys"
        case pipeline
    }

    init(
        openCount: Int,
        enquiryCount: Int,
        bookedCount: Int,
        surveyedCount: Int,
        recentSurveys: [SurveyorHomeSurvey],
        pipeline: [SurveyorHomeDeal]
    ) {
        self.openCount = openCount
        self.enquiryCount = enquiryCount
        self.bookedCount = bookedCount
        self.surveyedCount = surveyedCount
        self.recentSurveys = recentSurveys
        self.pipeline = pipeline
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        openCount = try container.decodeIfPresent(Int.self, forKey: .openCount) ?? 0
        enquiryCount = try container.decodeIfPresent(Int.self, forKey: .enquiryCount) ?? 0
        bookedCount = try container.decodeIfPresent(Int.self, forKey: .bookedCount) ?? 0
        surveyedCount = try container.decodeIfPresent(Int.self, forKey: .surveyedCount) ?? 0
        recentSurveys = try container.decodeIfPresent([SurveyorHomeSurvey].self, forKey: .recentSurveys) ?? []
        pipeline = try container.decodeIfPresent([SurveyorHomeDeal].self, forKey: .pipeline) ?? []
    }
}

struct SurveyorHomeSurvey: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var status: String
    var updatedAt: String?
    var clientName: String?

    enum CodingKeys: String, CodingKey {
        case id, title, status
        case updatedAt = "updated_at"
        case clientName = "client_name"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "Untitled survey"
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "draft"
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
    }

    var asSurveyItem: SurveyItem {
        SurveyItem(
            id: id,
            title: title,
            status: status,
            clientName: clientName,
            updatedAt: updatedAt
        )
    }

    var subtitle: String {
        let date = updatedAt.flatMap { NoteItem.parseISO8601($0) }
            .map { SurveyDisplay.dayFormatter.string(from: $0) }
        return [clientName, date]
            .compactMap { value in
                let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                return trimmed.isEmpty ? nil : trimmed
            }
            .joined(separator: " · ")
    }
}

struct SurveyorHomeDeal: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var stage: String
    var stageLabel: String
    var clientName: String?

    enum CodingKeys: String, CodingKey {
        case id, title, stage
        case stageLabel = "stage_label"
        case clientName = "client_name"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "Untitled"
        stage = try container.decodeIfPresent(String.self, forKey: .stage) ?? ""
        stageLabel = try container.decodeIfPresent(String.self, forKey: .stageLabel) ?? stage
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
    }
}

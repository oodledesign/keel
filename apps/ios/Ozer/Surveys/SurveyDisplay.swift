import Foundation

enum SurveyTypeOption: String, CaseIterable, Identifiable, Codable, Equatable {
    case ricsHssL1 = "rics_hss_l1"
    case ricsHssL2 = "rics_hss_l2"
    case ricsHssL3 = "rics_hss_l3"
    case commercialCondition = "commercial_condition"
    case dilapidations = "dilapidations"
    case ppm = "ppm"
    case fireRisk = "fire_risk"
    case partyWall = "party_wall"
    case structural = "structural"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .ricsHssL1: return "RICS Home Survey Level 1"
        case .ricsHssL2: return "RICS Home Survey Level 2"
        case .ricsHssL3: return "RICS Home Survey Level 3"
        case .commercialCondition: return "Commercial condition"
        case .dilapidations: return "Dilapidations"
        case .ppm: return "Planned preventative maintenance"
        case .fireRisk: return "Fire risk assessment"
        case .partyWall: return "Party wall"
        case .structural: return "Structural"
        }
    }

    static let `default`: SurveyTypeOption = .ricsHssL2

    var surveyLevel: Int {
        self == .ricsHssL3 ? 3 : 2
    }

    static func parse(_ raw: String?) -> SurveyTypeOption {
        guard let raw, let match = SurveyTypeOption(rawValue: raw) else {
            return .default
        }
        return match
    }
}

enum SurveyQueueStatus: Equatable {
    case onlineSynced
    case onlinePending(Int)
    case offlinePending(Int)
    case failed(String)

    var banner: String {
        switch self {
        case .onlineSynced:
            return "Online · recordings will upload straight away"
        case .onlinePending(let count):
            return count == 1
                ? "Online · 1 item waiting to upload"
                : "Online · \(count) items waiting to upload"
        case .offlinePending(let count):
            return count == 0
                ? "Offline · recordings stay on this iPhone"
                : count == 1
                    ? "Offline · 1 item queued until you reconnect"
                    : "Offline · \(count) items queued until you reconnect"
        case .failed(let message):
            return message
        }
    }
}

enum SurveyDisplay {
    static func surveyLevel(from surveyType: String?) -> Int {
        SurveyTypeOption.parse(surveyType).surveyLevel
    }

    static func appendNote(existing: String, incoming: String) -> String {
        let current = existing.trimmingCharacters(in: .whitespacesAndNewlines)
        let next = incoming.trimmingCharacters(in: .whitespacesAndNewlines)
        if current.isEmpty { return next }
        if next.isEmpty { return current }
        return "\(current)\n\n\(next)"
    }

    static func accumulatedNote(remote: String, pendingBodies: [String]) -> String {
        pendingBodies.reduce(remote) { appendNote(existing: $0, incoming: $1) }
    }

    static func sessionTitle(from transcript: String, on date: Date, fallback: String = "Site notes") -> String {
        let first = transcript
            .split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty && !$0.hasPrefix("#") }
        if let first, first.count >= 8 {
            return String(first.prefix(80))
        }
        return "\(fallback), \(dayFormatter.string(from: date))"
    }

    static func queueStatus(isOnline: Bool, pendingCount: Int, lastError: String?) -> SurveyQueueStatus {
        if let lastError, !lastError.isEmpty {
            return .failed(lastError)
        }
        if isOnline {
            return pendingCount > 0 ? .onlinePending(pendingCount) : .onlineSynced
        }
        return .offlinePending(pendingCount)
    }

    static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_GB")
        formatter.dateFormat = "d MMM yyyy"
        return formatter
    }()
}

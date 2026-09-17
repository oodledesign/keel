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

enum SurveyStatusTone: Equatable {
    case draft
    case inProgress
    case sent
    case read
    case approved
    case declined
    case archived
    case unknown
}

struct SurveyStatusPresentation: Equatable {
    var label: String
    var tone: SurveyStatusTone
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

    /// Survey reports reuse `proposals.status` (`draft`, `sent`, `read`,
    /// `approved`, `declined`). Aliases cover in progress / published / archived.
    static func statusPresentation(for raw: String?) -> SurveyStatusPresentation {
        let key = statusKey(raw)
        switch key {
        case "draft":
            return SurveyStatusPresentation(label: "Draft", tone: .draft)
        case "in_progress", "inprogress":
            return SurveyStatusPresentation(label: "In progress", tone: .inProgress)
        case "sent":
            return SurveyStatusPresentation(label: "Sent", tone: .sent)
        case "published":
            return SurveyStatusPresentation(label: "Published", tone: .sent)
        case "read":
            return SurveyStatusPresentation(label: "Read", tone: .read)
        case "approved":
            return SurveyStatusPresentation(label: "Approved", tone: .approved)
        case "declined":
            return SurveyStatusPresentation(label: "Declined", tone: .declined)
        case "archived":
            return SurveyStatusPresentation(label: "Archived", tone: .archived)
        default:
            let fallback = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if fallback.isEmpty {
                return SurveyStatusPresentation(label: "Draft", tone: .draft)
            }
            return SurveyStatusPresentation(label: titleCaseStatus(fallback), tone: .unknown)
        }
    }

    private static func statusKey(_ raw: String?) -> String {
        (raw ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "'", with: "")
            .replacingOccurrences(of: "’", with: "")
            .replacingOccurrences(of: "[^a-z0-9]+", with: "_", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
    }

    private static func titleCaseStatus(_ raw: String) -> String {
        raw
            .replacingOccurrences(of: "[_-]+", with: " ", options: .regularExpression)
            .split(separator: " ")
            .map { part in
                let word = String(part)
                guard let first = word.first else { return word }
                return String(first).uppercased() + word.dropFirst().lowercased()
            }
            .joined(separator: " ")
    }

    static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_GB")
        formatter.dateFormat = "d MMM yyyy"
        return formatter
    }()
}

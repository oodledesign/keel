import Foundation

enum MeetingDisplay {
    static func durationLabel(seconds: Int) -> String? {
        guard seconds > 0 else { return nil }
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let secs = seconds % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        }
        return String(format: "%d:%02d", minutes, secs)
    }

    static func dateTimeLabel(meetingDate: String?, instant: String?) -> String? {
        if let instant, let date = parseISO8601(instant) {
            let day = dateOnly(meetingDate)
            if let day, !Calendar(identifier: .gregorian).isDate(date, inSameDayAs: day) {
                return dateOnlyFormatter.string(from: day)
            }
            return dateTimeFormatter.string(from: date)
        }
        if let day = dateOnly(meetingDate) {
            return dateOnlyFormatter.string(from: day)
        }
        return nil
    }

    static func upcomingWhen(_ iso: String) -> String? {
        guard let date = parseISO8601(iso) else { return nil }
        return upcomingFormatter.string(from: date)
    }

    static func sortDate(meetingDate: String?, instant: String?) -> Date {
        if let instant, let date = parseISO8601(instant) {
            return date
        }
        if let day = dateOnly(meetingDate) {
            return day
        }
        return .distantPast
    }

    private static func dateOnly(_ value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        if let date = dateOnlyParser.date(from: String(value.prefix(10))) {
            return date
        }
        return parseISO8601(value)
    }

    static func parseISO8601(_ value: String) -> Date? {
        if let date = isoFractional.date(from: value) { return date }
        return isoBasic.date(from: value)
    }

    private static let dateOnlyParser: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let dateOnlyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_GB")
        formatter.dateFormat = "EEE d MMM yyyy"
        return formatter
    }()

    private static let dateTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_GB")
        formatter.dateFormat = "EEE d MMM · HH:mm"
        return formatter
    }()

    private static let upcomingFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_GB")
        formatter.dateFormat = "EEE d MMM, HH:mm"
        return formatter
    }()

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
}

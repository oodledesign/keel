import Foundation

enum MemoryKind: String, CaseIterable, Hashable, Identifiable {
    case funnyQuote = "funny_quote"
    case milestone
    case firsts
    case holiday
    case everyday
    case school

    var id: String { rawValue }

    var label: String {
        switch self {
        case .funnyQuote: "Funny quote"
        case .milestone: "Milestone"
        case .firsts: "Firsts"
        case .holiday: "Holiday"
        case .everyday: "Everyday"
        case .school: "School"
        }
    }

    static func parse(_ value: String?) -> MemoryKind? {
        guard let value, !value.isEmpty else { return nil }
        return MemoryKind(rawValue: value)
    }
}

enum MemoryDisplay {
    static func todayIso(now: Date = Date(), calendar: Calendar = .current) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: now)
        let year = parts.year ?? 0
        let month = parts.month ?? 0
        let day = parts.day ?? 0
        return String(format: "%04d-%02d-%02d", year, month, day)
    }

    static func formatDay(_ isoDate: String) -> String {
        let parts = isoDate.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return isoDate }
        var components = DateComponents()
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]
        guard let date = Calendar(identifier: .gregorian).date(from: components) else {
            return isoDate
        }

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_GB")
        formatter.setLocalizedDateFormatFromTemplate("EEE d MMM yyyy")
        return formatter.string(from: date)
    }

    static func formatAge(
        dateOfBirth: String?,
        now: Date = Date(),
        calendar: Calendar = Calendar(identifier: .gregorian)
    ) -> String? {
        guard let dateOfBirth, dateOfBirth.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil else {
            return nil
        }
        let parts = dateOfBirth.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3, let year = parts.first, year > 0 else { return nil }

        var components = DateComponents()
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]
        guard let dob = calendar.date(from: components), dob <= now else { return nil }

        var months = (calendar.component(.year, from: now) - calendar.component(.year, from: dob)) * 12
            + calendar.component(.month, from: now) - calendar.component(.month, from: dob)
        if calendar.component(.day, from: now) < calendar.component(.day, from: dob) {
            months -= 1
        }
        if months < 0 { return nil }

        if months < 12 {
            if months == 0 {
                let days = max(1, calendar.dateComponents([.day], from: dob, to: now).day ?? 1)
                return days == 1 ? "1 day old" : "\(days) days old"
            }
            return months == 1 ? "1 month old" : "\(months) months old"
        }

        let years = months / 12
        return years == 1 ? "1 year old" : "\(years) years old"
    }

    static func formatAgeOn(
        dateOfBirth: String?,
        occurredOn: String?,
        fallbackNow: Date = Date(),
        calendar: Calendar = Calendar(identifier: .gregorian)
    ) -> String? {
        guard let occurredOn,
              let onDate = date(fromIso: occurredOn, calendar: calendar)
        else {
            return formatAge(dateOfBirth: dateOfBirth, now: fallbackNow, calendar: calendar)
        }
        return formatAge(dateOfBirth: dateOfBirth, now: onDate, calendar: calendar)
    }

    static func date(fromIso isoDate: String, calendar: Calendar = Calendar(identifier: .gregorian)) -> Date? {
        let parts = isoDate.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var components = DateComponents()
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]
        return calendar.date(from: components)
    }

    static func initials(_ name: String) -> String {
        let parts = name.split { $0.isWhitespace }.prefix(2)
        if parts.isEmpty { return "?" }
        return parts.compactMap { $0.first }.map { String($0).uppercased() }.joined()
    }

    static func excerpt(_ content: String, max: Int = 220) -> String {
        let stripped = content
            .replacingOccurrences(of: "[#*_`>\\[\\]]", with: "", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if stripped.count <= max { return stripped }
        return String(stripped.prefix(max)).trimmingCharacters(in: .whitespacesAndNewlines) + "…"
    }

    static func memoryCountLabel(_ count: Int) -> String {
        count == 1 ? "1 memory" : "\(count) memories"
    }
}

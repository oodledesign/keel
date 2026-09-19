import Foundation
@testable import OzerMemories

enum MemoryDisplayTests {
    static func run(check: (String, () -> Bool) -> Void) {
        check("todayIso is YYYY-MM-DD") {
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = TimeZone(secondsFromGMT: 0)!
            let date = calendar.date(from: DateComponents(year: 2026, month: 5, day: 18))!
            MemoryDisplay.todayIso(now: date, calendar: calendar) == "2026-05-18"
        }

        check("formatDay uses a readable en-GB date") {
            let label = MemoryDisplay.formatDay("2026-09-18")
            label.contains("18") && label.contains("Sep") && label.contains("2026")
        }

        check("formatAge years months and days") {
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = TimeZone(secondsFromGMT: 0)!
            let now = calendar.date(from: DateComponents(year: 2026, month: 9, day: 18))!
            MemoryDisplay.formatAge(dateOfBirth: "2018-04-02", now: now, calendar: calendar) == "8 years old"
                && MemoryDisplay.formatAge(dateOfBirth: "2026-03-18", now: now, calendar: calendar) == "6 months old"
                && MemoryDisplay.formatAge(dateOfBirth: "2026-09-10", now: now, calendar: calendar) == "8 days old"
                && MemoryDisplay.formatAge(dateOfBirth: nil, now: now, calendar: calendar) == nil
                && MemoryDisplay.formatAgeOn(
                    dateOfBirth: "2018-04-02",
                    occurredOn: "2020-04-02",
                    calendar: calendar
                ) == "2 years old"
        }

        check("memory media kinds and size limit") {
            MemoryMedia.kind(mimeType: "image/jpeg", filename: "p.jpg") == .image
                && MemoryMedia.kind(mimeType: nil, filename: "note.caf") == .audio
                && MemoryMedia.kind(mimeType: "video/quicktime", filename: "clip.mov") == .video
                && ((try? MemoryMedia.validate(size: 12, mimeType: "audio/mp4", filename: "note.m4a")) == .audio)
                && (try? MemoryMedia.validate(size: MemoryMedia.maxBytes + 1, mimeType: "image/jpeg", filename: "huge.jpg")) == nil
        }

        check("initials and excerpt") {
            MemoryDisplay.initials("Poet Potter") == "PP"
                && MemoryDisplay.initials("") == "?"
                && MemoryDisplay.excerpt("## Hello\n\nThe moon was a biscuit.", max: 20).hasPrefix("Hello")
        }

        check("memory kinds have labels") {
            MemoryKind.parse("funny_quote")?.label == "Funny quote"
                && MemoryKind.parse("unknown") == nil
                && MemoryKind.allCases.count == 6
        }
    }
}

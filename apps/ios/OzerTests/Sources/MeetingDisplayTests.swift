import Foundation
@testable import OzerMeetings

enum MeetingDisplayTests {
    static func run(check: (String, () -> Bool) -> Void) {
        check("durationLabel formats minutes and hours") {
            MeetingDisplay.durationLabel(seconds: 0) == nil
                && MeetingDisplay.durationLabel(seconds: 1500) == "25:00"
                && MeetingDisplay.durationLabel(seconds: 3661) == "1:01:01"
        }

        check("sortDate prefers the instant over a meeting_date") {
            let instant = MeetingDisplay.sortDate(
                meetingDate: "2026-09-01",
                instant: "2026-09-12T15:04:00Z"
            )
            let fallback = MeetingDisplay.sortDate(
                meetingDate: "2026-09-01",
                instant: nil
            )
            return instant > fallback
                && MeetingDisplay.parseISO8601("2026-09-12T15:04:00Z") != nil
        }

        check("upcomingWhen reads an ISO timestamp") {
            MeetingDisplay.upcomingWhen("2026-09-12T15:04:00Z")?.contains("Sep") == true
        }
    }
}

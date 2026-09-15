import Foundation
@testable import OzerSurveys

enum SurveyDisplayTests {
    static func run(check: (String, () -> Bool) -> Void) {
        check("default survey type is RICS Home Survey Level 2") {
            SurveyTypeOption.parse(nil) == .ricsHssL2
                && SurveyTypeOption.parse("mystery") == .ricsHssL2
                && SurveyTypeOption.parse("dilapidations") == .dilapidations
        }

        check("queue status distinguishes offline, pending, and error") {
            SurveyDisplay.queueStatus(isOnline: false, pendingCount: 2, lastError: nil)
                == .offlinePending(2)
                && SurveyDisplay.queueStatus(isOnline: true, pendingCount: 1, lastError: nil)
                == .onlinePending(1)
                && SurveyDisplay.queueStatus(isOnline: true, pendingCount: 0, lastError: nil)
                == .onlineSynced
                && SurveyDisplay.queueStatus(isOnline: true, pendingCount: 0, lastError: "Couldn’t sync")
                == .failed("Couldn’t sync")
        }

        check("session title uses the first transcript line") {
            SurveyDisplay.sessionTitle(
                from: "## Me\n\nThe sash window is stiff on the landing.",
                on: Date(timeIntervalSince1970: 0)
            ) == "The sash window is stiff on the landing."
        }
    }
}

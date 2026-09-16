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

        check("survey level 3 is only RICS Home Survey Level 3") {
            SurveyDisplay.surveyLevel(from: "rics_hss_l3") == 3
                && SurveyDisplay.surveyLevel(from: "rics_hss_l2") == 2
                && SurveyTypeOption.ricsHssL3.surveyLevel == 3
        }

        check("survey status uses British English labels and shared tones") {
            SurveyDisplay.statusPresentation(for: "draft")
                == SurveyStatusPresentation(label: "Draft", tone: .draft)
                && SurveyDisplay.statusPresentation(for: "SENT")
                == SurveyStatusPresentation(label: "Sent", tone: .sent)
                && SurveyDisplay.statusPresentation(for: "in-progress")
                == SurveyStatusPresentation(label: "In progress", tone: .inProgress)
                && SurveyDisplay.statusPresentation(for: "published")
                == SurveyStatusPresentation(label: "Published", tone: .sent)
                && SurveyDisplay.statusPresentation(for: "archived")
                == SurveyStatusPresentation(label: "Archived", tone: .archived)
                && SurveyDisplay.statusPresentation(for: "ready_to_issue").label
                == "Ready To Issue"
        }

        check("later visits append to the same section note") {
            SurveyDisplay.appendNote(existing: "Stopcock is stiff.", incoming: "Supply is copper.")
                == "Stopcock is stiff.\n\nSupply is copper."
                && SurveyDisplay.accumulatedNote(
                    remote: "Stopcock is stiff.",
                    pendingBodies: ["Supply is copper.", "Tank is lagged."]
                ) == "Stopcock is stiff.\n\nSupply is copper.\n\nTank is lagged."
        }
    }
}

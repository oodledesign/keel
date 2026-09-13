import Foundation
@testable import OzerWorkspace

enum WorkspaceNavigationTests {
    static func run(check: (String, () -> Bool) -> Void) {
        check("personal menu has life items and hides business modules") {
            let screens = WorkspaceNavigation.menuScreens(profile: "personal", isPersonal: true)
            containsAll(screens, [.home, .tasks, .taskReview, .notes, .people, .recipes, .mealPlan, .shopping])
                && !screens.contains(.clients)
                && !screens.contains(.invoices)
                && !screens.contains(.meetings)
        }

        check("family menu matches personal life items") {
            let screens = WorkspaceNavigation.menuScreens(profile: "family", isPersonal: false)
            containsAll(screens, [.home, .tasks, .mealPlan, .shopping, .people, .recipes, .notes])
                && !screens.contains(.clients)
                && !screens.contains(.invoices)
                && !screens.contains(.meetings)
        }

        check("studio menu hides shopping meals and people") {
            let screens = WorkspaceNavigation.menuScreens(profile: "work_design", isPersonal: false)
            containsAll(screens, [.home, .tasks, .notes, .messages, .meetings, .clients, .invoices])
                && !screens.contains(.shopping)
                && !screens.contains(.recipes)
                && !screens.contains(.mealPlan)
                && !screens.contains(.people)
        }

        check("commercial property has clients not shopping") {
            let screens = WorkspaceNavigation.menuScreens(
                profile: "commercial_property",
                isPersonal: false
            )
            containsAll(screens, [.home, .tasks, .notes, .clients, .invoices, .meetings])
                && !screens.contains(.shopping)
                && !screens.contains(.recipes)
                && !screens.contains(.mealPlan)
                && !screens.contains(.people)
        }

        check("surveyor has meetings and clients not shopping") {
            let screens = WorkspaceNavigation.menuScreens(
                profile: "building_surveyor",
                isPersonal: false
            )
            containsAll(screens, [.home, .tasks, .notes, .meetings, .clients])
                && !screens.contains(.shopping)
                && !screens.contains(.recipes)
                && !screens.contains(.mealPlan)
        }

        check("community is core native only") {
            let screens = WorkspaceNavigation.menuScreens(profile: "community", isPersonal: false)
            containsAll(screens, [.home, .tasks, .notes, .messages])
                && !screens.contains(.shopping)
                && !screens.contains(.clients)
                && !screens.contains(.invoices)
                && !screens.contains(.meetings)
                && !screens.contains(.people)
        }

        check("unknown profile does not invent shopping") {
            let screens = WorkspaceNavigation.menuScreens(profile: "mystery", isPersonal: false)
            screens == WorkspaceNavigation.fallbackMenu
                && !screens.contains(.shopping)
        }

        check("personal isPersonal wins over a team profile string") {
            WorkspaceNavigation.kind(profile: "work_design", isPersonal: true) == .personal
                && WorkspaceNavigation.menuScreens(profile: "work_design", isPersonal: true)
                .contains(.shopping)
        }

        check("personal pins people and shopping") {
            WorkspaceNavigation.tabPins(profile: "personal", isPersonal: true)
                == [.tasks, .people, .shopping]
        }

        check("family pins shopping and meal plan") {
            WorkspaceNavigation.tabPins(profile: "family", isPersonal: false)
                == [.tasks, .shopping, .mealPlan]
        }

        check("studio keeps tasks notes messages") {
            WorkspaceNavigation.tabPins(profile: "work_design", isPersonal: false)
                == [.tasks, .notes, .messages]
        }

        check("commercial and property pin clients") {
            WorkspaceNavigation.tabPins(profile: "commercial_property", isPersonal: false)
                == [.tasks, .notes, .clients]
                && WorkspaceNavigation.tabPins(profile: "work_property", isPersonal: false)
                == [.tasks, .notes, .clients]
        }

        check("surveyor pins meetings") {
            WorkspaceNavigation.tabPins(profile: "building_surveyor", isPersonal: false)
                == [.tasks, .notes, .meetings]
        }

        check("every pin is listed in that profile menu") {
            let profiles: [(String, Bool)] = [
                ("personal", true),
                ("family", false),
                ("work_design", false),
                ("work_property", false),
                ("commercial_property", false),
                ("building_surveyor", false),
                ("community", false),
                ("", false),
            ]
            profiles.allSatisfy { profile, isPersonal in
                let menu = Set(WorkspaceNavigation.menuScreens(profile: profile, isPersonal: isPersonal))
                let pins = WorkspaceNavigation.tabPins(profile: profile, isPersonal: isPersonal)
                return pins.count == 3 && pins.allSatisfy(menu.contains)
            }
        }

        check("workspace switch falls back to home when the screen is gone") {
            let studio = WorkspaceNavigation.menuScreens(profile: "work_design", isPersonal: false)
            WorkspaceNavigation.resolvedScreen(.shopping, allowed: studio) == .home
                && WorkspaceNavigation.resolvedScreen(.clients, allowed: studio) == .clients
                && WorkspaceNavigation.resolvedScreen(
                    .invoices,
                    allowed: WorkspaceNavigation.menuScreens(profile: "personal", isPersonal: true)
                ) == .home
        }
    }

    private static func containsAll(_ screens: [AppScreen], _ needed: [AppScreen]) -> Bool {
        needed.allSatisfy(screens.contains)
    }
}

import Foundation

/// Maps a workspace profile to the native screens that profile should show.
/// Web sidebar configs are the source of truth; only `AppScreen` destinations
/// that exist on iOS are included.
enum WorkspaceNavigation {
    /// Menu when memberships have not loaded yet — core native surfaces only.
    static let fallbackMenu: [AppScreen] = [
        .home, .tasks, .taskReview, .notes, .messages,
    ]

    /// Tab pins when no workspace is selected yet. Home and Menu stay fixed.
    static let fallbackPins: [AppScreen] = [.tasks, .notes, .messages]

    enum Kind: Equatable {
        case personal
        case family
        case workDesign
        case workProperty
        case commercialProperty
        case buildingSurveyor
        case community
        case unknown

        init(profile: String, isPersonal: Bool) {
            if isPersonal || profile == "personal" {
                self = .personal
                return
            }
            switch profile {
            case "family":
                self = .family
            case "work_design":
                self = .workDesign
            case "work_property":
                self = .workProperty
            case "commercial_property":
                self = .commercialProperty
            case "building_surveyor":
                self = .buildingSurveyor
            case "community":
                self = .community
            default:
                self = .unknown
            }
        }

        /// Personal people (and family, matching the current iOS People list).
        var showsPeople: Bool {
            self == .personal || self == .family
        }

        /// Recipes and the week meal plan — personal / family only on web.
        var showsMeals: Bool {
            showsPeople
        }

        /// Shopping list — family sidebar on web; personal keeps it as a life item.
        var showsShopping: Bool {
            showsMeals
        }

        /// Clients / contacts / tenants on studio, property, commercial, surveyor.
        var showsClients: Bool {
            switch self {
            case .workDesign, .workProperty, .commercialProperty, .buildingSurveyor:
                return true
            default:
                return false
            }
        }

        /// Delivery projects — studio, property, and commercial. Not surveyor
        /// (web surveyor sidebar has no Projects).
        var showsProjects: Bool {
            switch self {
            case .workDesign, .workProperty, .commercialProperty:
                return true
            default:
                return false
            }
        }

        /// Invoices / finances — same business spaces as Projects. Not surveyor
        /// (web surveyor sidebar has no Invoices).
        var showsInvoices: Bool { showsProjects }

        /// Review inbox is a native surface on most spaces. Surveyor web has no
        /// Review item; suggested tasks still open from the Tasks screen.
        var showsTaskReview: Bool { self != .buildingSurveyor }

        /// In-room meetings — business / work / commercial / surveyor, not life spaces.
        var showsMeetings: Bool {
            switch self {
            case .workDesign, .workProperty, .commercialProperty, .buildingSurveyor:
                return true
            default:
                return false
            }
        }

        /// Site surveys — building-surveyor only.
        var showsSurveys: Bool {
            self == .buildingSurveyor
        }

        /// Native inbox exists for every workspace even when web omits Messages.
        /// Surveyor web has no Messages item; the app shell still keeps inbox.
        var showsMessages: Bool { true }
    }

    static func kind(profile: String, isPersonal: Bool) -> Kind {
        Kind(profile: profile, isPersonal: isPersonal)
    }

    static func menuScreens(profile: String, isPersonal: Bool) -> [AppScreen] {
        let kind = Kind(profile: profile, isPersonal: isPersonal)
        var screens: [AppScreen] = [.home, .tasks]
        if kind.showsTaskReview {
            screens.append(.taskReview)
        }
        screens.append(.notes)
        if kind.showsMessages {
            screens.append(.messages)
        }
        if kind.showsMeetings {
            screens.append(.meetings)
        }
        if kind.showsSurveys {
            screens.append(.surveys)
        }
        if kind.showsPeople {
            screens.append(.people)
        }
        if kind.showsMeals {
            screens.append(.recipes)
            screens.append(.mealPlan)
        }
        if kind.showsProjects {
            screens.append(.projects)
        }
        if kind.showsClients {
            screens.append(.clients)
        }
        if kind.showsInvoices {
            screens.append(.invoices)
        }
        if kind.showsShopping {
            screens.append(.shopping)
        }
        return screens
    }

    /// Three tab-bar pins (Home and Menu stay fixed). Aligned with web primary nav.
    static func tabPins(profile: String, isPersonal: Bool) -> [AppScreen] {
        switch Kind(profile: profile, isPersonal: isPersonal) {
        case .personal:
            return [.tasks, .people, .shopping]
        case .family:
            return [.tasks, .shopping, .mealPlan]
        case .workDesign:
            return [.tasks, .notes, .messages]
        case .workProperty, .commercialProperty:
            return [.tasks, .notes, .clients]
        case .buildingSurveyor:
            return [.tasks, .surveys, .meetings]
        case .community, .unknown:
            return fallbackPins
        }
    }

    /// After a workspace switch, keep the current screen only if it is still listed.
    static func resolvedScreen(_ screen: AppScreen, allowed: [AppScreen]) -> AppScreen {
        if allowed.contains(screen) {
            return screen
        }
        if allowed.contains(.home) {
            return .home
        }
        return allowed.first ?? .home
    }
}

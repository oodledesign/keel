import Foundation

/// Persisted native workspace pick. Stores the account id (or slug) — not Personal / Family / Business.
enum CaptureSaveDestination: String, CaseIterable, Identifiable, Codable {
    case meeting
    case note

    var id: String { rawValue }

    var label: String {
        switch self {
        case .meeting: return "Meeting"
        case .note: return "Note"
        }
    }
}

enum WorkspaceSelection {
    static let storageKey = "so.ozer.app.workspace"

    static var storedRef: String? {
        UserDefaults.standard.string(forKey: storageKey)?.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func persist(_ workspace: NativeWorkspace) {
        UserDefaults.standard.set(workspace.id, forKey: storageKey)
    }

    /// Personal first, then other memberships by name.
    static func sorted(_ workspaces: [NativeWorkspace]) -> [NativeWorkspace] {
        let personal = workspaces.filter(\.isPersonalAccount)
        let teams = workspaces
            .filter { !$0.isPersonalAccount }
            .sorted {
                $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
            }
        return personal + teams
    }

    static func resolve(
        storedRef: String?,
        in workspaces: [NativeWorkspace]
    ) -> NativeWorkspace? {
        guard !workspaces.isEmpty else { return nil }

        if let storedRef, let match = match(storedRef, in: workspaces) {
            return match
        }

        return workspaces.first(where: \.isPersonalAccount) ?? workspaces.first
    }

    static func match(_ ref: String, in workspaces: [NativeWorkspace]) -> NativeWorkspace? {
        let trimmed = ref.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        if let byId = workspaces.first(where: { $0.id == trimmed }) {
            return byId
        }
        if let bySlug = workspaces.first(where: { $0.slug == trimmed }) {
            return bySlug
        }

        // One-time migration from the old Personal / Family / Business chips.
        switch trimmed.lowercased() {
        case "personal":
            return workspaces.first(where: \.isPersonalAccount)
        case "family":
            return workspaces.first(where: { $0.profile == "family" })
        case "business":
            return workspaces.first(where: { $0.profile == "work_design" })
                ?? workspaces.first(where: { !$0.isPersonalAccount })
        default:
            return nil
        }
    }
}

extension NativeWorkspace {
    var isPersonalAccount: Bool {
        isPersonal || profile == "personal"
    }

    /// Chip and list title. Personal is always labeled “Personal”.
    var displayName: String {
        if isPersonalAccount { return "Personal" }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }
        if !slug.isEmpty { return slug }
        return "Workspace"
    }

    /// HTTPS logo URL only. Relative, http, and junk values are ignored.
    var httpsImageURL: URL? {
        guard let image,
              let url = URL(string: image.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.scheme?.lowercased() == "https"
        else {
            return nil
        }
        return url
    }

    /// One or two letters from the account name (Oodle → O, The House → TH).
    var logoInitials: String {
        let words = displayName.split { $0.isWhitespace || $0 == "-" }.filter { !$0.isEmpty }
        let letters = words.compactMap { word in word.first(where: \.isLetter) }
        switch letters.count {
        case 0:
            return ""
        case 1:
            return String(letters[0]).uppercased()
        default:
            return String([letters[0], letters[1]]).uppercased()
        }
    }

    /// People lives on personal and family, matching the web sidebar.
    var showsPeople: Bool {
        isPersonalAccount || profile == "family"
    }

    /// Clients on studio / surveyor / commercial property — not community.
    var showsClients: Bool {
        switch profile {
        case "work_design", "work_property", "commercial_property", "building_surveyor":
            return true
        default:
            return false
        }
    }

    /// Invoices / finances on the same business-like spaces as Clients.
    var showsInvoices: Bool { showsClients }

    /// In-room meetings on business / work / commercial / surveyor. Not personal or family.
    var showsMeetings: Bool {
        if isPersonalAccount { return false }
        switch profile {
        case "work_design", "work_property", "commercial_property", "building_surveyor":
            return true
        default:
            return false
        }
    }

    var isSurveyorWorkspace: Bool {
        profile == "building_surveyor"
    }

    /// Meeting destination is offered on workspaces that have an Ozer Meetings page.
    var allowsMeetingDestination: Bool {
        showsMeetings
    }

    /// Surveyor defaults to a note (later hangs off a survey). Studio / commercial default to a meeting.
    var defaultCaptureDestination: CaptureSaveDestination {
        if !allowsMeetingDestination { return .note }
        if isSurveyorWorkspace { return .note }
        return .meeting
    }

    /// Menu body for the selected space. Workspaces themselves stay in the picker.
    var menuScreens: [AppScreen] {
        var screens: [AppScreen] = [.home, .tasks, .notes]
        if showsMeetings {
            screens.append(.meetings)
        }
        if showsPeople {
            screens.append(.people)
        }
        if showsClients {
            screens.append(.clients)
        }
        if showsInvoices {
            screens.append(.invoices)
        }
        screens.append(.shopping)
        return screens
    }

    /// Secondary type label only. Hidden when it repeats the name.
    /// Personal uses the account name (Dan Potter) under the “Personal” title.
    var profileSubtitle: String? {
        if isPersonalAccount {
            let accountName = name.trimmingCharacters(in: .whitespacesAndNewlines)
            if !accountName.isEmpty,
               accountName.caseInsensitiveCompare("Personal") != .orderedSame
            {
                return accountName
            }
            return nil
        }

        let label: String
        switch profile {
        case "personal":
            label = "Personal"
        case "family":
            label = "Family"
        case "building_surveyor":
            label = "Surveyor"
        case "commercial_property":
            label = "Commercial property"
        case "community":
            label = "Community"
        case "work_property":
            // Server currently maps work_property → work_design; keep for a future pass-through.
            label = "Property"
        case "work_design":
            label = "Studio"
        default:
            return isPersonalAccount ? "Personal" : nil
        }

        if displayName.caseInsensitiveCompare(label) == .orderedSame {
            return nil
        }
        return label
    }
}

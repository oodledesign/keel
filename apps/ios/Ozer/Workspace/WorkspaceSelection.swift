import Foundation

/// Persisted native workspace pick. Stores the account id (or slug) — not Personal / Family / Business.
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

    /// Chip and list title — the account name (Oodle, Bracketts, Personal).
    var displayName: String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }
        if !slug.isEmpty { return slug }
        return "Workspace"
    }

    /// Secondary type label only. Hidden when it repeats the name.
    var profileSubtitle: String? {
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

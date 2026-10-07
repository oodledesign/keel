import Foundation

struct AccountDeletionPreview: Decodable, Equatable {
    static let confirmationWord = "DELETE"

    var deletionEnabled: Bool
    var graceDays: Int
    var scheduledFor: String?
    var blockers: [Blocker]
    var ownedTeamWorkspaces: [OwnedTeamWorkspace]

    struct Blocker: Decodable, Equatable, Identifiable {
        var code: String
        var message: String

        var id: String { code }
    }

    struct OwnedTeamWorkspace: Decodable, Equatable, Identifiable {
        var id: String
        var name: String
        var otherMemberCount: Int

        enum CodingKeys: String, CodingKey {
            case id, name
            case otherMemberCount = "other_member_count"
        }
    }

    enum CodingKeys: String, CodingKey {
        case deletionEnabled = "deletion_enabled"
        case graceDays = "grace_days"
        case scheduledFor = "scheduled_for"
        case blockers
        case ownedTeamWorkspaces = "owned_team_workspaces"
    }

    var needsRecentSignIn: Bool {
        blockers.contains { $0.code == "recent_sign_in_required" }
    }

    /// Workspaces only this user is in; they are deleted with the account.
    var soloWorkspaces: [OwnedTeamWorkspace] {
        ownedTeamWorkspaces.filter { $0.otherMemberCount == 0 }
    }
}

struct AccountDeletionScheduled: Decodable, Equatable {
    var scheduledFor: String

    enum CodingKeys: String, CodingKey {
        case scheduledFor = "scheduled_for"
    }
}

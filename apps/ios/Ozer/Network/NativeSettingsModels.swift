import Foundation

struct PersonalSettings: Decodable, Equatable {
    struct EmailNotification: Decodable, Equatable, Identifiable {
        var key: String
        var title: String
        var description: String
        var enabled: Bool

        var id: String { key }
    }

    var firstName: String
    var lastName: String
    var displayName: String
    var email: String?
    var pictureUrl: String?
    var emailNotifications: [EmailNotification]

    enum CodingKeys: String, CodingKey {
        case firstName = "first_name"
        case lastName = "last_name"
        case displayName = "display_name"
        case email
        case pictureUrl = "picture_url"
        case emailNotifications = "email_notifications"
    }
}

struct ProfilePhotoResult: Decodable {
    var pictureUrl: String?

    enum CodingKeys: String, CodingKey {
        case pictureUrl = "picture_url"
    }
}

struct WorkspaceSettings: Decodable, Equatable {
    struct Workspace: Decodable, Equatable {
        var id: String
        var slug: String
        var name: String
        var profile: String
        var isPersonal: Bool
        var image: String?

        enum CodingKeys: String, CodingKey {
            case id, slug, name, profile, image
            case isPersonal = "is_personal"
        }

        var nativeWorkspace: NativeWorkspace {
            NativeWorkspace(
                id: id,
                slug: slug,
                name: name,
                profile: profile,
                isPersonal: isPersonal,
                image: image
            )
        }
    }

    struct Me: Decodable, Equatable {
        var roleLabel: String
        var isPrimaryOwner: Bool
        var canEdit: Bool
        var canManageMembers: Bool
        var canInvite: Bool
        var canLeave: Bool

        enum CodingKeys: String, CodingKey {
            case roleLabel = "role_label"
            case isPrimaryOwner = "is_primary_owner"
            case canEdit = "can_edit"
            case canManageMembers = "can_manage_members"
            case canInvite = "can_invite"
            case canLeave = "can_leave"
        }
    }

    struct Member: Decodable, Equatable, Identifiable {
        var userId: String
        var name: String
        var email: String?
        var pictureUrl: String?
        var roleLabel: String
        var isPrimaryOwner: Bool
        var isMe: Bool
        var canRemove: Bool

        var id: String { userId }

        enum CodingKeys: String, CodingKey {
            case userId = "user_id"
            case name, email
            case pictureUrl = "picture_url"
            case roleLabel = "role_label"
            case isPrimaryOwner = "is_primary_owner"
            case isMe = "is_me"
            case canRemove = "can_remove"
        }
    }

    struct Invitation: Decodable, Equatable, Identifiable {
        var id: Int
        var email: String
        var roleLabel: String
        var expiresAt: String?

        enum CodingKeys: String, CodingKey {
            case id, email
            case roleLabel = "role_label"
            case expiresAt = "expires_at"
        }
    }

    struct Role: Decodable, Equatable, Identifiable, Hashable {
        var name: String
        var label: String

        var id: String { name }
    }

    var workspace: Workspace
    var me: Me
    var members: [Member]
    var invitations: [Invitation]
    var inviteRoles: [Role]

    enum CodingKeys: String, CodingKey {
        case workspace, me, members, invitations
        case inviteRoles = "invite_roles"
    }
}

import Foundation

enum FeatureStub: String, Hashable, CaseIterable {
    case tasks
    case notes
    case messages
    case people
    case shopping

    var title: String {
        switch self {
        case .tasks: "Tasks"
        case .notes: "Notes"
        case .messages: "Messages"
        case .people: "People"
        case .shopping: "Shopping"
        }
    }

    var symbol: String {
        switch self {
        case .tasks: "checkmark.square"
        case .notes: "note.text"
        case .messages: "bubble.left.and.bubble.right"
        case .people: "person.2"
        case .shopping: "cart"
        }
    }

    var blurb: String {
        switch self {
        case .tasks: "Your lists will live here. This screen is navigation only for now."
        case .notes: "Notes stay on the web for the moment. This is a placeholder."
        case .messages: "Chats with teammates and clients will land here."
        case .people: "Friends, family, and catch-ups will land here."
        case .shopping: "Household shopping will open from this tab later."
        }
    }
}

enum AppScreen: Hashable {
    case home
    case tasks
    /// Menu / Home / Tasks entry — not a tab-bar pin.
    case taskReview
    case notes
    case messages
    case people
    case clients
    /// Menu only — not a default tab-bar pin.
    case invoices
    /// Menu on business spaces; surveyor tab-bar pin.
    case meetings
    /// Personal / family shopping list. Family also pins it.
    case shopping
    /// Menu only — personal / family meal library.
    case recipes
    /// Personal / family week meal plan. Family also pins it.
    case mealPlan

    init(feature: FeatureStub) {
        switch feature {
        case .tasks: self = .tasks
        case .notes: self = .notes
        case .messages: self = .messages
        case .people: self = .people
        case .shopping: self = .shopping
        }
    }

    var title: String {
        switch self {
        case .home: "Home"
        case .tasks: "Tasks"
        case .taskReview: "Review"
        case .notes: "Notes"
        case .messages: "Messages"
        case .people: "People"
        case .clients: "Clients"
        case .invoices: "Invoices"
        case .meetings: "Meetings"
        case .shopping: "Shopping"
        case .recipes: "Recipes"
        case .mealPlan: "Meal plan"
        }
    }

    var symbol: String {
        switch self {
        case .home: "house"
        case .tasks: "checkmark.square"
        case .taskReview: "tray.full"
        case .notes: "note.text"
        case .messages: "bubble.left.and.bubble.right"
        case .people: "person.2"
        case .clients: "building.2"
        case .invoices: "doc.text"
        case .meetings: "waveform"
        case .shopping: "cart"
        case .recipes: "book"
        case .mealPlan: "calendar"
        }
    }
}

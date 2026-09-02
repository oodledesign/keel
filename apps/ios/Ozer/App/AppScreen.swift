import Foundation

enum AppScreen: Hashable {
    case home
    case tasks
    case notes
    case people
    case clients
    /// Menu only — not one of the three tab-bar pin slots.
    case invoices
    /// Menu only — not one of the three tab-bar pin slots.
    case meetings
    /// Menu only — not one of the three tab-bar pin slots.
    case shopping

    init(feature: FeatureStub) {
        switch feature {
        case .tasks: self = .tasks
        case .notes: self = .notes
        case .people: self = .people
        case .shopping: self = .shopping
        }
    }

    var pin: FeatureStub? {
        switch self {
        case .home: nil
        case .tasks: .tasks
        case .notes: .notes
        case .people: .people
        case .clients: nil
        case .invoices: nil
        case .meetings: nil
        case .shopping: .shopping
        }
    }

    var title: String {
        switch self {
        case .home: "Home"
        case .tasks: "Tasks"
        case .notes: "Notes"
        case .people: "People"
        case .clients: "Clients"
        case .invoices: "Invoices"
        case .meetings: "Meetings"
        case .shopping: "Shopping"
        }
    }

    var symbol: String {
        switch self {
        case .home: "house"
        case .tasks: "checkmark.square"
        case .notes: "note.text"
        case .people: "person.2"
        case .clients: "building.2"
        case .invoices: "doc.text"
        case .meetings: "waveform"
        case .shopping: "cart"
        }
    }
}

enum PinSlot: Int, CaseIterable, Identifiable {
    case tasks
    case notes
    case people

    var id: Int { rawValue }

    var feature: FeatureStub {
        switch self {
        case .tasks: .tasks
        case .notes: .notes
        case .people: .people
        }
    }

    var screen: AppScreen {
        AppScreen(feature: feature)
    }
}

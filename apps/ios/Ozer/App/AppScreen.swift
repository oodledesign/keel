import Foundation

enum AppScreen: Hashable {
    case home
    case tasks
    case notes
    case people
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
        case .shopping: .shopping
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

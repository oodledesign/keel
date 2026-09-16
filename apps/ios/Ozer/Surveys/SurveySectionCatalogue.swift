import Foundation

struct SurveySectionDefinition: Equatable, Hashable, Identifiable {
    var key: String
    var heading: String
    var group: String
    var letter: String
    var ricsCode: String
    var allowsPhotos: Bool
    var visibleOnLevels: [Int]
    var onSitePickable: Bool

    var id: String { ricsCode }

    var label: String {
        SurveySectionCatalogue.displayLabel(
            heading: heading,
            ricsCode: ricsCode,
            letter: letter
        )
    }
}

/// Bundled RICS Home Survey on-site picker. Matches web `survey-section-catalogue`
/// so a surveyor can choose a section offline. AI does not assign sections.
enum SurveySectionCatalogue {
    static let all: [SurveySectionDefinition] = [
        .init(key: "chimney_stacks", heading: "Chimney stacks", group: "D Outside the property", letter: "D", ricsCode: "D1", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "roof_coverings", heading: "Roof coverings", group: "D Outside the property", letter: "D", ricsCode: "D2", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "rainwater", heading: "Rainwater pipes and gutters", group: "D Outside the property", letter: "D", ricsCode: "D3", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "main_walls", heading: "Main walls", group: "D Outside the property", letter: "D", ricsCode: "D4", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "windows", heading: "Windows", group: "D Outside the property", letter: "D", ricsCode: "D5", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "outside_doors", heading: "Outside doors (including patio doors)", group: "D Outside the property", letter: "D", ricsCode: "D6", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "conservatory_porches", heading: "Conservatory and porches", group: "D Outside the property", letter: "D", ricsCode: "D7", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "other_joinery", heading: "Other joinery and finishes", group: "D Outside the property", letter: "D", ricsCode: "D8", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "other_outside", heading: "Other (outside)", group: "D Outside the property", letter: "D", ricsCode: "D9", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "roof_structure", heading: "Roof structure", group: "E Inside the property", letter: "E", ricsCode: "E1", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "ceilings", heading: "Ceilings", group: "E Inside the property", letter: "E", ricsCode: "E2", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "walls_partitions", heading: "Walls and partitions", group: "E Inside the property", letter: "E", ricsCode: "E3", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "floors", heading: "Floors", group: "E Inside the property", letter: "E", ricsCode: "E4", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "fireplaces", heading: "Fireplaces, chimney breasts and flues", group: "E Inside the property", letter: "E", ricsCode: "E5", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "built_in_fittings", heading: "Built-in fittings", group: "E Inside the property", letter: "E", ricsCode: "E6", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "woodwork", heading: "Woodwork (for example, staircase joinery)", group: "E Inside the property", letter: "E", ricsCode: "E7", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "bathroom_fittings", heading: "Bathroom fittings", group: "E Inside the property", letter: "E", ricsCode: "E8", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "other_inside", heading: "Other (inside)", group: "E Inside the property", letter: "E", ricsCode: "E9", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "electricity", heading: "Electricity", group: "F Services", letter: "F", ricsCode: "F1", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "gas_oil", heading: "Gas / oil", group: "F Services", letter: "F", ricsCode: "F2", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "water", heading: "Water", group: "F Services", letter: "F", ricsCode: "F3", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "heating", heading: "Heating", group: "F Services", letter: "F", ricsCode: "F4", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "water_heating", heading: "Water heating", group: "F Services", letter: "F", ricsCode: "F5", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "drainage", heading: "Drainage", group: "F Services", letter: "F", ricsCode: "F6", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "common_services", heading: "Common services", group: "F Services", letter: "F", ricsCode: "F7", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "garage_outbuildings", heading: "Garage", group: "G Grounds", letter: "G", ricsCode: "G1", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "permanent_outbuildings", heading: "Permanent outbuildings and other structures", group: "G Grounds", letter: "G", ricsCode: "G2", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
        .init(key: "grounds", heading: "Other (grounds)", group: "G Grounds", letter: "G", ricsCode: "G3", allowsPhotos: true, visibleOnLevels: [2, 3], onSitePickable: true),
    ]

    static func displayLabel(heading: String, ricsCode: String, letter: String) -> String {
        if ricsCode.range(of: #"^[A-N]\d$"#, options: .regularExpression) != nil {
            return "\(ricsCode) \(heading)"
        }
        if !letter.isEmpty {
            return "\(letter) · \(heading)"
        }
        return heading
    }

    static func section(ricsCodeOrKey value: String?) -> SurveySectionDefinition? {
        guard let raw = value?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        let upper = raw.uppercased()
        return all.first {
            $0.ricsCode.caseInsensitiveCompare(raw) == .orderedSame
                || $0.key.caseInsensitiveCompare(raw) == .orderedSame
                || $0.ricsCode == upper
        }
    }

    static func onSiteSections(level: Int) -> [SurveySectionDefinition] {
        let resolved = level == 3 ? 3 : 2
        return all.filter { $0.onSitePickable && $0.visibleOnLevels.contains(resolved) }
    }

    static func groupedOnSiteSections(level: Int) -> [(group: String, sections: [SurveySectionDefinition])] {
        let items = onSiteSections(level: level)
        var order: [String] = []
        var buckets: [String: [SurveySectionDefinition]] = [:]
        for item in items {
            if buckets[item.group] == nil {
                order.append(item.group)
                buckets[item.group] = []
            }
            buckets[item.group]?.append(item)
        }
        return order.compactMap { group in
            guard let sections = buckets[group] else { return nil }
            return (group, sections)
        }
    }
}

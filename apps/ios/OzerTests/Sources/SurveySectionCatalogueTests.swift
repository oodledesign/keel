import Foundation
@testable import OzerSurveys

enum SurveySectionCatalogueTests {
    static func run(check: (String, () -> Bool) -> Void) {
        check("on-site catalogue includes F3 Water and D2 Roof coverings") {
            let water = SurveySectionCatalogue.section(ricsCodeOrKey: "F3")
            let roof = SurveySectionCatalogue.section(ricsCodeOrKey: "D2")
            return water?.key == "water"
                && water?.heading == "Water"
                && water?.label == "F3 Water"
                && roof?.key == "roof_coverings"
                && roof?.label == "D2 Roof coverings"
        }

        check("on-site picker is sections, not rooms or chapters") {
            let capture = SurveySectionCatalogue.onSiteSections(level: 3)
            let codes = Set(capture.map(\.ricsCode))
            return codes.contains("D2")
                && codes.contains("F3")
                && codes.contains("E3")
                && !codes.contains("A")
                && !codes.contains("K")
                && capture.allSatisfy(\.onSitePickable)
                && !capture.contains(where: { $0.key.localizedCaseInsensitiveContains("bedroom") })
        }

        check("groups keep letter order for the on-site walk") {
            let groups = SurveySectionCatalogue.groupedOnSiteSections(level: 2).map(\.group)
            return groups.first == "D Outside the property"
                && groups.contains("F Services")
                && groups.contains("G Grounds")
        }
    }
}

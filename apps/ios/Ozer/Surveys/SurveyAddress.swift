import Foundation

/// Mapbox UK suggestion from `GET /api/native/v1/address-suggest`. Tokens stay on the server.
struct AddressSuggestion: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var label: String
    var nameHint: String?
    var addressLine1: String?
    var addressLine2: String?
    var town: String?
    var county: String?
    var postcode: String?
    var country: String
    var latitude: Double
    var longitude: Double

    enum CodingKeys: String, CodingKey {
        case id, label, country, latitude, longitude
        case nameHint
        case addressLine1
        case addressLine2
        case town, county, postcode
    }

    init(
        id: String,
        label: String,
        nameHint: String? = nil,
        addressLine1: String? = nil,
        addressLine2: String? = nil,
        town: String? = nil,
        county: String? = nil,
        postcode: String? = nil,
        country: String = "GB",
        latitude: Double,
        longitude: Double
    ) {
        self.id = id
        self.label = label
        self.nameHint = nameHint
        self.addressLine1 = addressLine1
        self.addressLine2 = addressLine2
        self.town = town
        self.county = county
        self.postcode = postcode
        self.country = country
        self.latitude = latitude
        self.longitude = longitude
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        label = try container.decodeIfPresent(String.self, forKey: .label) ?? id
        nameHint = try container.decodeIfPresent(String.self, forKey: .nameHint)
        addressLine1 = try container.decodeIfPresent(String.self, forKey: .addressLine1)
        addressLine2 = try container.decodeIfPresent(String.self, forKey: .addressLine2)
        town = try container.decodeIfPresent(String.self, forKey: .town)
        county = try container.decodeIfPresent(String.self, forKey: .county)
        postcode = try container.decodeIfPresent(String.self, forKey: .postcode)
        country = try container.decodeIfPresent(String.self, forKey: .country) ?? "GB"
        latitude = try container.decode(Double.self, forKey: .latitude)
        longitude = try container.decode(Double.self, forKey: .longitude)
    }
}

struct AddressSuggestionsPayload: Decodable, Equatable {
    var suggestions: [AddressSuggestion]
}

enum SurveyAddress {
    /// Same line order as web survey prep (`addressLine1, line2, town, county`).
    static func formatted(_ suggestion: AddressSuggestion) -> String {
        let parts = [
            suggestion.addressLine1,
            suggestion.addressLine2,
            suggestion.town,
            suggestion.county,
        ]
        .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }

        if !parts.isEmpty {
            return parts.joined(separator: ", ")
        }
        let label = suggestion.label.trimmingCharacters(in: .whitespacesAndNewlines)
        return label.isEmpty ? suggestion.id : label
    }

    /// Best-effort outward+inward UK postcode, matching the web helper.
    static func extractUkPostcode(from text: String) -> String? {
        let pattern = #"\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return nil
        }
        let range = NSRange(text.startIndex..., in: text)
        guard let match = regex.firstMatch(in: text, options: [], range: range),
              let swiftRange = Range(match.range(at: 1), in: text) else {
            return nil
        }
        let raw = text[swiftRange].uppercased()
        let compact = raw.replacingOccurrences(of: " ", with: "")
        guard compact.count >= 5 else { return raw }
        let inward = compact.suffix(3)
        let outward = compact.dropLast(3)
        return "\(outward) \(inward)"
    }
}

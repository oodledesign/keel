import Foundation

struct DisposalsPayload: Decodable, Equatable {
    var items: [DisposalItem]
    var total: Int
    var canEdit: Bool
}

/// List rows carry the summary fields; detail adds the optional ones.
struct DisposalItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var name: String
    var address: String?
    var postcode: String?
    var status: String
    var statusLabel: String
    var disposalType: String
    var disposalTypeLabel: String
    var sector: String?
    var sizeLabel: String?
    var rentLabel: String?
    var priceLabel: String?
    var coverUrl: String?
    var agents: [String]
    var updatedAt: String

    var addressLine1: String?
    var addressLine2: String?
    var town: String?
    var county: String?
    var tenure: String?
    var useClassLabel: String?
    var availableFrom: String?
    var epcBand: String?
    var epcRating: Int?
    var serviceChargePerSqft: Double?
    var ratesPayablePerSqft: Double?
    var sizeMinSqft: Double?
    var sizeMaxSqft: Double?
    var askingRentPence: Int?
    var askingRentToPence: Int?
    var rentFrequency: String?
    var askingPricePence: Int?
    var askingPriceQualifier: String?
    var summary: String?
    var description: String?
    var notes: String?
    var keyPoints: [String]?
    var onMarketAt: String?
    var canEdit: Bool?

    var httpsCoverURL: URL? {
        guard let coverUrl,
              let url = URL(string: coverUrl),
              url.scheme?.lowercased() == "https"
        else { return nil }
        return url
    }

    /// Rent first, then price — whichever terms the disposal is marketed on.
    var termsLabel: String? {
        switch (rentLabel, priceLabel) {
        case let (rent?, price?): "\(rent) · \(price)"
        case let (rent?, nil): rent
        case let (nil, price?): price
        case (nil, nil): nil
        }
    }

    /// List rows don't carry `can_edit`; the list payload does.
    func withCanEdit(_ canEdit: Bool) -> DisposalItem {
        var copy = self
        if copy.canEdit == nil { copy.canEdit = canEdit }
        return copy
    }

    var availableFromDate: Date? {
        guard let availableFrom else { return nil }
        return DisposalFormat.isoDay.date(from: String(availableFrom.prefix(10)))
    }

    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }()
}

struct DisposalOption: Identifiable, Hashable {
    var value: String
    var label: String
    var id: String { value }
}

/// Mirrors `apps/web/lib/commercial/commercial-constants.ts`; the PATCH schema rejects anything else.
enum DisposalOptions {
    static let statuses: [DisposalOption] = [
        DisposalOption(value: "draft", label: "Draft"),
        DisposalOption(value: "instructed", label: "Instructed"),
        DisposalOption(value: "marketing", label: "Marketing"),
        DisposalOption(value: "under_offer", label: "Under offer"),
        DisposalOption(value: "let", label: "Let"),
        DisposalOption(value: "sold", label: "Sold"),
        DisposalOption(value: "withdrawn", label: "Withdrawn"),
    ]

    static let rentFrequencies: [DisposalOption] = [
        DisposalOption(value: "per_annum", label: "Per annum"),
        DisposalOption(value: "per_month", label: "Per month"),
        DisposalOption(value: "per_sqft", label: "Per sq ft"),
    ]

    static let priceQualifiers: [DisposalOption] = [
        DisposalOption(value: "none", label: "Asking price"),
        DisposalOption(value: "offers_in_excess_of", label: "Offers in Excess of"),
        DisposalOption(value: "offers_in_region_of", label: "Offers in Region of"),
        DisposalOption(value: "guide_price", label: "Guide Price"),
    ]
}

enum DisposalListFilter: String, CaseIterable, Identifiable {
    case live
    case marketing
    case underOffer = "under_offer"
    case completed
    case withdrawn
    case all

    var id: String { rawValue }

    var label: String {
        switch self {
        case .live: "Live"
        case .marketing: "Marketing"
        case .underOffer: "Under offer"
        case .completed: "Let & sold"
        case .withdrawn: "Withdrawn"
        case .all: "All"
        }
    }

    func includes(status: String) -> Bool {
        switch self {
        case .live: ["draft", "instructed", "marketing", "under_offer"].contains(status)
        case .marketing: status == "marketing"
        case .underOffer: status == "under_offer"
        case .completed: status == "let" || status == "sold"
        case .withdrawn: status == "withdrawn"
        case .all: true
        }
    }
}

enum DisposalFormat {
    /// Local time zone both ways so a `DatePicker` day round-trips without shifting.
    static let isoDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static let displayDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_GB")
        formatter.timeZone = .current
        formatter.dateStyle = .medium
        return formatter
    }()

    /// Whole pounds for editing (pence → "25000"). Empty when unset.
    static func poundsText(_ pence: Int?) -> String {
        guard let pence else { return "" }
        if pence % 100 == 0 { return String(pence / 100) }
        return String(format: "%.2f", Double(pence) / 100)
    }

    /// "25,000" / "25000.50" → pence. Nil for blank; `.invalid` for junk.
    static func pence(from text: String) -> ParsedNumber<Int> {
        let cleaned = text.replacingOccurrences(of: ",", with: "")
            .replacingOccurrences(of: "£", with: "")
            .trimmingCharacters(in: .whitespaces)
        if cleaned.isEmpty { return .blank }
        guard let value = Decimal(string: cleaned, locale: Locale(identifier: "en_US_POSIX")),
              value >= 0
        else { return .invalid }
        var scaled = value * 100
        var rounded = Decimal()
        NSDecimalRound(&rounded, &scaled, 0, .plain)
        return .value(NSDecimalNumber(decimal: rounded).intValue)
    }

    static func sqftText(_ value: Double?) -> String {
        guard let value else { return "" }
        return value.rounded() == value ? String(Int(value)) : String(value)
    }

    static func sqft(from text: String) -> ParsedNumber<Double> {
        let cleaned = text.replacingOccurrences(of: ",", with: "").trimmingCharacters(in: .whitespaces)
        if cleaned.isEmpty { return .blank }
        guard let value = Double(cleaned), value >= 0, value.isFinite else { return .invalid }
        return .value(value)
    }

    static func money(_ value: Double?) -> String? {
        guard let value, value > 0 else { return nil }
        return value.formatted(.currency(code: "GBP").locale(Locale(identifier: "en_GB")))
    }
}

enum DisposalPatchValue: Sendable, Equatable {
    case text(String)
    case int(Int)
    case number(Double)
    case null

    var jsonValue: Any {
        switch self {
        case .text(let value): value
        case .int(let value): value
        case .number(let value): value
        case .null: NSNull()
        }
    }
}

enum ParsedNumber<Value: Equatable>: Equatable {
    case blank
    case value(Value)
    case invalid

    var value: Value? {
        if case .value(let value) = self { return value }
        return nil
    }
}

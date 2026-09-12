import Foundation

struct FinanceMonthPoint: Decodable, Equatable, Identifiable, Hashable {
    var month: String
    var monthKey: String
    var income: Double
    var outgoings: Double
    var net: Double
    var isCurrent: Bool

    var id: String { monthKey.isEmpty ? month : monthKey }

    enum CodingKeys: String, CodingKey {
        case month, income, outgoings, expenses, net
        case monthKey = "month_key"
        case isCurrent = "is_current"
    }

    init(
        month: String,
        monthKey: String,
        income: Double,
        outgoings: Double,
        net: Double,
        isCurrent: Bool
    ) {
        self.month = month
        self.monthKey = monthKey
        self.income = income
        self.outgoings = outgoings
        self.net = net
        self.isCurrent = isCurrent
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        month = try container.decodeIfPresent(String.self, forKey: .month) ?? ""
        monthKey = try container.decodeIfPresent(String.self, forKey: .monthKey) ?? month
        income = Self.decodeAmount(container, key: .income)
        if container.contains(.outgoings) {
            outgoings = Self.decodeAmount(container, key: .outgoings)
        } else {
            outgoings = Self.decodeAmount(container, key: .expenses)
        }
        net = Self.decodeAmount(container, key: .net)
        isCurrent = try container.decodeIfPresent(Bool.self, forKey: .isCurrent) ?? false
    }

    private static func decodeAmount(
        _ container: KeyedDecodingContainer<CodingKeys>,
        key: CodingKeys
    ) -> Double {
        if let value = try? container.decodeIfPresent(Double.self, forKey: key) {
            return value
        }
        if let value = try? container.decodeIfPresent(Int.self, forKey: key) {
            return Double(value)
        }
        return 0
    }

    var hasActivity: Bool {
        income > 0 || outgoings > 0
    }
}

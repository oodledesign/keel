import Foundation

struct InvoicesPayload: Decodable, Equatable {
    var items: [InvoiceItem]

    static let empty = InvoicesPayload(items: [])

    enum CodingKeys: String, CodingKey {
        case items, invoices
    }

    init(items: [InvoiceItem]) {
        self.items = items
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let items = try container.decodeIfPresent([InvoiceItem].self, forKey: .items) {
            self.items = items
        } else if let invoices = try container.decodeIfPresent([InvoiceItem].self, forKey: .invoices) {
            self.items = invoices
        } else {
            items = []
        }
    }
}

struct InvoiceLine: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var description: String
    var amount: String
    var amountPence: Int?

    enum CodingKeys: String, CodingKey {
        case id, description, amount
        case amountPence = "amount_pence"
    }

    init(id: String = UUID().uuidString, description: String, amount: String, amountPence: Int? = nil) {
        self.id = id
        self.description = description
        self.amount = amount
        self.amountPence = amountPence
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        description = try container.decodeIfPresent(String.self, forKey: .description) ?? "Line"
        amount = try container.decodeIfPresent(String.self, forKey: .amount) ?? ""
        amountPence = try container.decodeIfPresent(Int.self, forKey: .amountPence)
    }
}

struct InvoiceItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var number: String
    var clientName: String
    var status: String
    var due: String?
    var total: String
    var totalPence: Int?
    var balance: String
    var balancePence: Int?
    var currency: String
    var issued: String?
    var paid: String?
    var lines: [InvoiceLine]
    var url: String?
    var webPath: String?

    enum CodingKeys: String, CodingKey {
        case id, number, status, due, total, balance, currency, issued, paid, lines, url
        case clientName = "client_name"
        case totalPence = "total_pence"
        case balancePence = "balance_pence"
        case webPath = "web_path"
        case invoiceNumber = "invoice_number"
    }

    init(
        id: String,
        number: String,
        clientName: String,
        status: String,
        due: String?,
        total: String,
        totalPence: Int? = nil,
        balance: String,
        balancePence: Int? = nil,
        currency: String,
        issued: String? = nil,
        paid: String? = nil,
        lines: [InvoiceLine] = [],
        url: String? = nil,
        webPath: String? = nil
    ) {
        self.id = id
        self.number = number
        self.clientName = clientName
        self.status = status
        self.due = due
        self.total = total
        self.totalPence = totalPence
        self.balance = balance
        self.balancePence = balancePence
        self.currency = currency
        self.issued = issued
        self.paid = paid
        self.lines = lines
        self.url = url
        self.webPath = webPath
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        number = try container.decodeIfPresent(String.self, forKey: .number)
            ?? container.decodeIfPresent(String.self, forKey: .invoiceNumber)
            ?? "Invoice"
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName) ?? "Client"
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "draft"
        due = try container.decodeIfPresent(String.self, forKey: .due)
        total = try container.decodeIfPresent(String.self, forKey: .total) ?? ""
        totalPence = try container.decodeIfPresent(Int.self, forKey: .totalPence)
        balance = try container.decodeIfPresent(String.self, forKey: .balance) ?? total
        balancePence = try container.decodeIfPresent(Int.self, forKey: .balancePence)
        currency = try container.decodeIfPresent(String.self, forKey: .currency) ?? "gbp"
        issued = try container.decodeIfPresent(String.self, forKey: .issued)
        paid = try container.decodeIfPresent(String.self, forKey: .paid)
        lines = try container.decodeIfPresent([InvoiceLine].self, forKey: .lines) ?? []
        url = try container.decodeIfPresent(String.self, forKey: .url)
        webPath = try container.decodeIfPresent(String.self, forKey: .webPath)
    }

    var displayNumber: String {
        let trimmed = number.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Invoice" : trimmed
    }

    var displayClient: String {
        let trimmed = clientName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Client" : trimmed
    }

    var displayStatus: String {
        switch status.lowercased() {
        case "sent": "Sent"
        case "read": "Opened"
        case "paid": "Paid"
        case "overdue": "Overdue"
        case "partial": "Partial"
        case "draft": "Draft"
        case "cancelled", "void": "Cancelled"
        default: status.capitalized
        }
    }

    var isOverdue: Bool {
        status.lowercased() == "overdue"
    }

    var dueLabel: String? {
        TaskItem.dueLabel(due)
    }

    var webURL: URL? {
        if let url, let parsed = URL(string: url.trimmingCharacters(in: .whitespacesAndNewlines)),
           parsed.scheme?.lowercased() == "https" {
            return parsed
        }
        guard let webPath else { return nil }
        let path = webPath.hasPrefix("/") ? String(webPath.dropFirst()) : webPath
        return AppConfiguration.apiBaseURL.appending(path: path)
    }
}

struct FinancesPayload: Decodable, Equatable {
    var outstandingBalance: String
    var outstandingBalancePence: Int
    var overdueCount: Int
    var overdueAmount: String
    var overdueAmountPence: Int
    var paidThisMonth: String?
    var paidThisMonthPence: Int?
    var currency: String
    var recent: [InvoiceItem]

    static let empty = FinancesPayload(
        outstandingBalance: "",
        outstandingBalancePence: 0,
        overdueCount: 0,
        overdueAmount: "",
        overdueAmountPence: 0,
        paidThisMonth: nil,
        paidThisMonthPence: nil,
        currency: "gbp",
        recent: []
    )

    enum CodingKeys: String, CodingKey {
        case currency, recent
        case outstandingBalance = "outstanding_balance"
        case outstandingBalancePence = "outstanding_balance_pence"
        case overdueCount = "overdue_count"
        case overdueAmount = "overdue_amount"
        case overdueAmountPence = "overdue_amount_pence"
        case paidThisMonth = "paid_this_month"
        case paidThisMonthPence = "paid_this_month_pence"
    }

    init(
        outstandingBalance: String,
        outstandingBalancePence: Int,
        overdueCount: Int,
        overdueAmount: String,
        overdueAmountPence: Int,
        paidThisMonth: String?,
        paidThisMonthPence: Int?,
        currency: String,
        recent: [InvoiceItem]
    ) {
        self.outstandingBalance = outstandingBalance
        self.outstandingBalancePence = outstandingBalancePence
        self.overdueCount = overdueCount
        self.overdueAmount = overdueAmount
        self.overdueAmountPence = overdueAmountPence
        self.paidThisMonth = paidThisMonth
        self.paidThisMonthPence = paidThisMonthPence
        self.currency = currency
        self.recent = recent
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        outstandingBalance = try container.decodeIfPresent(String.self, forKey: .outstandingBalance) ?? ""
        outstandingBalancePence = try container.decodeIfPresent(Int.self, forKey: .outstandingBalancePence) ?? 0
        overdueCount = try container.decodeIfPresent(Int.self, forKey: .overdueCount) ?? 0
        overdueAmount = try container.decodeIfPresent(String.self, forKey: .overdueAmount) ?? ""
        overdueAmountPence = try container.decodeIfPresent(Int.self, forKey: .overdueAmountPence) ?? 0
        paidThisMonth = try container.decodeIfPresent(String.self, forKey: .paidThisMonth)
        paidThisMonthPence = try container.decodeIfPresent(Int.self, forKey: .paidThisMonthPence)
        currency = try container.decodeIfPresent(String.self, forKey: .currency) ?? "gbp"
        recent = try container.decodeIfPresent([InvoiceItem].self, forKey: .recent) ?? []
    }

    var hasOutstanding: Bool {
        outstandingBalancePence > 0 || overdueCount > 0
    }
}

struct MeetingTodayItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, title
        case createdAt = "created_at"
    }

    init(id: String, title: String, createdAt: String? = nil) {
        self.id = id
        self.title = title
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "Meeting"
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
    }
}

enum InvoiceListStatus: String, CaseIterable, Identifiable {
    case open
    case overdue
    case paid

    var id: String { rawValue }

    var label: String {
        switch self {
        case .open: "Open"
        case .overdue: "Overdue"
        case .paid: "Paid"
        }
    }
}

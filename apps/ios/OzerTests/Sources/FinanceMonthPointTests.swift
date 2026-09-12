import Foundation
@testable import OzerFinance

enum FinanceMonthPointTests {
    static func run(check: (String, () -> Bool) -> Void) {
        check("decodes native month keys including outgoings") {
            let json = Data(
                """
                {
                  "month": "Apr",
                  "month_key": "2026-04",
                  "income": 1200.5,
                  "outgoings": 400,
                  "net": 800.5,
                  "is_current": false
                }
                """.utf8
            )
            let point = try? JSONDecoder().decode(FinanceMonthPoint.self, from: json)
            point?.month == "Apr"
                && point?.monthKey == "2026-04"
                && point?.income == 1200.5
                && point?.outgoings == 400
                && point?.net == 800.5
                && point?.isCurrent == false
                && point?.hasActivity == true
        }

        check("maps web expenses to outgoings when outgoings is missing") {
            let json = Data(
                """
                {
                  "month": "Sep",
                  "income": 0,
                  "expenses": 250,
                  "net": -250,
                  "is_current": true
                }
                """.utf8
            )
            let point = try? JSONDecoder().decode(FinanceMonthPoint.self, from: json)
            point?.monthKey == "Sep"
                && point?.outgoings == 250
                && point?.isCurrent == true
                && point?.hasActivity == true
        }

        check("zero months have no activity") {
            let point = FinanceMonthPoint(
                month: "Sep",
                monthKey: "2026-09",
                income: 0,
                outgoings: 0,
                net: 0,
                isCurrent: true
            )
            !point.hasActivity
        }
    }
}

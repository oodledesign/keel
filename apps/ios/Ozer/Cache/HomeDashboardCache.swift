import Foundation

/// Last successful Home / Today payload, including finances.
/// Shown immediately on the next launch while `/today` refreshes.
struct HomeDashboardSnapshot: Codable, Equatable {
    var greeting: String?
    var title: String?
    var message: String?
    var summary: String?
    var dateLabel: String?
    var tasksDueToday: [TaskItem]
    var overdueTasks: [TaskItem]
    var recentNotes: [NoteItem]
    var meetingsToday: [CachedMeeting]
    var finances: CachedFinances?
    var extraFinances: CachedFinances?
    var invoiceItems: [CachedInvoice]
    var taskReview: CachedTaskReview?
    var surveyor: CachedSurveyor?

    struct CachedMeeting: Codable, Equatable {
        var id: String
        var title: String
        var createdAt: String?
    }

    struct CachedInvoice: Codable, Equatable {
        var id: String
        var number: String
        var clientName: String
        var status: String
        var due: String?
        var total: String
        var balance: String
        var currency: String
    }

    struct CachedMonth: Codable, Equatable {
        var month: String
        var monthKey: String
        var income: Double
        var outgoings: Double
        var net: Double
        var isCurrent: Bool
    }

    struct CachedFinances: Codable, Equatable {
        var outstandingBalance: String
        var outstandingBalancePence: Int
        var overdueCount: Int
        var overdueAmount: String
        var overdueAmountPence: Int
        var paidThisMonth: String?
        var paidThisMonthPence: Int?
        var currency: String
        var recent: [CachedInvoice]
        var period: String
        var periodLabel: String
        var income: String
        var incomePence: Int
        var outgoings: String
        var outgoingsPence: Int
        var net: String
        var netPence: Int
        var hasFinanceData: Bool
        var months: [CachedMonth]
    }

    struct CachedTaskReview: Codable, Equatable {
        var pendingCount: Int
        var meetingCount: Int
        var emailCount: Int
    }

    struct CachedSurveyorSurvey: Codable, Equatable {
        var id: String
        var title: String
        var status: String
        var updatedAt: String?
        var clientName: String?
    }

    struct CachedSurveyorDeal: Codable, Equatable {
        var id: String
        var title: String
        var stage: String
        var stageLabel: String
        var clientName: String?
    }

    struct CachedSurveyor: Codable, Equatable {
        var openCount: Int
        var enquiryCount: Int
        var bookedCount: Int
        var surveyedCount: Int
        var recentSurveys: [CachedSurveyorSurvey]
        var pipeline: [CachedSurveyorDeal]
    }

    static func capture(
        payload: TodayPayload,
        extraFinances: FinancesPayload?,
        recentNotes: [NoteItem],
        invoiceItems: [InvoiceItem]
    ) -> HomeDashboardSnapshot {
        HomeDashboardSnapshot(
            greeting: payload.greeting,
            title: payload.title,
            message: payload.message,
            summary: payload.summary,
            dateLabel: payload.dateLabel,
            tasksDueToday: payload.tasksDueToday,
            overdueTasks: payload.overdueTasks,
            recentNotes: recentNotes,
            meetingsToday: payload.meetingsToday.map {
                CachedMeeting(id: $0.id, title: $0.title, createdAt: $0.createdAt)
            },
            finances: payload.finances.map(CachedFinances.init),
            extraFinances: extraFinances.map(CachedFinances.init),
            invoiceItems: invoiceItems.map(CachedInvoice.init),
            taskReview: payload.taskReview.map {
                CachedTaskReview(
                    pendingCount: $0.pendingCount,
                    meetingCount: $0.meetingCount,
                    emailCount: $0.emailCount
                )
            },
            surveyor: payload.surveyor.map(CachedSurveyor.init)
        )
    }

    var todayPayload: TodayPayload {
        TodayPayload(
            title: title,
            greeting: greeting,
            message: message,
            summary: summary,
            dateLabel: dateLabel,
            items: [],
            tasksDueToday: tasksDueToday,
            overdueTasks: overdueTasks,
            recentNotes: recentNotes,
            meetingsToday: meetingsToday.map {
                MeetingTodayItem(id: $0.id, title: $0.title, createdAt: $0.createdAt)
            },
            finances: finances?.asPayload,
            taskReview: taskReview.map {
                TaskReviewCounts(
                    pendingCount: $0.pendingCount,
                    meetingCount: $0.meetingCount,
                    emailCount: $0.emailCount
                )
            },
            surveyor: surveyor?.asPayload
        )
    }

    var restoredExtraFinances: FinancesPayload? {
        extraFinances?.asPayload
    }

    var restoredNotes: [NoteItem] {
        recentNotes
    }

    var restoredInvoices: [InvoiceItem] {
        invoiceItems.map(\.asItem)
    }
}

extension HomeDashboardSnapshot.CachedInvoice {
    init(_ item: InvoiceItem) {
        id = item.id
        number = item.number
        clientName = item.clientName
        status = item.status
        due = item.due
        total = item.total
        balance = item.balance
        currency = item.currency
    }

    var asItem: InvoiceItem {
        InvoiceItem(
            id: id,
            number: number,
            clientName: clientName,
            status: status,
            due: due,
            total: total,
            balance: balance,
            currency: currency
        )
    }
}

extension HomeDashboardSnapshot.CachedFinances {
    init(_ payload: FinancesPayload) {
        outstandingBalance = payload.outstandingBalance
        outstandingBalancePence = payload.outstandingBalancePence
        overdueCount = payload.overdueCount
        overdueAmount = payload.overdueAmount
        overdueAmountPence = payload.overdueAmountPence
        paidThisMonth = payload.paidThisMonth
        paidThisMonthPence = payload.paidThisMonthPence
        currency = payload.currency
        recent = payload.recent.map(HomeDashboardSnapshot.CachedInvoice.init)
        period = payload.period
        periodLabel = payload.periodLabel
        income = payload.income
        incomePence = payload.incomePence
        outgoings = payload.outgoings
        outgoingsPence = payload.outgoingsPence
        net = payload.net
        netPence = payload.netPence
        hasFinanceData = payload.hasFinanceData
        months = payload.months.map {
            HomeDashboardSnapshot.CachedMonth(
                month: $0.month,
                monthKey: $0.monthKey,
                income: $0.income,
                outgoings: $0.outgoings,
                net: $0.net,
                isCurrent: $0.isCurrent
            )
        }
    }

    var asPayload: FinancesPayload {
        FinancesPayload(
            outstandingBalance: outstandingBalance,
            outstandingBalancePence: outstandingBalancePence,
            overdueCount: overdueCount,
            overdueAmount: overdueAmount,
            overdueAmountPence: overdueAmountPence,
            paidThisMonth: paidThisMonth,
            paidThisMonthPence: paidThisMonthPence,
            currency: currency,
            recent: recent.map(\.asItem),
            period: period,
            periodLabel: periodLabel,
            income: income,
            incomePence: incomePence,
            outgoings: outgoings,
            outgoingsPence: outgoingsPence,
            net: net,
            netPence: netPence,
            hasFinanceData: hasFinanceData,
            months: months.map {
                FinanceMonthPoint(
                    month: $0.month,
                    monthKey: $0.monthKey,
                    income: $0.income,
                    outgoings: $0.outgoings,
                    net: $0.net,
                    isCurrent: $0.isCurrent
                )
            }
        )
    }
}

extension HomeDashboardSnapshot.CachedSurveyor {
    init(_ payload: SurveyorHomePayload) {
        openCount = payload.openCount
        enquiryCount = payload.enquiryCount
        bookedCount = payload.bookedCount
        surveyedCount = payload.surveyedCount
        recentSurveys = payload.recentSurveys.map {
            HomeDashboardSnapshot.CachedSurveyorSurvey(
                id: $0.id,
                title: $0.title,
                status: $0.status,
                updatedAt: $0.updatedAt,
                clientName: $0.clientName
            )
        }
        pipeline = payload.pipeline.map {
            HomeDashboardSnapshot.CachedSurveyorDeal(
                id: $0.id,
                title: $0.title,
                stage: $0.stage,
                stageLabel: $0.stageLabel,
                clientName: $0.clientName
            )
        }
    }

    var asPayload: SurveyorHomePayload {
        SurveyorHomePayload(
            openCount: openCount,
            enquiryCount: enquiryCount,
            bookedCount: bookedCount,
            surveyedCount: surveyedCount,
            recentSurveys: recentSurveys.map {
                SurveyorHomeSurvey(
                    id: $0.id,
                    title: $0.title,
                    status: $0.status,
                    updatedAt: $0.updatedAt,
                    clientName: $0.clientName
                )
            },
            pipeline: pipeline.map {
                SurveyorHomeDeal(
                    id: $0.id,
                    title: $0.title,
                    stage: $0.stage,
                    stageLabel: $0.stageLabel,
                    clientName: $0.clientName
                )
            }
        )
    }
}

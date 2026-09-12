import Charts
import SwiftUI

private enum FinanceChartSeries: String {
    case income = "In"
    case outgoings = "Out"
}

private struct FinanceChartBar: Identifiable {
    var id: String { "\(point.id)-\(series.rawValue)" }
    var point: FinanceMonthPoint
    var series: FinanceChartSeries

    var value: Double {
        series == .income ? point.income : point.outgoings
    }

    var color: Color {
        series == .income ? OzerPalette.coral : OzerPalette.chartOut
    }
}

struct FinanceTrendChart: View {
    var months: [FinanceMonthPoint]

    private var bars: [FinanceChartBar] {
        months.flatMap { point in
            [
                FinanceChartBar(point: point, series: .income),
                FinanceChartBar(point: point, series: .outgoings),
            ]
        }
    }

    var body: some View {
        Chart(bars) { bar in
            BarMark(
                x: .value("Month", bar.point.month),
                y: .value("Amount", bar.value),
                width: .ratio(0.36)
            )
            .foregroundStyle(bar.color)
            .position(by: .value("Series", bar.series.rawValue))
            .cornerRadius(3)
        }
        .chartXAxis {
            AxisMarks(values: months.map(\.month)) { value in
                AxisValueLabel {
                    if let label = value.as(String.self) {
                        Text(label)
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(OzerPalette.plumSoft)
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                    .foregroundStyle(OzerPalette.border)
                AxisValueLabel {
                    if let amount = value.as(Double.self) {
                        Text(Self.compactAxis(amount))
                            .font(.caption2)
                            .foregroundStyle(OzerPalette.plumSoft)
                    }
                }
            }
        }
        .chartLegend(position: .bottom, alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                legendSwatch("In", color: OzerPalette.coral)
                legendSwatch("Out", color: OzerPalette.chartOut)
            }
        }
        .chartPlotStyle { plot in
            plot.background(.clear)
        }
        .frame(height: 168)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(chartAccessibilityLabel)
    }

    private func legendSwatch(_ title: String, color: Color) -> some View {
        HStack(spacing: 5) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(color)
                .frame(width: 8, height: 8)
            Text(title)
                .font(.caption.weight(.medium))
                .foregroundStyle(OzerPalette.plumMuted)
        }
    }

    private var chartAccessibilityLabel: String {
        let parts = months.map { point in
            "\(point.month): in \(Self.compactAxis(point.income)), out \(Self.compactAxis(point.outgoings))"
        }
        return parts.joined(separator: ". ")
    }

    static func compactAxis(_ value: Double) -> String {
        let magnitude = abs(value)
        if magnitude >= 1_000_000 {
            return String(format: "%.1fM", value / 1_000_000)
        }
        if magnitude >= 1000 {
            return String(format: "%.0fk", value / 1000)
        }
        if magnitude >= 100 {
            return String(format: "%.0f", value)
        }
        return String(format: "%.0f", value.rounded())
    }
}

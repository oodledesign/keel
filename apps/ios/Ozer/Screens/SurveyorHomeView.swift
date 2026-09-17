import SwiftUI

struct SurveyorHomeView: View {
    var payload: SurveyorHomePayload
    var onOpen: (AppScreen) -> Void
    var onOpenSurvey: (SurveyItem) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                metrics
                recentSurveysCard
                pipelineCard
                quickLinks
            }
            .padding(.top, 8)
            .padding(.bottom, 12)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Surveyor home")
                .font(.title.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("Pipeline, site meetings, and building survey reports.")
                .font(.subheadline)
                .foregroundStyle(OzerPalette.plumMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var metrics: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            metricCard("Open pipeline", value: payload.openCount, symbol: "list.clipboard")
            metricCard("Enquiry", value: payload.enquiryCount, symbol: "tray")
            metricCard("Booked", value: payload.bookedCount, symbol: "calendar")
            Button {
                onOpen(.surveys)
            } label: {
                metricCard("Surveyed", value: payload.surveyedCount, symbol: "building.columns")
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Surveyed, \(payload.surveyedCount)")
        }
    }

    private func metricCard(_ label: String, value: Int, symbol: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: symbol)
                .font(.caption.weight(.semibold))
                .foregroundStyle(OzerPalette.coral)
            Text("\(value)")
                .font(.title2.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
                .monospacedDigit()
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(OzerPalette.plumMuted)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label), \(value)")
    }

    private var recentSurveysCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader("Recent surveys") {
                onOpen(.surveys)
            }
            if payload.recentSurveys.isEmpty {
                emptyRow("No survey reports yet. Create one from a pipeline item or add a site meeting.")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(payload.recentSurveys.enumerated()), id: \.element.id) { index, survey in
                        Button {
                            onOpenSurvey(survey.asSurveyItem)
                        } label: {
                            compactRow(
                                title: survey.title,
                                subtitle: survey.subtitle,
                                status: survey.status
                            )
                        }
                        .buttonStyle(.plain)
                        if index < payload.recentSurveys.count - 1 {
                            Divider().overlay(OzerPalette.border)
                        }
                    }
                }
            }
        }
        .padding(.bottom, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var pipelineCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Pipeline")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 8)
            if payload.pipeline.isEmpty {
                emptyRow("No open pipeline items yet. Add a lead to start a survey booking.")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(payload.pipeline.enumerated()), id: \.element.id) { index, deal in
                        compactRow(title: deal.title, subtitle: deal.clientName, trailing: deal.stageLabel)
                        if index < payload.pipeline.count - 1 {
                            Divider().overlay(OzerPalette.border)
                        }
                    }
                }
            }
        }
        .padding(.bottom, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var quickLinks: some View {
        VStack(spacing: 10) {
            quickLink("New survey", detail: "Start a building survey report", symbol: "plus") {
                onOpen(.surveys)
            }
            quickLink("Add meeting", detail: "Record or paste a site meeting", symbol: "waveform") {
                onOpen(.meetings)
            }
            quickLink("Clients", detail: "Shared client records for the team", symbol: "building.2") {
                onOpen(.clients)
            }
        }
    }

    private func sectionHeader(_ title: String, action: @escaping () -> Void) -> some View {
        HStack {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Spacer()
            Button(action: action) {
                HStack(spacing: 2) {
                    Text("View all")
                    Image(systemName: "chevron.right")
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(OzerPalette.plumMuted)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 8)
    }

    private func compactRow(
        title: String,
        subtitle: String?,
        trailing: String? = nil,
        status: String? = nil
    ) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(OzerPalette.plum)
                    .lineLimit(1)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            if let status, !status.isEmpty {
                SurveyStatusBadge(status: status)
            } else if let trailing, !trailing.isEmpty {
                Text(trailing)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(OzerPalette.plumMuted)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    private func emptyRow(_ text: String) -> some View {
        Text(text)
            .font(.body)
            .foregroundStyle(OzerPalette.plumMuted)
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func quickLink(
        _ title: String,
        detail: String,
        symbol: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: symbol)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(OzerPalette.coral)
                    .frame(width: 20)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(OzerPalette.plum)
                    Text(detail)
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.plumMuted)
                }
                Spacer(minLength: 0)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                    .stroke(OzerPalette.border, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }
}

import SwiftUI

struct DisposalDetailView: View {
    @Environment(AppSession.self) private var session
    let onSaved: (DisposalItem) -> Void

    @State private var detail: DisposalItem
    @State private var loadError: NativeAPIError?
    @State private var showEditor = false
    @State private var isUpdatingStatus = false
    @State private var statusError: String?

    private let api = NativeAPIClient()

    init(disposal: DisposalItem, onSaved: @escaping (DisposalItem) -> Void = { _ in }) {
        self.onSaved = onSaved
        _detail = State(initialValue: disposal)
    }

    private var canEdit: Bool { detail.canEdit == true }

    private var webURL: URL? {
        guard let slug = session.selectedWorkspace?.slug, !slug.isEmpty else { return nil }
        return AppConfiguration.apiBaseURL.appending(path: "app/\(slug)/listings/\(detail.id)")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let url = detail.httpsCoverURL {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image {
                            image.resizable().scaledToFill()
                        } else {
                            OzerPalette.creamDeep
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 200)
                    .clipShape(RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
                    .accessibilityHidden(true)
                }

                headerCard

                if let loadError {
                    Text(loadError.localizedDescription)
                        .font(.footnote)
                        .foregroundStyle(OzerPalette.plumMuted)
                }

                factsCard

                if let summary = detail.summary {
                    textCard(title: "Summary", body: summary)
                }
                if let description = detail.description {
                    textCard(title: "Description", body: description)
                }
                if let points = detail.keyPoints, !points.isEmpty {
                    keyPointsCard(points)
                }
                if let notes = detail.notes {
                    textCard(title: "Internal notes", body: notes)
                }
                if !detail.agents.isEmpty {
                    textCard(title: "Acting agents", body: detail.agents.joined(separator: ", "))
                }

                if let webURL {
                    Link(destination: webURL) {
                        Label("Photos, brochure and portals on the web", systemImage: "arrow.up.right.square")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(OzerPalette.coral)
                    }
                    .padding(.top, 4)
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .padding(.horizontal, 20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(OzerPalette.cream.ignoresSafeArea())
        .navigationTitle("Disposal")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if canEdit {
                ToolbarItem(placement: .primaryAction) {
                    Button("Edit") { showEditor = true }
                        .fontWeight(.semibold)
                        .foregroundStyle(OzerPalette.coral)
                }
            }
        }
        .task(id: session.workspaceContentKey) {
            await loadDetail()
        }
        .refreshable {
            await loadDetail()
        }
        .sheet(isPresented: $showEditor) {
            DisposalEditView(disposal: detail) { updated in
                apply(updated)
            }
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(detail.name)
                .font(.title2.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            if let address = fullAddress {
                Text(address)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
            }
            HStack(spacing: 8) {
                statusControl
                Text(detail.disposalTypeLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(OzerPalette.plumMuted)
                if let sector = detail.sector {
                    Text("· \(sector)")
                        .font(.caption)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .lineLimit(1)
                }
            }
            if let statusError {
                Text(statusError)
                    .font(.footnote)
                    .foregroundStyle(OzerPalette.coral)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    @ViewBuilder
    private var statusControl: some View {
        if canEdit {
            Menu {
                Picker("Status", selection: statusBinding) {
                    ForEach(DisposalOptions.statuses) { option in
                        Text(option.label).tag(option.value)
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    DisposalStatusBadge(status: detail.status, label: detail.statusLabel)
                    if isUpdatingStatus {
                        ProgressView().controlSize(.mini)
                    } else {
                        Image(systemName: "chevron.down")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(OzerPalette.plumMuted)
                    }
                }
            }
            .disabled(isUpdatingStatus)
            .accessibilityLabel("Status: \(detail.statusLabel). Change status")
        } else {
            DisposalStatusBadge(status: detail.status, label: detail.statusLabel)
        }
    }

    private var statusBinding: Binding<String> {
        Binding(
            get: { detail.status },
            set: { next in
                guard next != detail.status else { return }
                Task { await updateStatus(next) }
            }
        )
    }

    private var fullAddress: String? {
        let parts = [detail.addressLine1, detail.addressLine2, detail.town, detail.county, detail.postcode]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
        if !parts.isEmpty { return parts.joined(separator: ", ") }
        return detail.address
    }

    private var facts: [(String, String)] {
        var rows: [(String, String)] = []
        if let rent = detail.rentLabel { rows.append(("Asking rent", rent)) }
        if let price = detail.priceLabel { rows.append(("Asking price", price)) }
        if let size = detail.sizeLabel { rows.append(("Size", size)) }
        if let charge = DisposalFormat.money(detail.serviceChargePerSqft) {
            rows.append(("Service charge", "\(charge) / sq ft"))
        }
        if let rates = DisposalFormat.money(detail.ratesPayablePerSqft) {
            rows.append(("Rates payable", "\(rates) / sq ft"))
        }
        if let date = detail.availableFromDate {
            rows.append(("Available from", DisposalFormat.displayDay.string(from: date)))
        }
        if let tenure = detail.tenure { rows.append(("Tenure", tenure)) }
        if let useClass = detail.useClassLabel { rows.append(("Use class", useClass)) }
        if let band = detail.epcBand {
            let rating = detail.epcRating.map { " (\($0))" } ?? ""
            rows.append(("EPC", "\(band)\(rating)"))
        }
        return rows
    }

    @ViewBuilder
    private var factsCard: some View {
        let rows = facts
        if rows.isEmpty {
            if canEdit {
                Button {
                    showEditor = true
                } label: {
                    Label("Add terms and size", systemImage: "plus")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(OzerPalette.coral)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Text(row.0)
                            .font(.subheadline)
                            .foregroundStyle(OzerPalette.plumMuted)
                        Spacer(minLength: 8)
                        Text(row.1)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(OzerPalette.plum)
                            .multilineTextAlignment(.trailing)
                    }
                    .padding(.vertical, 10)
                    if index < rows.count - 1 {
                        Divider().overlay(OzerPalette.border)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 4)
            .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                    .stroke(OzerPalette.border, lineWidth: 1)
            }
        }
    }

    private func textCard(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(OzerPalette.plumMuted)
            Text(body)
                .font(.body)
                .foregroundStyle(OzerPalette.plum)
                .textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func keyPointsCard(_ points: [String]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Key points")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(OzerPalette.plumMuted)
            ForEach(Array(points.enumerated()), id: \.offset) { _, point in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("•").foregroundStyle(OzerPalette.coral)
                    Text(point)
                        .font(.body)
                        .foregroundStyle(OzerPalette.plum)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func apply(_ updated: DisposalItem) {
        detail = updated
        onSaved(updated)
    }

    private func updateStatus(_ status: String) async {
        isUpdatingStatus = true
        statusError = nil
        defer { isUpdatingStatus = false }
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            let updated = try await api.updateDisposal(
                id: detail.id,
                workspace: workspace,
                changes: ["status": .text(status)],
                accessToken: token
            )
            apply(updated)
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            statusError = error.localizedDescription
        } catch {
            if error.isTaskCancellation { return }
            statusError = error.localizedDescription
        }
    }

    private func loadDetail() async {
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            detail = try await api.disposal(id: detail.id, workspace: workspace, accessToken: token)
            loadError = nil
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            loadError = error
        } catch {
            if error.isTaskCancellation { return }
            loadError = .transport(error.localizedDescription)
        }
    }
}

struct DisposalEditView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss

    let original: DisposalItem
    let onSaved: (DisposalItem) -> Void

    @State private var name: String
    @State private var status: String
    @State private var rentFrom: String
    @State private var rentTo: String
    @State private var rentFrequency: String
    @State private var priceQualifier: String
    @State private var price: String
    @State private var sizeMin: String
    @State private var sizeMax: String
    @State private var hasAvailableFrom: Bool
    @State private var availableFrom: Date
    @State private var summary: String
    @State private var marketingDescription: String
    @State private var notes: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let api = NativeAPIClient()
    private static let summaryLimit = 140

    init(disposal: DisposalItem, onSaved: @escaping (DisposalItem) -> Void) {
        original = disposal
        self.onSaved = onSaved
        _name = State(initialValue: disposal.name)
        _status = State(initialValue: disposal.status)
        _rentFrom = State(initialValue: DisposalFormat.poundsText(disposal.askingRentPence))
        _rentTo = State(initialValue: DisposalFormat.poundsText(disposal.askingRentToPence))
        _rentFrequency = State(initialValue: disposal.rentFrequency ?? "per_annum")
        _priceQualifier = State(initialValue: disposal.askingPriceQualifier ?? "none")
        _price = State(initialValue: DisposalFormat.poundsText(disposal.askingPricePence))
        _sizeMin = State(initialValue: DisposalFormat.sqftText(disposal.sizeMinSqft))
        _sizeMax = State(initialValue: DisposalFormat.sqftText(disposal.sizeMaxSqft))
        _hasAvailableFrom = State(initialValue: disposal.availableFromDate != nil)
        _availableFrom = State(initialValue: disposal.availableFromDate ?? Date())
        _summary = State(initialValue: disposal.summary ?? "")
        _marketingDescription = State(initialValue: disposal.description ?? "")
        _notes = State(initialValue: disposal.notes ?? "")
    }

    private var showsRent: Bool {
        original.disposalType == "to_let" || original.disposalType == "to_let_and_for_sale"
            || original.askingRentPence != nil
    }

    private var showsPrice: Bool {
        original.disposalType != "to_let" || original.askingPricePence != nil
    }

    private var trimmedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $name)
                        .foregroundStyle(OzerPalette.plum)
                    Picker("Status", selection: $status) {
                        ForEach(DisposalOptions.statuses) { option in
                            Text(option.label).tag(option.value)
                        }
                    }
                    .tint(OzerPalette.plum)
                } footer: {
                    Text("Marketing and Under offer can publish to your website and portals.")
                }

                if showsRent {
                    Section("Asking rent") {
                        poundsField("From", text: $rentFrom)
                        poundsField("To (optional)", text: $rentTo)
                        Picker("Frequency", selection: $rentFrequency) {
                            ForEach(DisposalOptions.rentFrequencies) { option in
                                Text(option.label).tag(option.value)
                            }
                        }
                        .tint(OzerPalette.plum)
                    }
                }

                if showsPrice {
                    Section("Asking price") {
                        Picker("Prefix", selection: $priceQualifier) {
                            ForEach(DisposalOptions.priceQualifiers) { option in
                                Text(option.label).tag(option.value)
                            }
                        }
                        .tint(OzerPalette.plum)
                        poundsField("Price", text: $price)
                    }
                }

                Section("Size (sq ft)") {
                    numberField("Minimum", text: $sizeMin)
                    numberField("Maximum", text: $sizeMax)
                }

                Section {
                    Toggle("Available from", isOn: $hasAvailableFrom)
                        .tint(OzerPalette.coral)
                    if hasAvailableFrom {
                        DatePicker("Date", selection: $availableFrom, displayedComponents: .date)
                            .datePickerStyle(.compact)
                            .tint(OzerPalette.coral)
                    }
                }

                Section {
                    TextField("One-line summary", text: $summary, axis: .vertical)
                        .lineLimit(2...4)
                        .foregroundStyle(OzerPalette.plum)
                    TextField("Description", text: $marketingDescription, axis: .vertical)
                        .lineLimit(4...12)
                        .foregroundStyle(OzerPalette.plum)
                } header: {
                    Text("Marketing copy")
                } footer: {
                    Text("Summary \(summary.count)/\(Self.summaryLimit)")
                        .foregroundStyle(summary.count > Self.summaryLimit ? OzerPalette.coral : OzerPalette.plumSoft)
                }

                Section {
                    TextField("Notes for your team", text: $notes, axis: .vertical)
                        .lineLimit(3...10)
                        .foregroundStyle(OzerPalette.plum)
                } header: {
                    Text("Internal notes")
                } footer: {
                    Text("Never shown on brochures or portals.")
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(OzerPalette.coral)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(OzerPalette.cream)
            .navigationTitle("Edit disposal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(OzerPalette.plumMuted)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button("Save") {
                            Task { await save() }
                        }
                        .fontWeight(.semibold)
                        .foregroundStyle(OzerPalette.coral)
                        .disabled(trimmedName.isEmpty || summary.count > Self.summaryLimit)
                    }
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
    }

    private func poundsField(_ label: String, text: Binding<String>) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(OzerPalette.plum)
            Spacer()
            Text("£")
                .foregroundStyle(OzerPalette.plumMuted)
            TextField("0", text: text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .foregroundStyle(OzerPalette.plum)
                .frame(maxWidth: 160)
                .accessibilityLabel("\(label) in pounds")
        }
    }

    private func numberField(_ label: String, text: Binding<String>) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(OzerPalette.plum)
            Spacer()
            TextField("0", text: text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .foregroundStyle(OzerPalette.plum)
                .frame(maxWidth: 160)
                .accessibilityLabel("\(label) square feet")
        }
    }

    /// Only fields that differ from the loaded disposal, so concurrent web edits to other fields survive.
    private func buildChanges() throws -> [String: DisposalPatchValue] {
        var changes: [String: DisposalPatchValue] = [:]

        if trimmedName != original.name { changes["name"] = .text(trimmedName) }
        if status != original.status { changes["status"] = .text(status) }

        if showsRent {
            try setPence(rentFrom, original: original.askingRentPence, key: "asking_rent_pence", label: "Asking rent", into: &changes)
            try setPence(rentTo, original: original.askingRentToPence, key: "asking_rent_to_pence", label: "Rent to", into: &changes)
            // The picker shows "Per annum" for an unset frequency; store it once a rent is entered.
            let frequencyChanged = rentFrequency != (original.rentFrequency ?? "per_annum")
            let firstRent = original.rentFrequency == nil && changes["asking_rent_pence"] != nil
            if frequencyChanged || firstRent {
                changes["rent_frequency"] = .text(rentFrequency)
            }
        }

        if showsPrice {
            try setPence(price, original: original.askingPricePence, key: "asking_price_pence", label: "Asking price", into: &changes)
            if priceQualifier != (original.askingPriceQualifier ?? "none") {
                changes["asking_price_qualifier"] = .text(priceQualifier)
            }
        }

        let minSize = try parsedSqft(sizeMin, label: "Minimum size")
        let maxSize = try parsedSqft(sizeMax, label: "Maximum size")
        if let minSize, let maxSize, minSize > maxSize {
            throw DisposalEditError("Minimum size can’t be more than the maximum.")
        }
        if sizeMin != DisposalFormat.sqftText(original.sizeMinSqft) {
            changes["size_min_sqft"] = minSize.map { .number($0) } ?? .null
        }
        if sizeMax != DisposalFormat.sqftText(original.sizeMaxSqft) {
            changes["size_max_sqft"] = maxSize.map { .number($0) } ?? .null
        }

        let nextAvailable = hasAvailableFrom ? DisposalFormat.isoDay.string(from: availableFrom) : nil
        let originalAvailable = original.availableFrom.map { String($0.prefix(10)) }
        if nextAvailable != originalAvailable {
            changes["available_from"] = nextAvailable.map { .text($0) } ?? .null
        }

        setText(summary, original: original.summary, key: "summary", into: &changes)
        setText(marketingDescription, original: original.description, key: "description", into: &changes)
        setText(notes, original: original.notes, key: "notes", into: &changes)

        return changes
    }

    private func setPence(
        _ text: String,
        original: Int?,
        key: String,
        label: String,
        into changes: inout [String: DisposalPatchValue]
    ) throws {
        switch DisposalFormat.pence(from: text) {
        case .invalid:
            throw DisposalEditError("\(label) must be a number.")
        case .blank:
            if original != nil { changes[key] = .null }
        case .value(let pence):
            if pence != original { changes[key] = .int(pence) }
        }
    }

    private func parsedSqft(_ text: String, label: String) throws -> Double? {
        switch DisposalFormat.sqft(from: text) {
        case .invalid: throw DisposalEditError("\(label) must be a number.")
        case .blank: return nil
        case .value(let value): return value
        }
    }

    private func setText(
        _ text: String,
        original: String?,
        key: String,
        into changes: inout [String: DisposalPatchValue]
    ) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let next: String? = trimmed.isEmpty ? nil : trimmed
        guard next != original else { return }
        changes[key] = next.map { .text($0) } ?? .null
    }

    private func save() async {
        errorMessage = nil
        let changes: [String: DisposalPatchValue]
        do {
            changes = try buildChanges()
        } catch let error as DisposalEditError {
            errorMessage = error.message
            return
        } catch {
            errorMessage = error.localizedDescription
            return
        }
        guard !changes.isEmpty else {
            dismiss()
            return
        }

        isSaving = true
        defer { isSaving = false }
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            let updated = try await api.updateDisposal(
                id: original.id,
                workspace: workspace,
                changes: changes,
                accessToken: token
            )
            onSaved(updated)
            dismiss()
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            errorMessage = error.localizedDescription
        } catch {
            if error.isTaskCancellation { return }
            errorMessage = error.localizedDescription
        }
    }
}

private struct DisposalEditError: Error {
    let message: String
    init(_ message: String) { self.message = message }
}

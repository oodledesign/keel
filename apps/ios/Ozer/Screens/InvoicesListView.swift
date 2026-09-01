import SwiftUI

struct InvoicesListView: View {
    @Environment(AppSession.self) private var session
    @State private var payload: InvoicesPayload?
    @State private var finances: FinancesPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var statusFilter: InvoiceListStatus = .open
    @State private var pendingInvoice: InvoiceItem?

    private let client = NativeAPIClient()

    private var reloadKey: String {
        "\(session.workspaceContentKey)|\(statusFilter.rawValue)"
    }

    private var showsInvoices: Bool {
        session.selectedWorkspace?.showsInvoices == true
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if showsInvoices, !session.workspaceQueryValue.isEmpty {
                    filterBar
                }
                Group {
                    if !showsInvoices && session.workspacesLoaded {
                        unavailableCard
                    } else if isLoading && payload == nil && loadError == nil {
                        ProgressView()
                            .tint(OzerPalette.coral)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if let loadError {
                        statusCard(error: loadError)
                    } else if session.workspacesLoaded && session.workspaceQueryValue.isEmpty {
                        membershipsEmptyCard
                    } else if let payload, !payload.items.isEmpty {
                        content(payload)
                    } else {
                        emptyCard()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 88)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Invoices")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    WorkspaceChip()
                }
            }
            .navigationDestination(item: $pendingInvoice) { invoice in
                InvoiceDetailView(invoice: invoice)
            }
            .task(id: reloadKey) {
                await load()
            }
            .refreshable {
                await session.refreshWorkspaces()
                await load()
            }
            .onChange(of: session.pendingInvoiceId) { _, id in
                Task { await openPendingInvoice(id) }
            }
            .task {
                await openPendingInvoice(session.pendingInvoiceId)
            }
        }
    }

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(InvoiceListStatus.allCases) { item in
                    TaskFilterChip(
                        title: item.label,
                        isSelected: item == statusFilter
                    ) {
                        statusFilter = item
                    }
                }
            }
        }
        .padding(.top, 8)
        .padding(.bottom, 12)
    }

    private func content(_ payload: InvoicesPayload) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let finances {
                    financesHeader(finances)
                }
                ForEach(payload.items) { item in
                    NavigationLink {
                        InvoiceDetailView(invoice: item)
                    } label: {
                        invoiceRow(item)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 8)
        }
    }

    private func financesHeader(_ finances: FinancesPayload) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Outstanding")
                .font(.caption.weight(.semibold))
                .foregroundStyle(OzerPalette.plumMuted)
                .textCase(.uppercase)
            Text(finances.outstandingBalance.isEmpty ? "—" : finances.outstandingBalance)
                .font(.title.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            if finances.overdueCount > 0 {
                Text(
                    finances.overdueCount == 1
                        ? "1 overdue · \(finances.overdueAmount)"
                        : "\(finances.overdueCount) overdue · \(finances.overdueAmount)"
                )
                .font(.subheadline.weight(.medium))
                .foregroundStyle(OzerPalette.coral)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func invoiceRow(_ item: InvoiceItem) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.displayNumber)
                    .font(.body.weight(.medium))
                    .foregroundStyle(OzerPalette.plum)
                Text(item.displayClient)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .lineLimit(1)
                if let due = item.dueLabel {
                    Text(due)
                        .font(.subheadline)
                        .foregroundStyle(item.isOverdue ? OzerPalette.coral : OzerPalette.plumMuted)
                }
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 4) {
                Text(item.balance)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                Text(item.displayStatus)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(item.isOverdue ? OzerPalette.coral : OzerPalette.plumMuted)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var unavailableCard: some View {
        VStack(spacing: 10) {
            Text("Invoices live on studio workspaces")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("Switch to Oodle, Bracketts, or another business workspace to see invoices.")
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var membershipsEmptyCard: some View {
        VStack(spacing: 12) {
            Text("No workspaces yet")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("When your memberships load, invoices will land here.")
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
            Button("Try again") {
                Task {
                    await session.refreshWorkspaces()
                    await load()
                }
            }
            .buttonStyle(OzerPrimaryButtonStyle())
            .frame(width: 140)
            .disabled(session.isRefreshingWorkspaces)
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func emptyCard() -> some View {
        VStack(spacing: 10) {
            Text("Nothing on this list")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("When there are invoices in this workspace, they will land here. Create and send them on the web.")
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func statusCard(error: NativeAPIError) -> some View {
        VStack(spacing: 12) {
            Text(error == .notFound ? "Invoices aren’t available yet" : "Couldn’t load invoices")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text(error.localizedDescription)
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
            if error != .unauthorized && error != .notFound {
                Button("Try again") {
                    Task { await load() }
                }
                .buttonStyle(OzerPrimaryButtonStyle())
                .frame(width: 140)
            }
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func load() async {
        guard showsInvoices else {
            payload = nil
            finances = nil
            loadError = nil
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let token = try await session.validAccessToken()
            if !session.workspacesLoaded {
                await session.refreshWorkspaces()
            }
            try Task.checkCancellation()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else {
                payload = nil
                loadError = nil
                return
            }
            async let list = client.invoices(
                workspace: workspace,
                status: statusFilter.rawValue,
                accessToken: token
            )
            async let pocket = client.finances(workspace: workspace, accessToken: token)
            payload = try await list
            finances = try? await pocket
            loadError = nil
        } catch is CancellationError {
            return
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            payload = nil
            loadError = error
        } catch {
            if error.isTaskCancellation { return }
            payload = nil
            loadError = .transport(error.localizedDescription)
        }
    }

    private func openPendingInvoice(_ id: String?) async {
        guard let id, !id.isEmpty else { return }
        session.clearPendingInvoice()
        if let match = payload?.items.first(where: { $0.id == id }) {
            pendingInvoice = match
            return
        }
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            pendingInvoice = try await client.invoice(
                id: id,
                workspace: workspace,
                accessToken: token
            )
        } catch {
            return
        }
    }
}

struct InvoiceDetailView: View {
    @Environment(AppSession.self) private var session
    let invoice: InvoiceItem

    @State private var detail: InvoiceItem
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false

    private let api = NativeAPIClient()

    init(invoice: InvoiceItem) {
        self.invoice = invoice
        _detail = State(initialValue: invoice)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(detail.displayNumber)
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(OzerPalette.plum)
                    Text(detail.displayClient)
                        .font(.body)
                        .foregroundStyle(OzerPalette.plumMuted)
                    HStack {
                        Text(detail.displayStatus)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(detail.isOverdue ? OzerPalette.coral : OzerPalette.plum)
                        Spacer()
                        Text(detail.balance)
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(OzerPalette.plum)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                        .stroke(OzerPalette.border, lineWidth: 1)
                }

                factsCard

                if !detail.lines.isEmpty {
                    linesCard
                }

                if let url = detail.webURL {
                    Link(destination: url) {
                        HStack {
                            Text("Open in Ozer")
                            Spacer()
                            Image(systemName: "arrow.up.right")
                        }
                        .font(.body.weight(.semibold))
                        .foregroundStyle(OzerPalette.coral)
                        .padding(16)
                        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                                .stroke(OzerPalette.border, lineWidth: 1)
                        }
                    }
                }

                if let loadError {
                    Text(loadError.localizedDescription)
                        .font(.footnote)
                        .foregroundStyle(OzerPalette.plumMuted)
                }
            }
            .padding(.top, 8)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 88)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(OzerPalette.cream.ignoresSafeArea())
        .navigationTitle("Invoice")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: invoice.id) {
            await loadDetail()
        }
    }

    private var factsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            fact("Total", detail.total)
            if let due = detail.dueLabel {
                fact("Due", due, highlight: detail.isOverdue)
            }
            if let issued = dateLabel(detail.issued) {
                fact("Issued", issued)
            }
            if let paid = dateLabel(detail.paid) {
                fact("Paid", paid)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var linesCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Lines")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            ForEach(detail.lines) { line in
                HStack(alignment: .firstTextBaseline) {
                    Text(line.description)
                        .font(.body)
                        .foregroundStyle(OzerPalette.plum)
                    Spacer()
                    Text(line.amount)
                        .font(.body.weight(.medium))
                        .foregroundStyle(OzerPalette.plum)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func fact(_ label: String, _ value: String, highlight: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.footnote.weight(.medium))
                .foregroundStyle(OzerPalette.plumMuted)
            Text(value)
                .font(.body)
                .foregroundStyle(highlight ? OzerPalette.coral : OzerPalette.plum)
        }
    }

    private func dateLabel(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        if let date = NoteItem.parseISO8601(iso) {
            return TaskItem.dueLabel(TaskItem.dueString(from: date))
        }
        return TaskItem.dueLabel(iso)
    }

    private func loadDetail() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            detail = try await api.invoice(
                id: invoice.id,
                workspace: workspace,
                accessToken: token
            )
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

import SwiftUI

struct DisposalsListView: View {
    @Environment(AppSession.self) private var session
    @State private var payload: DisposalsPayload?
    @State private var loadError: NativeAPIError?
    @State private var filter: DisposalListFilter = .live
    @State private var search = ""
    @State private var loadedSearch = ""
    @State private var needsReload = false

    private let client = NativeAPIClient()

    private var reloadKey: String {
        "\(session.workspaceContentKey)|\(filter.rawValue)|\(search)"
    }

    private var showsDisposals: Bool {
        session.selectedWorkspace?.showsDisposals == true
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                pageHeader
                if showsDisposals, !session.workspaceQueryValue.isEmpty {
                    toolbar
                }
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .padding(.bottom, 88)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Disposals")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    WorkspaceChip()
                }
                ToolbarItem(placement: .principal) {
                    Color.clear
                        .frame(width: 0, height: 0)
                        .accessibilityHidden(true)
                }
            }
            .task(id: reloadKey) {
                if search != loadedSearch {
                    try? await Task.sleep(for: .milliseconds(300))
                    if Task.isCancelled { return }
                }
                await load()
            }
            .refreshable {
                await session.refreshWorkspaces()
                await load()
            }
        }
    }

    private var pageHeader: some View {
        Text("Disposals")
            .font(.largeTitle.weight(.bold))
            .foregroundStyle(OzerPalette.plum)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.top, 4)
            .padding(.bottom, 8)
            .accessibilityAddTraits(.isHeader)
    }

    private var toolbar: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(OzerPalette.plumSoft)
                TextField("Search name, address or postcode", text: $search)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .foregroundStyle(OzerPalette.plum)
                if !search.isEmpty {
                    Button {
                        search = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(OzerPalette.plumSoft)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear search")
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(OzerPalette.border, lineWidth: 1)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(DisposalListFilter.allCases) { item in
                        TaskFilterChip(title: item.label, isSelected: item == filter) {
                            filter = item
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 4)
        .padding(.bottom, 12)
    }

    @ViewBuilder
    private var content: some View {
        if !showsDisposals && session.workspacesLoaded {
            infoCard(
                title: "Disposals live on commercial workspaces",
                message: "Switch to a commercial property workspace to see its disposals."
            )
            .padding(.horizontal, 20)
        } else if payload == nil && loadError == nil &&
            !(session.workspacesLoaded && session.workspaceQueryValue.isEmpty)
        {
            OzerListSkeleton(accessibilityLabel: "Loading disposals")
                .padding(.horizontal, 20)
        } else if let loadError {
            statusCard(error: loadError)
                .padding(.horizontal, 20)
        } else if session.workspacesLoaded && session.workspaceQueryValue.isEmpty {
            infoCard(
                title: "No workspaces yet",
                message: "When your memberships load, disposals will land here."
            )
            .padding(.horizontal, 20)
        } else if let payload, !payload.items.isEmpty {
            list(payload)
                .padding(.horizontal, 20)
        } else {
            infoCard(
                title: search.isEmpty ? "Nothing on this list" : "No matches",
                message: search.isEmpty
                    ? "Disposals with this status will land here. Add new ones on the web."
                    : "Try a different name, street or postcode."
            )
            .padding(.horizontal, 20)
        }
    }

    private func list(_ payload: DisposalsPayload) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                ForEach(payload.items) { item in
                    NavigationLink {
                        DisposalDetailView(disposal: item.withCanEdit(payload.canEdit)) { updated in
                            replace(updated)
                        }
                    } label: {
                        DisposalRow(item: item)
                    }
                    .buttonStyle(.plain)
                }
                if payload.total > payload.items.count {
                    Text("Showing \(payload.items.count) of \(payload.total). Search to find the rest.")
                        .font(.footnote)
                        .foregroundStyle(OzerPalette.plumSoft)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
            }
            .padding(.top, 4)
            .padding(.bottom, 12)
        }
        .scrollDismissesKeyboard(.immediately)
        .onAppear {
            guard needsReload else { return }
            needsReload = false
            Task { await load() }
        }
    }

    private func replace(_ updated: DisposalItem) {
        guard var current = payload,
              let index = current.items.firstIndex(where: { $0.id == updated.id })
        else { return }
        current.items[index] = updated
        payload = current
        // Removing the row now would pop its open detail page; reload on return instead.
        if !filter.includes(status: updated.status) {
            needsReload = true
        }
    }

    private func infoCard(title: String, message: String) -> some View {
        VStack(spacing: 10) {
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text(message)
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
            Text(error == .notFound ? "Disposals aren’t available here" : "Couldn’t load disposals")
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
        guard showsDisposals else {
            payload = nil
            loadError = nil
            return
        }
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
            let query = search
            payload = try await client.disposals(
                workspace: workspace,
                filter: filter,
                search: query,
                accessToken: token
            )
            loadedSearch = query
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
}

private struct DisposalRow: View {
    let item: DisposalItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            DisposalCoverImage(url: item.httpsCoverURL, size: 64)
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(item.name)
                        .font(.body.weight(.medium))
                        .foregroundStyle(OzerPalette.plum)
                        .lineLimit(2)
                    Spacer(minLength: 4)
                    DisposalStatusBadge(status: item.status, label: item.statusLabel)
                }
                if let address = item.address {
                    Text(address)
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .lineLimit(1)
                }
                Text(detailLine)
                    .font(.caption)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .lineLimit(1)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
    }

    private var detailLine: String {
        [item.disposalTypeLabel, item.sizeLabel, item.termsLabel]
            .compactMap { $0 }
            .joined(separator: " · ")
    }
}

struct DisposalStatusBadge: View {
    let status: String
    let label: String

    var body: some View {
        Text(label)
            .font(.caption.weight(.semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(tint.opacity(0.12), in: Capsule())
    }

    private var tint: Color {
        switch status {
        case "marketing": OzerPalette.coral
        case "under_offer": OzerPalette.info
        case "let", "sold": OzerPalette.plum
        default: OzerPalette.plumMuted
        }
    }
}

struct DisposalCoverImage: View {
    let url: URL?
    var size: CGFloat

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .accessibilityHidden(true)
    }

    private var placeholder: some View {
        ZStack {
            OzerPalette.creamDeep
            Image(systemName: "building")
                .font(.system(size: size * 0.35, weight: .regular))
                .foregroundStyle(OzerPalette.plumSoft)
        }
    }
}

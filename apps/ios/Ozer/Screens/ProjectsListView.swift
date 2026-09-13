import SwiftUI

struct ProjectsListView: View {
    @Environment(AppSession.self) private var session
    @State private var payload: ProjectsPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var hubView: ProjectHubView = .list
    @State private var listFilter: ProjectListFilter = .open

    private let client = NativeAPIClient()

    private var reloadKey: String {
        let status = hubView == .board ? "all" : listFilter.rawValue
        return "\(session.workspaceContentKey)|\(hubView.rawValue)|\(status)"
    }

    private var showsProjects: Bool {
        session.selectedWorkspace?.showsProjects == true
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if showsProjects, !session.workspaceQueryValue.isEmpty {
                    toolbar
                }
                Group {
                    if !showsProjects && session.workspacesLoaded {
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
                        if hubView == .list {
                            listContent(payload.items)
                        } else {
                            boardContent(payload)
                        }
                    } else {
                        emptyCard()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Projects")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    WorkspaceChip()
                }
            }
            .task(id: reloadKey) {
                await load()
            }
            .refreshable {
                await session.refreshWorkspaces()
                await load()
            }
        }
    }

    private var toolbar: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("View", selection: $hubView) {
                ForEach(ProjectHubView.allCases) { item in
                    Text(item.label).tag(item)
                }
            }
            .pickerStyle(.segmented)

            if hubView == .list {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(ProjectListFilter.allCases) { item in
                            TaskFilterChip(
                                title: item.label,
                                isSelected: item == listFilter
                            ) {
                                listFilter = item
                            }
                        }
                    }
                }
            }
        }
        .padding(.top, 8)
        .padding(.bottom, 12)
    }

    private func listContent(_ items: [ProjectItem]) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(items) { item in
                    NavigationLink {
                        ProjectDetailView(project: item)
                    } label: {
                        projectRow(item)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 8)
        }
    }

    private func boardContent(_ payload: ProjectsPayload) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 12) {
                ForEach(payload.statuses) { column in
                    let items = payload.items.filter { $0.status == column.slug }
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text(column.label)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(OzerPalette.plum)
                            Spacer()
                            Text("\(items.count)")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(OzerPalette.plumMuted)
                        }
                        if items.isEmpty {
                            Text("Nothing here")
                                .font(.footnote)
                                .foregroundStyle(OzerPalette.plumSoft)
                                .padding(.vertical, 12)
                        } else {
                            ForEach(items) { item in
                                NavigationLink {
                                    ProjectDetailView(project: item)
                                } label: {
                                    projectBoardCard(item)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(12)
                    .frame(width: 260, alignment: .topLeading)
                    .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                            .stroke(OzerPalette.border, lineWidth: 1)
                    }
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
    }

    private func projectRow(_ item: ProjectItem) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(item.displayTitle)
                    .font(.body.weight(.medium))
                    .foregroundStyle(OzerPalette.plum)
                Spacer(minLength: 8)
                Text(item.displayStatus)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(OzerPalette.coral)
            }
            if !item.displaySubtitle.isEmpty {
                Text(item.displaySubtitle)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .lineLimit(2)
            }
            ProjectProgressBar(percent: item.progressPct)
            HStack {
                if item.isPhased {
                    Text("Phased")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(OzerPalette.info)
                }
                if item.taskCounts.total > 0 {
                    Text("\(item.taskCounts.open) open · \(item.progressPct)%")
                        .font(.caption)
                        .foregroundStyle(OzerPalette.plumMuted)
                }
                Spacer()
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

    private func projectBoardCard(_ item: ProjectItem) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(item.displayTitle)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
                .lineLimit(2)
            if let client = item.displayClient {
                Text(client)
                    .font(.caption)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .lineLimit(1)
            }
            if let due = item.dueLabel {
                Text(due)
                    .font(.caption)
                    .foregroundStyle(OzerPalette.plumMuted)
            }
            ProjectProgressBar(percent: item.progressPct)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.cream, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var unavailableCard: some View {
        infoCard(
            title: "Projects live on studio workspaces",
            message: "Switch to Oodle, Bracketts, or another business workspace to see projects."
        )
    }

    private var membershipsEmptyCard: some View {
        VStack(spacing: 12) {
            Text("No workspaces yet")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("When your memberships load, projects will land here.")
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
        infoCard(
            title: "Nothing on this list",
            message: hubView == .board
                ? "When there are delivery projects in this workspace, they will show on the board."
                : "When there are delivery projects in this workspace, they will land here."
        )
    }

    private func statusCard(error: NativeAPIError) -> some View {
        VStack(spacing: 12) {
            Text(error == .notFound ? "Projects aren’t available yet" : "Couldn’t load projects")
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

    private func load() async {
        guard showsProjects else {
            payload = nil
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
            let status = hubView == .board ? "all" : listFilter.queryValue
            payload = try await client.projects(
                workspace: workspace,
                status: status,
                accessToken: token
            )
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

struct ProjectProgressBar: View {
    var percent: Int

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(OzerPalette.creamDeep)
                Capsule()
                    .fill(OzerPalette.coral)
                    .frame(width: geo.size.width * CGFloat(min(max(percent, 0), 100)) / 100)
            }
        }
        .frame(height: 6)
        .accessibilityLabel("\(percent) percent complete")
    }
}

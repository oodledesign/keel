import SwiftUI

struct ProjectDetailView: View {
    @Environment(AppSession.self) private var session
    let project: ProjectItem

    @State private var detail: ProjectItem
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var viewMode: ProjectDetailViewMode = .list
    @State private var boardMode: ProjectBoardMode
    @State private var editorTask: TaskItem?
    @State private var showEditor = false
    @State private var completingIds: Set<String> = []

    private let api = NativeAPIClient()

    init(project: ProjectItem) {
        self.project = project
        _detail = State(initialValue: project)
        _boardMode = State(initialValue: project.isPhased ? project.defaultBoardMode : .progress)
    }

    private var tasks: [ProjectTaskItem] {
        detail.tasks
    }

    private var unphasedTasks: [ProjectTaskItem] {
        tasks(in: nil)
    }

    private var datedTasks: [ProjectTaskItem] {
        tasks.filter { $0.due != nil }.sorted {
            ($0.due ?? "") < ($1.due ?? "")
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                headerCard
                viewSwitcher
                if viewMode == .board && detail.isPhased {
                    progressSwitcher
                }

                if isLoading && tasks.isEmpty && loadError == nil && detail.phases.isEmpty {
                    OzerListSkeleton(rows: 4, accessibilityLabel: "Loading project")
                } else if let loadError, tasks.isEmpty && detail.phases.isEmpty {
                    Text(loadError.localizedDescription)
                        .font(.body)
                        .foregroundStyle(OzerPalette.plumMuted)
                } else {
                    switch viewMode {
                    case .list:
                        listContent
                    case .timeline:
                        timelineContent
                    case .board:
                        boardContent
                    }
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 88)
        }
        .padding(.horizontal, 20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(OzerPalette.cream.ignoresSafeArea())
        .navigationTitle("Project")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: session.workspaceContentKey) {
            await loadDetail()
        }
        .sheet(isPresented: $showEditor) {
            TaskEditorView(existing: editorTask) { _ in
                Task { await loadDetail() }
            }
            .presentationDetents([.medium, .large])
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(detail.displayTitle)
                .font(.title2.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            HStack(spacing: 8) {
                Text(detail.displayStatus)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(OzerPalette.coral)
                if detail.isPhased {
                    Text("Phased")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(OzerPalette.info)
                }
            }
            if let client = detail.displayClient {
                labeled("Client", client)
            }
            if let dates = detail.dateRangeLabel {
                labeled("Dates", dates)
            }
            if let value = detail.displayValue {
                labeled("Value", value)
            }
            if let description = detail.descriptionText?
                .trimmingCharacters(in: .whitespacesAndNewlines),
               !description.isEmpty
            {
                Text(description)
                    .font(.body)
                    .foregroundStyle(OzerPalette.plumMuted)
            }
            ProjectProgressBar(percent: detail.progressPct)
            Text("\(detail.progressPct)% · \(detail.taskCounts.open) open of \(max(detail.taskCounts.total, tasks.count))")
                .font(.caption)
                .foregroundStyle(OzerPalette.plumMuted)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var viewSwitcher: some View {
        Picker("View", selection: $viewMode) {
            ForEach(ProjectDetailViewMode.allCases) { item in
                Text(item.label).tag(item)
            }
        }
        .pickerStyle(.segmented)
    }

    private var progressSwitcher: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("How progress is shown")
                .font(.caption.weight(.semibold))
                .foregroundStyle(OzerPalette.plumMuted)
            Picker("Board mode", selection: $boardMode) {
                ForEach(ProjectBoardMode.allCases) { item in
                    Text(item.label).tag(item)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    @ViewBuilder
    private var listContent: some View {
        if detail.isPhased && !detail.phases.isEmpty {
            ForEach(detail.phases) { phase in
                phaseSection(phase, tasks: tasks(in: phase.id))
            }
            if !unphasedTasks.isEmpty {
                phaseSection(nil, tasks: unphasedTasks)
            }
        } else if tasks.isEmpty {
            emptyTasks
        } else {
            ForEach(tasks) { task in
                taskRow(task)
            }
        }
    }

    @ViewBuilder
    private var timelineContent: some View {
        if detail.isPhased && !detail.phases.isEmpty {
            ForEach(detail.phases) { phase in
                timelinePhaseRow(phase)
            }
        }
        if datedTasks.isEmpty && detail.phases.isEmpty {
            emptyTasks
        } else if !datedTasks.isEmpty {
            Text("Tasks")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            ForEach(datedTasks) { task in
                taskRow(task)
            }
        }
    }

    @ViewBuilder
    private var boardContent: some View {
        if boardMode == .phase && detail.isPhased {
            phaseBoard
        } else {
            progressBoard
        }
    }

    private var phaseBoard: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 12) {
                ForEach(detail.phases) { phase in
                    boardColumn(title: phase.name, subtitle: "\(phase.progressPct)%", tasks: tasks(in: phase.id))
                }
                boardColumn(title: "Unphased", subtitle: nil, tasks: tasks(in: nil))
            }
        }
        .contentMargins(.horizontal, 20, for: .scrollContent)
        .padding(.horizontal, -20)
    }

    private var progressBoard: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 12) {
                ForEach(ProjectProgressColumn.allCases) { column in
                    boardColumn(
                        title: column.label,
                        subtitle: nil,
                        tasks: tasks.filter { $0.progressColumn == column.rawValue }
                    )
                }
            }
        }
        .contentMargins(.horizontal, 20, for: .scrollContent)
        .padding(.horizontal, -20)
    }

    private func boardColumn(title: String, subtitle: String?, tasks: [ProjectTaskItem]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                    .lineLimit(1)
                Spacer()
                Text("\(tasks.count)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(OzerPalette.plumMuted)
            }
            if let subtitle {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(OzerPalette.plumMuted)
            }
            if tasks.isEmpty {
                Text("Nothing here")
                    .font(.footnote)
                    .foregroundStyle(OzerPalette.plumSoft)
                    .padding(.vertical, 8)
            } else {
                ForEach(tasks) { task in
                    taskRow(task, compact: true)
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

    private func phaseSection(_ phase: ProjectPhaseItem?, tasks: [ProjectTaskItem]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(phase?.name ?? "Unphased")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                Spacer()
                if let phase {
                    Text("\(phase.progressPct)%")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(OzerPalette.plumMuted)
                }
            }
            if let phase {
                Text([phase.statusLabel, phase.dateRangeLabel].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(OzerPalette.plumMuted)
                ProjectProgressBar(percent: phase.progressPct)
            }
            if tasks.isEmpty {
                Text("No tasks in this phase yet.")
                    .font(.body)
                    .foregroundStyle(OzerPalette.plumMuted)
            } else {
                ForEach(tasks) { task in
                    taskRow(task)
                }
            }
        }
    }

    private func timelinePhaseRow(_ phase: ProjectPhaseItem) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(phase.name)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                if phase.isMilestone {
                    Text("Milestone")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(OzerPalette.coral)
                }
            }
            Text([phase.statusLabel, phase.dateRangeLabel].compactMap { $0 }.joined(separator: " · "))
                .font(.subheadline)
                .foregroundStyle(OzerPalette.plumMuted)
            ProjectProgressBar(percent: phase.progressPct)
            Text("\(phase.taskCount) tasks · \(phase.progressPct)%")
                .font(.caption)
                .foregroundStyle(OzerPalette.plumMuted)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var emptyTasks: some View {
        Text("No tasks on this project yet.")
            .font(.body)
            .foregroundStyle(OzerPalette.plumMuted)
    }

    private func taskRow(_ item: ProjectTaskItem, compact: Bool = false) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Button {
                Task { await complete(item) }
            } label: {
                Image(systemName: item.isCompleted || completingIds.contains(item.id)
                      ? "checkmark.circle.fill"
                      : "circle")
                    .font(.system(size: compact ? 18 : 22, weight: .medium))
                    .foregroundStyle(OzerPalette.coral)
            }
            .buttonStyle(.plain)
            .disabled(item.isCompleted || completingIds.contains(item.id))

            Button {
                editorTask = item.asTaskItem
                showEditor = true
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title)
                        .font(.body.weight(.medium))
                        .foregroundStyle(OzerPalette.plum)
                        .strikethrough(item.isCompleted || completingIds.contains(item.id))
                        .multilineTextAlignment(.leading)
                    TaskDueClientSubtitle(
                        item: item.asTaskItem,
                        treatAsCompleted: completingIds.contains(item.id)
                    )
                    if let phaseName = item.phaseName, viewMode != .list || !detail.isPhased {
                        Text(phaseName)
                            .font(.caption)
                            .foregroundStyle(OzerPalette.plumSoft)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
        }
        .padding(compact ? 12 : 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            compact ? OzerPalette.cream : OzerPalette.panel,
            in: RoundedRectangle(cornerRadius: compact ? 12 : OzerRadius.card, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: compact ? 12 : OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func labeled(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.footnote.weight(.medium))
                .foregroundStyle(OzerPalette.plumMuted)
            Text(value)
                .font(.body)
                .foregroundStyle(OzerPalette.plum)
        }
    }

    private func tasks(in phaseId: String?) -> [ProjectTaskItem] {
        tasks.filter { task in
            if let phaseId {
                return task.phaseId == phaseId
            }
            return task.phaseId == nil || task.phaseId?.isEmpty == true
        }
    }

    private func complete(_ item: ProjectTaskItem) async {
        completingIds.insert(item.id)
        do {
            let token = try await session.validAccessToken()
            _ = try await api.updateTask(id: item.id, status: "completed", accessToken: token)
            await loadDetail()
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            completingIds.remove(item.id)
            loadError = error
        } catch {
            completingIds.remove(item.id)
            if error.isTaskCancellation { return }
            loadError = .transport(error.localizedDescription)
        }
    }

    private func loadDetail() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            let next = try await api.project(
                id: project.id,
                workspace: workspace,
                accessToken: token
            )
            detail = next
            if !next.isPhased {
                boardMode = .progress
            }
            completingIds = []
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

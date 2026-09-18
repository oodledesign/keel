import SwiftUI

struct MemoriesListView: View {
    @Environment(AppSession.self) private var session
    var onOpen: (AppScreen) -> Void = { _ in }

    @State private var payload: NativeMemoriesPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var selectedChildId: String?
    @State private var selectedKind: MemoryKind?
    @State private var showCapture = false
    @State private var profileChild: NativeMemoryPerson?

    private let client = NativeAPIClient()
    private var reloadKey: String { session.workspaceContentKey }

    private var children: [NativeMemoryPerson] {
        payload?.children ?? []
    }

    private var filteredMemories: [NativeMemoryItem] {
        (payload?.memories ?? []).filter { memory in
            if let selectedChildId, !memory.childIds.contains(selectedChildId) {
                return false
            }
            if let selectedKind, memory.kind != selectedKind.rawValue {
                return false
            }
            return true
        }
    }

    private var groups: [(day: String, items: [NativeMemoryItem])] {
        var order: [String] = []
        var map: [String: [NativeMemoryItem]] = [:]
        for memory in filteredMemories {
            if map[memory.occurredOn] == nil {
                order.append(memory.occurredOn)
                map[memory.occurredOn] = []
            }
            map[memory.occurredOn]?.append(memory)
        }
        return order.map { ($0, map[$0] ?? []) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && payload == nil && loadError == nil {
                    ProgressView()
                        .tint(OzerPalette.coral)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let loadError {
                    statusCard(
                        title: loadError == .notFound ? "Memories aren’t available yet" : "Couldn’t load memories",
                        error: loadError
                    )
                } else if session.workspacesLoaded && session.workspaceQueryValue.isEmpty {
                    emptyCard(
                        title: "No workspaces yet",
                        message: "When your memberships load, memories will land here."
                    )
                } else {
                    content
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Memories")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    WorkspaceChip()
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showCapture = true
                    } label: {
                        Image(systemName: "plus")
                            .fontWeight(.semibold)
                    }
                    .foregroundStyle(OzerPalette.coral)
                    .accessibilityLabel("Quick memory")
                    .disabled(session.workspaceQueryValue.isEmpty)
                }
            }
            .navigationDestination(item: $profileChild) { child in
                ChildProfileView(child: child, people: payload?.people ?? [])
            }
            .sheet(isPresented: $showCapture) {
                QuickMemorySheet(
                    people: payload?.people ?? [],
                    defaultChildIds: selectedChildId.map { [$0] } ?? [],
                    onSaved: { await load() }
                )
            }
            .task(id: reloadKey) {
                selectedChildId = nil
                selectedKind = nil
                await load()
            }
            .refreshable {
                await session.refreshWorkspaces()
                await load()
            }
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Button {
                    onOpen(.children)
                } label: {
                    Label("Children", systemImage: "figure.and.child.holdinghands")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(OzerPalette.coral)
                }
                .buttonStyle(.plain)

                filterChips

                if groups.isEmpty {
                    emptyCard(
                        title: "No memories yet",
                        message: "Capture the funny thing they just said, a first, or an ordinary Tuesday."
                    )
                    Button("Quick memory") {
                        showCapture = true
                    }
                    .buttonStyle(OzerPrimaryButtonStyle())
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .disabled(session.workspaceQueryValue.isEmpty)
                } else {
                    ForEach(groups, id: \.day) { group in
                        VStack(alignment: .leading, spacing: 10) {
                            Text(MemoryDisplay.formatDay(group.day))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(OzerPalette.plum)
                            ForEach(group.items) { memory in
                                MemoryCardView(memory: memory) { childId in
                                    profileChild = (payload?.people ?? []).first(where: { $0.id == childId })
                                }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
    }

    private var filterChips: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Child")
                .font(.caption.weight(.medium))
                .foregroundStyle(OzerPalette.plumMuted)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    filterChip(title: "All", active: selectedChildId == nil) {
                        selectedChildId = nil
                    }
                    ForEach(children) { child in
                        filterChip(title: child.displayName, active: selectedChildId == child.id) {
                            selectedChildId = selectedChildId == child.id ? nil : child.id
                        }
                    }
                }
            }

            Text("Category")
                .font(.caption.weight(.medium))
                .foregroundStyle(OzerPalette.plumMuted)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    filterChip(title: "All", active: selectedKind == nil) {
                        selectedKind = nil
                    }
                    ForEach(MemoryKind.allCases) { value in
                        filterChip(title: value.label, active: selectedKind == value) {
                            selectedKind = selectedKind == value ? nil : value
                        }
                    }
                }
            }
        }
    }

    private func filterChip(title: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.caption.weight(.medium))
                .foregroundStyle(active ? Color.white : OzerPalette.plumMuted)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(active ? OzerPalette.coral : OzerPalette.panel, in: Capsule())
                .overlay {
                    Capsule().stroke(active ? Color.clear : OzerPalette.border, lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
    }

    private func emptyCard(title: String, message: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: "heart")
                .font(.system(size: 28, weight: .medium))
                .foregroundStyle(OzerPalette.coral)
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

    private func statusCard(title: String, error: NativeAPIError) -> some View {
        VStack(spacing: 12) {
            Text(title)
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
                .frame(height: 44)
            }
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
        .padding(.horizontal, 20)
    }

    private func load() async {
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
            payload = try await client.memories(workspace: workspace, accessToken: token)
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

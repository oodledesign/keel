import SwiftUI

struct ChildrenListView: View {
    @Environment(AppSession.self) private var session

    @State private var payload: NativeMemoriesPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var name = ""
    @State private var birthday = Date()
    @State private var hasBirthday = false
    @State private var markId = ""
    @State private var isSaving = false
    @State private var formError: String?

    private let client = NativeAPIClient()
    private var reloadKey: String { session.workspaceContentKey }

    private var children: [NativeMemoryPerson] {
        payload?.children ?? []
    }

    private var unmarked: [NativeMemoryPerson] {
        (payload?.people ?? []).filter { !$0.isChild }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && payload == nil && loadError == nil {
                    ProgressView()
                        .tint(OzerPalette.coral)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let loadError {
                    statusCard(error: loadError)
                } else {
                    content
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Children")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    WorkspaceChip()
                }
            }
            .task(id: reloadKey) { await load() }
            .refreshable {
                await session.refreshWorkspaces()
                await load()
            }
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if children.isEmpty {
                    emptyCard
                } else {
                    ForEach(children) { child in
                        NavigationLink {
                            ChildProfileView(child: child, people: payload?.people ?? [])
                        } label: {
                            childRow(child)
                        }
                        .buttonStyle(.plain)
                    }
                }

                addChildCard

                if !unmarked.isEmpty {
                    markExistingCard
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
    }

    private func childRow(_ child: NativeMemoryPerson) -> some View {
        HStack(spacing: 12) {
            MemoryChildAvatarView(name: child.displayName, url: child.httpsAvatarURL, size: 48)
            VStack(alignment: .leading, spacing: 4) {
                Text(child.displayName)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                Text(child.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(OzerPalette.plumSoft)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var emptyCard: some View {
        VStack(spacing: 10) {
            Text("Add the kids")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("Each child is a Person in this family workspace. Memories attach to that Person — no second household profile.")
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

    private var addChildCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Add a child")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("Creates a People record marked as a child.")
                .font(.footnote)
                .foregroundStyle(OzerPalette.plumMuted)
            TextField("Name", text: $name)
                .textContentType(.name)
                .padding(12)
                .background(OzerPalette.creamDeep, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            Toggle("Birthday", isOn: $hasBirthday)
                .tint(OzerPalette.coral)
            if hasBirthday {
                DatePicker("Birthday", selection: $birthday, displayedComponents: .date)
                    .tint(OzerPalette.coral)
            }
            if let formError {
                Text(formError)
                    .font(.footnote)
                    .foregroundStyle(OzerPalette.coral)
            }
            Button("Add child") {
                Task { await addChild() }
            }
            .buttonStyle(OzerPrimaryButtonStyle())
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
        }
        .padding(16)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var markExistingCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Already in People")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("Mark an existing Person as a child. Meal-plan household stays separate.")
                .font(.footnote)
                .foregroundStyle(OzerPalette.plumMuted)
            Picker("Person", selection: $markId) {
                Text("Choose someone").tag("")
                ForEach(unmarked) { person in
                    Text(person.displayName).tag(person.id)
                }
            }
            .tint(OzerPalette.plum)
            Button("Mark as child") {
                Task { await markExisting() }
            }
            .buttonStyle(OzerSecondaryButtonStyle())
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .disabled(markId.isEmpty || isSaving)
        }
        .padding(16)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func statusCard(error: NativeAPIError) -> some View {
        VStack(spacing: 12) {
            Text("Couldn’t load children")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text(error.localizedDescription)
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
            Button("Try again") {
                Task { await load() }
            }
            .buttonStyle(OzerPrimaryButtonStyle())
            .frame(width: 140)
            .frame(height: 44)
        }
        .padding(28)
        .padding(.horizontal, 20)
    }

    private func addChild() async {
        let displayName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !displayName.isEmpty else { return }
        await saveChild(id: nil, displayName: displayName, dateOfBirth: hasBirthday ? MemoryDisplay.todayIso(now: birthday) : nil)
        if formError == nil {
            name = ""
            hasBirthday = false
        }
    }

    private func markExisting() async {
        guard let person = unmarked.first(where: { $0.id == markId }) else { return }
        await saveChild(id: person.id, displayName: person.displayName, dateOfBirth: person.dateOfBirth)
        if formError == nil {
            markId = ""
        }
    }

    private func saveChild(id: String?, displayName: String, dateOfBirth: String?) async {
        isSaving = true
        defer { isSaving = false }
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            _ = try await client.upsertFamilyChild(
                workspace: workspace,
                id: id,
                displayName: displayName,
                dateOfBirth: dateOfBirth,
                isChild: true,
                accessToken: token
            )
            formError = nil
            await load()
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            formError = error.localizedDescription
        } catch {
            formError = error.localizedDescription
        }
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

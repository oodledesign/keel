import SwiftUI

struct ChildProfileView: View {
    @Environment(AppSession.self) private var session

    let child: NativeMemoryPerson
    let people: [NativeMemoryPerson]

    @State private var payload: NativeMemoriesPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var displayName: String
    @State private var birthday: Date
    @State private var hasBirthday: Bool
    @State private var isSaving = false
    @State private var formError: String?
    @State private var showCapture = false

    private let client = NativeAPIClient()

    init(child: NativeMemoryPerson, people: [NativeMemoryPerson]) {
        self.child = child
        self.people = people
        _displayName = State(initialValue: child.displayName)
        if let iso = child.dateOfBirth, let date = Self.date(from: iso) {
            _birthday = State(initialValue: date)
            _hasBirthday = State(initialValue: true)
        } else {
            _birthday = State(initialValue: Date())
            _hasBirthday = State(initialValue: false)
        }
    }

    private var memories: [NativeMemoryItem] {
        payload?.memories ?? []
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                editor
                memoriesSection
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
        .background(OzerPalette.cream.ignoresSafeArea())
        .navigationTitle(child.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCapture = true
                } label: {
                    Image(systemName: "plus")
                        .fontWeight(.semibold)
                }
                .foregroundStyle(OzerPalette.coral)
                .accessibilityLabel("Quick memory")
            }
        }
        .sheet(isPresented: $showCapture) {
            QuickMemorySheet(
                people: payload?.people ?? people,
                defaultChildIds: [child.id],
                onSaved: { await load() }
            )
        }
        .task {
            await load()
        }
        .refreshable {
            await load()
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 14) {
            MemoryChildAvatarView(name: child.displayName, url: child.httpsAvatarURL, size: 64)
            VStack(alignment: .leading, spacing: 4) {
                Text(child.displayName)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                Text(child.ageLabel ?? "Add a birthday to show their age")
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
                Text("This is their People profile. Memories below are tagged to this Person.")
                    .font(.footnote)
                    .foregroundStyle(OzerPalette.plumSoft)
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

    private var editor: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Name", text: $displayName)
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
            Button("Save person") {
                Task { await saveProfile() }
            }
            .buttonStyle(OzerSecondaryButtonStyle())
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .disabled(displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
        }
        .padding(16)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    @ViewBuilder
    private var memoriesSection: some View {
        if isLoading && payload == nil {
            ProgressView()
                .tint(OzerPalette.coral)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
        } else if let loadError {
            Text(loadError.localizedDescription)
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
        } else if memories.isEmpty {
            VStack(spacing: 10) {
                Text("No memories for \(child.displayName) yet")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                    .multilineTextAlignment(.center)
                Text("The next funny thing they say can live here.")
                    .font(.body)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .multilineTextAlignment(.center)
                Button("Quick memory") {
                    showCapture = true
                }
                .buttonStyle(OzerPrimaryButtonStyle())
                .frame(maxWidth: .infinity)
                .frame(height: 44)
            }
            .padding(28)
            .frame(maxWidth: .infinity)
            .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                    .stroke(OzerPalette.border, lineWidth: 1)
            }
        } else {
            VStack(alignment: .leading, spacing: 12) {
                Text(MemoryDisplay.memoryCountLabel(memories.count))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                ForEach(memories) { memory in
                    MemoryCardView(memory: memory)
                }
            }
        }
    }

    private func saveProfile() async {
        let name = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            _ = try await client.upsertFamilyChild(
                workspace: workspace,
                id: child.id,
                displayName: name,
                dateOfBirth: hasBirthday ? MemoryDisplay.todayIso(now: birthday) : "",
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
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            payload = try await client.memories(
                workspace: workspace,
                childId: child.id,
                accessToken: token
            )
            loadError = nil
        } catch is CancellationError {
            return
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

    private static func date(from iso: String) -> Date? {
        let parts = iso.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var components = DateComponents()
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]
        return Calendar(identifier: .gregorian).date(from: components)
    }
}

import PhotosUI
import SwiftUI

struct WorkspaceSettingsView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss

    @State private var settings: WorkspaceSettings?
    @State private var loadError: String?
    @State private var name = ""
    @State private var isSavingName = false
    @State private var logoItem: PhotosPickerItem?
    @State private var isUpdatingLogo = false
    @State private var showInvite = false
    @State private var memberToRemove: WorkspaceSettings.Member?
    @State private var confirmLeave = false
    @State private var isWorking = false
    @State private var errorMessage: String?

    private let client = NativeAPIClient()

    /// Captured on open so a workspace switch mid-sheet can't retarget edits.
    @State private var workspaceRef = ""

    var body: some View {
        NavigationStack {
            Group {
                if let settings {
                    form(settings)
                } else if let loadError {
                    failedState(loadError)
                } else {
                    OzerListSkeleton(rows: 4, accessibilityLabel: "Loading workspace settings")
                        .padding(.horizontal, 20)
                }
            }
            .background(OzerPalette.cream)
            .navigationTitle("Workspace settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(OzerPalette.plumMuted)
                }
                if nameChanged {
                    ToolbarItem(placement: .confirmationAction) {
                        Button(isSavingName ? "Saving…" : "Save") {
                            Task { await saveName() }
                        }
                        .foregroundStyle(OzerPalette.coral)
                        .disabled(isSavingName || trimmedName.isEmpty)
                    }
                }
            }
            .alert(
                "Something went wrong",
                isPresented: Binding(
                    get: { errorMessage != nil },
                    set: { if !$0 { errorMessage = nil } }
                )
            ) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
            .confirmationDialog(
                "Remove \(memberToRemove?.name ?? "member")?",
                isPresented: Binding(
                    get: { memberToRemove != nil },
                    set: { if !$0 { memberToRemove = nil } }
                ),
                titleVisibility: .visible,
                presenting: memberToRemove
            ) { member in
                Button("Remove from workspace", role: .destructive) {
                    Task { await remove(member) }
                }
            } message: { _ in
                Text("They lose access straight away. Their work stays in the workspace.")
            }
            .confirmationDialog(
                "Leave \(settings?.workspace.name ?? "this workspace")?",
                isPresented: $confirmLeave,
                titleVisibility: .visible
            ) {
                Button("Leave workspace", role: .destructive) {
                    Task { await leave() }
                }
            } message: {
                Text("You’ll need a new invite to come back.")
            }
            .sheet(isPresented: $showInvite) {
                if let settings {
                    InviteMemberView(
                        workspaceRef: workspaceRef,
                        roles: settings.inviteRoles
                    ) { updated in
                        apply(updated)
                    }
                }
            }
        }
        .task {
            if workspaceRef.isEmpty {
                workspaceRef = session.workspaceQueryValue
            }
            await load()
        }
        .onChange(of: logoItem) { _, item in
            guard let item else { return }
            Task { await uploadLogo(item) }
        }
    }

    private func form(_ settings: WorkspaceSettings) -> some View {
        List {
            Section {
                headerRow(settings)
            }
            .listRowBackground(OzerPalette.panel)

            Section("Details") {
                if settings.me.canEdit {
                    TextField("Workspace name", text: $name)
                        .foregroundStyle(OzerPalette.plum)
                } else {
                    LabeledContent("Name") {
                        Text(settings.workspace.name)
                            .foregroundStyle(OzerPalette.plumMuted)
                    }
                }
                LabeledContent("Your role") {
                    Text(settings.me.roleLabel)
                        .foregroundStyle(OzerPalette.plumMuted)
                }
            }
            .listRowBackground(OzerPalette.panel)

            Section {
                ForEach(settings.members) { member in
                    memberRow(member)
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            if member.canRemove {
                                Button("Remove", role: .destructive) {
                                    memberToRemove = member
                                }
                            }
                        }
                }
                if settings.me.canInvite {
                    Button {
                        showInvite = true
                    } label: {
                        Label("Invite someone", systemImage: "person.badge.plus")
                            .foregroundStyle(OzerPalette.coral)
                    }
                }
            } header: {
                Text("Members (\(settings.members.count))")
            } footer: {
                if settings.members.contains(where: \.canRemove) {
                    Text("Swipe left on someone to remove them.")
                        .foregroundStyle(OzerPalette.plumSoft)
                }
            }
            .listRowBackground(OzerPalette.panel)

            if settings.me.canInvite, !settings.invitations.isEmpty {
                Section("Pending invites") {
                    ForEach(settings.invitations) { invite in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(invite.email)
                                .foregroundStyle(OzerPalette.plum)
                            Text(invite.roleLabel)
                                .font(.footnote)
                                .foregroundStyle(OzerPalette.plumMuted)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button("Cancel invite", role: .destructive) {
                                Task { await cancel(invite) }
                            }
                        }
                    }
                }
                .listRowBackground(OzerPalette.panel)
            }

            Section {
                Link(destination: WebSettingsLink.workspace(slug: settings.workspace.slug)) {
                    Label("All workspace settings on the website", systemImage: "safari")
                        .foregroundStyle(OzerPalette.plum)
                }
            } footer: {
                Text("Roles, branding, integrations, and more.")
                    .foregroundStyle(OzerPalette.plumSoft)
            }
            .listRowBackground(OzerPalette.panel)

            if settings.me.canLeave {
                Section {
                    Button("Leave workspace", role: .destructive) {
                        confirmLeave = true
                    }
                }
                .listRowBackground(OzerPalette.panel)
            }
        }
        .scrollContentBackground(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .disabled(isWorking)
    }

    private func headerRow(_ settings: WorkspaceSettings) -> some View {
        HStack(spacing: 16) {
            ZStack {
                WorkspaceLogoView(workspace: settings.workspace.nativeWorkspace, size: 64)
                    .id(settings.workspace.image)
                if isUpdatingLogo {
                    RoundedRectangle(cornerRadius: 14).fill(OzerPalette.panel.opacity(0.7))
                        .frame(width: 64, height: 64)
                    ProgressView()
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                Text(settings.workspace.name)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                if settings.me.canEdit {
                    HStack(spacing: 16) {
                        PhotosPicker(selection: $logoItem, matching: .images) {
                            Text(settings.workspace.image == nil ? "Add logo" : "Change logo")
                        }
                        .foregroundStyle(OzerPalette.coral)
                        if settings.workspace.image != nil {
                            Button("Remove") {
                                Task { await removeLogo() }
                            }
                            .foregroundStyle(OzerPalette.plumMuted)
                        }
                    }
                    .font(.subheadline.weight(.medium))
                    .buttonStyle(.borderless)
                    .disabled(isUpdatingLogo)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func memberRow(_ member: WorkspaceSettings.Member) -> some View {
        HStack(spacing: 12) {
            SettingsAvatar(url: member.pictureUrl, name: member.name, size: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(member.isMe ? "\(member.name) (you)" : member.name)
                    .foregroundStyle(OzerPalette.plum)
                if let email = member.email {
                    Text(email)
                        .font(.footnote)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .lineLimit(1)
                }
            }
            Spacer()
            Text(member.isPrimaryOwner ? "Owner" : member.roleLabel)
                .font(.caption.weight(.semibold))
                .foregroundStyle(OzerPalette.plumMuted)
        }
        .accessibilityElement(children: .combine)
    }

    private func failedState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Text(message)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
            Button("Try again") {
                Task { await load() }
            }
            .foregroundStyle(OzerPalette.coral)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var trimmedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var nameChanged: Bool {
        guard let settings, settings.me.canEdit else { return false }
        return trimmedName != settings.workspace.name
    }

    private func apply(_ next: WorkspaceSettings) {
        let renamedOrRelogoed = settings.map {
            $0.workspace.name != next.workspace.name || $0.workspace.image != next.workspace.image
        } ?? false
        settings = next
        name = next.workspace.name
        if renamedOrRelogoed {
            Task { await session.refreshWorkspaces() }
        }
    }

    private func load() async {
        loadError = nil
        do {
            let token = try await session.validAccessToken()
            apply(try await client.workspaceSettings(workspace: workspaceRef, accessToken: token))
        } catch {
            if error.isTaskCancellation { return }
            if settings == nil {
                loadError = error.localizedDescription
            }
        }
    }

    private func run(_ action: (String) async throws -> WorkspaceSettings) async {
        isWorking = true
        defer { isWorking = false }
        do {
            let token = try await session.validAccessToken()
            apply(try await action(token))
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func saveName() async {
        isSavingName = true
        defer { isSavingName = false }
        let next = trimmedName
        await run { token in
            try await client.renameWorkspace(workspace: workspaceRef, name: next, accessToken: token)
        }
    }

    private func uploadLogo(_ item: PhotosPickerItem) async {
        isUpdatingLogo = true
        defer {
            isUpdatingLogo = false
            logoItem = nil
        }
        guard let data = await SettingsImagePreparation.logoPNG(from: item) else {
            errorMessage = "That image couldn’t be read."
            return
        }
        await run { token in
            try await client.uploadWorkspaceLogo(workspace: workspaceRef, imageData: data, accessToken: token)
        }
    }

    private func removeLogo() async {
        isUpdatingLogo = true
        defer { isUpdatingLogo = false }
        await run { token in
            try await client.removeWorkspaceLogo(workspace: workspaceRef, accessToken: token)
        }
    }

    private func remove(_ member: WorkspaceSettings.Member) async {
        await run { token in
            try await client.removeWorkspaceMember(workspace: workspaceRef, userId: member.userId, accessToken: token)
        }
    }

    private func cancel(_ invite: WorkspaceSettings.Invitation) async {
        await run { token in
            try await client.cancelWorkspaceInvitation(workspace: workspaceRef, invitationId: invite.id, accessToken: token)
        }
    }

    private func leave() async {
        isWorking = true
        defer { isWorking = false }
        do {
            let token = try await session.validAccessToken()
            try await client.leaveWorkspace(workspace: workspaceRef, accessToken: token)
            await session.refreshWorkspaces()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct InviteMemberView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss

    let workspaceRef: String
    let roles: [WorkspaceSettings.Role]
    var onInvited: (WorkspaceSettings) -> Void

    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var role = ""
    @State private var isSending = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("First name", text: $firstName)
                        .textContentType(.givenName)
                    TextField("Last name", text: $lastName)
                        .textContentType(.familyName)
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                .listRowBackground(OzerPalette.panel)

                Section {
                    Picker("Role", selection: $role) {
                        ForEach(roles) { option in
                            Text(option.label).tag(option.name)
                        }
                    }
                    .tint(OzerPalette.plum)
                } footer: {
                    Text("They’ll get an email with a link to join.")
                        .foregroundStyle(OzerPalette.plumSoft)
                }
                .listRowBackground(OzerPalette.panel)

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(OzerPalette.coral)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .listRowBackground(OzerPalette.panel)
                }
            }
            .foregroundStyle(OzerPalette.plum)
            .scrollContentBackground(.hidden)
            .background(OzerPalette.cream)
            .navigationTitle("Invite someone")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(OzerPalette.plumMuted)
                        .disabled(isSending)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSending ? "Sending…" : "Send") {
                        Task { await send() }
                    }
                    .foregroundStyle(OzerPalette.coral)
                    .disabled(!canSend || isSending)
                }
            }
        }
        .interactiveDismissDisabled(isSending)
        .onAppear {
            if role.isEmpty {
                role = roles.last?.name ?? ""
            }
        }
    }

    private var canSend: Bool {
        !trimmed(firstName).isEmpty
            && !trimmed(lastName).isEmpty
            && trimmed(email).contains("@")
            && !role.isEmpty
    }

    private func trimmed(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func send() async {
        isSending = true
        errorMessage = nil
        defer { isSending = false }
        do {
            let token = try await session.validAccessToken()
            let updated = try await NativeAPIClient().inviteWorkspaceMember(
                workspace: workspaceRef,
                firstName: trimmed(firstName),
                lastName: trimmed(lastName),
                email: trimmed(email),
                role: role,
                accessToken: token
            )
            onInvited(updated)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

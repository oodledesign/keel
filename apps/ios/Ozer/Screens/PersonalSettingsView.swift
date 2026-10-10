import PhotosUI
import SwiftUI
import UserNotifications

struct PersonalSettingsView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var settings: PersonalSettings?
    @State private var loadError: String?
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var isSavingName = false
    @State private var photoItem: PhotosPickerItem?
    @State private var isUpdatingPhoto = false
    @State private var pushStatus: UNAuthorizationStatus?
    @State private var errorMessage: String?
    @State private var showDeleteAccount = false
    @State private var isSavingAIConsent = false

    private let client = NativeAPIClient()

    var body: some View {
        NavigationStack {
            Group {
                if let settings {
                    form(settings)
                } else if let loadError {
                    failedState(loadError)
                } else {
                    OzerListSkeleton(rows: 4, accessibilityLabel: "Loading your settings")
                        .padding(.horizontal, 20)
                }
            }
            .background(OzerPalette.cream)
            .navigationTitle("Personal settings")
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
                        .disabled(isSavingName || trimmedFirstName.isEmpty)
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
            .sheet(isPresented: $showDeleteAccount) {
                DeleteAccountView()
            }
        }
        .task { await load() }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task { await uploadPhoto(item) }
        }
    }

    private func form(_ settings: PersonalSettings) -> some View {
        List {
            Section {
                photoRow(settings)
            }
            .listRowBackground(OzerPalette.panel)

            Section("Profile") {
                TextField("First name", text: $firstName)
                    .textContentType(.givenName)
                    .foregroundStyle(OzerPalette.plum)
                TextField("Last name", text: $lastName)
                    .textContentType(.familyName)
                    .foregroundStyle(OzerPalette.plum)
                LabeledContent("Email") {
                    Text(settings.email ?? "—")
                        .foregroundStyle(OzerPalette.plumMuted)
                }
            }
            .listRowBackground(OzerPalette.panel)

            Section {
                ForEach(settings.emailNotifications) { item in
                    Toggle(isOn: emailBinding(for: item.key)) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title)
                                .foregroundStyle(OzerPalette.plum)
                            Text(item.description)
                                .font(.footnote)
                                .foregroundStyle(OzerPalette.plumMuted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .tint(OzerPalette.coral)
                }
            } header: {
                Text("Email notifications")
            } footer: {
                Text("In-app alerts are unchanged.")
                    .foregroundStyle(OzerPalette.plumSoft)
            }
            .listRowBackground(OzerPalette.panel)

            Section {
                Toggle(isOn: aiBinding) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("AI summaries, tasks and search")
                            .foregroundStyle(OzerPalette.plum)
                        Text(AIConsentCopy.providers.map(\.name).joined(separator: ", "))
                            .font(.footnote)
                            .foregroundStyle(OzerPalette.plumMuted)
                    }
                }
                .tint(OzerPalette.coral)
                .disabled(isSavingAIConsent || session.aiConsent == .unknown)
                Link("Privacy policy", destination: AIConsentCopy.privacyPolicy)
                    .foregroundStyle(OzerPalette.coral)
            } header: {
                Text("AI features")
            } footer: {
                Text("When on, the text of your meetings, survey notes and notes is sent to these providers. When off, they’re still saved, just without AI summaries, suggested tasks or search.")
                    .foregroundStyle(OzerPalette.plumSoft)
            }
            .listRowBackground(OzerPalette.panel)

            Section {
                LabeledContent("Notifications") {
                    Text(pushStatusLabel)
                        .foregroundStyle(OzerPalette.plumMuted)
                }
                Button("Open Settings") {
                    if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
                        openURL(url)
                    }
                }
                .foregroundStyle(OzerPalette.coral)
            } header: {
                Text("On this \(OzerDevice.name)")
            }
            .listRowBackground(OzerPalette.panel)

            Section("Messages") {
                NavigationLink {
                    BlockedPeopleView()
                } label: {
                    Label("Blocked people", systemImage: "hand.raised")
                        .foregroundStyle(OzerPalette.plum)
                }
            }
            .listRowBackground(OzerPalette.panel)

            Section {
                Link(destination: WebSettingsLink.personal) {
                    Label("All settings on the website", systemImage: "safari")
                        .foregroundStyle(OzerPalette.plum)
                }
            } footer: {
                Text("Password, connected accounts, dictation, and more.")
                    .foregroundStyle(OzerPalette.plumSoft)
            }
            .listRowBackground(OzerPalette.panel)

            Section {
                Button("Sign out", role: .destructive) {
                    Task { await session.signOut() }
                }
            } footer: {
                Text(settings.email ?? "Signed in")
                    .foregroundStyle(OzerPalette.plumSoft)
            }
            .listRowBackground(OzerPalette.panel)

            Section {
                Button("Delete account", role: .destructive) {
                    showDeleteAccount = true
                }
            } header: {
                Text("Danger zone")
            } footer: {
                Text("Locks your account straight away and permanently deletes your data after 30 days.")
                    .foregroundStyle(OzerPalette.plumSoft)
            }
            .listRowBackground(OzerPalette.panel)
        }
        .scrollContentBackground(.hidden)
        .scrollDismissesKeyboard(.interactively)
    }

    private func photoRow(_ settings: PersonalSettings) -> some View {
        HStack(spacing: 16) {
            ZStack {
                SettingsAvatar(
                    url: settings.pictureUrl,
                    name: settings.displayName,
                    size: 64
                )
                if isUpdatingPhoto {
                    Circle().fill(OzerPalette.panel.opacity(0.7))
                        .frame(width: 64, height: 64)
                    ProgressView()
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                Text(settings.displayName.isEmpty ? "Your profile" : settings.displayName)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                HStack(spacing: 16) {
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Text(settings.pictureUrl == nil ? "Add photo" : "Change photo")
                    }
                    .foregroundStyle(OzerPalette.coral)
                    if settings.pictureUrl != nil {
                        Button("Remove") {
                            Task { await removePhoto() }
                        }
                        .foregroundStyle(OzerPalette.plumMuted)
                    }
                }
                .font(.subheadline.weight(.medium))
                .buttonStyle(.borderless)
                .disabled(isUpdatingPhoto)
            }
        }
        .padding(.vertical, 4)
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

    private var trimmedFirstName: String {
        firstName.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var trimmedLastName: String {
        lastName.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var nameChanged: Bool {
        guard let settings else { return false }
        return trimmedFirstName != settings.firstName || trimmedLastName != settings.lastName
    }

    private var pushStatusLabel: String {
        switch pushStatus {
        case .authorized, .provisional, .ephemeral: "On"
        case .denied: "Off"
        case .notDetermined: "Not set up"
        default: "—"
        }
    }

    private func emailBinding(for key: String) -> Binding<Bool> {
        Binding(
            get: { settings?.emailNotifications.first { $0.key == key }?.enabled ?? false },
            set: { enabled in Task { await setEmailNotification(key: key, enabled: enabled) } }
        )
    }

    private var aiBinding: Binding<Bool> {
        Binding(
            get: { session.aiConsent == .granted },
            set: { granted in Task { await setAIConsent(granted: granted) } }
        )
    }

    private func setAIConsent(granted: Bool) async {
        isSavingAIConsent = true
        defer { isSavingAIConsent = false }
        do {
            try await session.setAIConsent(granted: granted)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func apply(_ next: PersonalSettings) {
        settings = next
        firstName = next.firstName
        lastName = next.lastName
    }

    private func load() async {
        loadError = nil
        pushStatus = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        do {
            let token = try await session.validAccessToken()
            apply(try await client.personalSettings(accessToken: token))
        } catch {
            if error.isTaskCancellation { return }
            if settings == nil {
                loadError = error.localizedDescription
            }
        }
    }

    private func saveName() async {
        isSavingName = true
        defer { isSavingName = false }
        do {
            let token = try await session.validAccessToken()
            apply(try await client.updatePersonalSettings(
                ["first_name": trimmedFirstName, "last_name": trimmedLastName],
                accessToken: token
            ))
            await session.refreshWorkspaces()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func setEmailNotification(key: String, enabled: Bool) async {
        guard let previous = settings,
              let index = previous.emailNotifications.firstIndex(where: { $0.key == key })
        else { return }
        var optimistic = previous
        optimistic.emailNotifications[index].enabled = enabled
        settings = optimistic
        do {
            let token = try await session.validAccessToken()
            let saved = try await client.updatePersonalSettings(
                ["email_notifications": [key: enabled]],
                accessToken: token
            )
            settings?.emailNotifications = saved.emailNotifications
        } catch {
            settings?.emailNotifications = previous.emailNotifications
            errorMessage = error.localizedDescription
        }
    }

    private func uploadPhoto(_ item: PhotosPickerItem) async {
        isUpdatingPhoto = true
        defer {
            isUpdatingPhoto = false
            photoItem = nil
        }
        guard let data = await SettingsImagePreparation.profileJPEG(from: item) else {
            errorMessage = "That photo couldn’t be read."
            return
        }
        do {
            let token = try await session.validAccessToken()
            let url = try await client.uploadProfilePhoto(imageData: data, accessToken: token)
            settings?.pictureUrl = url
            await session.refreshWorkspaces()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func removePhoto() async {
        isUpdatingPhoto = true
        defer { isUpdatingPhoto = false }
        do {
            let token = try await session.validAccessToken()
            try await client.removeProfilePhoto(accessToken: token)
            settings?.pictureUrl = nil
            await session.refreshWorkspaces()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

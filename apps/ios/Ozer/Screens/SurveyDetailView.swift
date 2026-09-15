import PhotosUI
import SwiftUI
import UIKit

struct SurveyDetailView: View {
    @Environment(AppSession.self) private var session
    @State private var survey: SurveyItem
    @State private var sessions: [SurveySessionItem] = []
    @State private var photos: [SurveyPhotoItem] = []
    @State private var queue = OfflineSurveyQueue.shared
    @State private var network = NetworkPathMonitor.shared
    @State private var isRecording = false
    @State private var isLoading = false
    @State private var loadError: String?
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var showCamera = false

    private let api = NativeAPIClient()

    init(survey: SurveyItem) {
        _survey = State(initialValue: survey)
    }

    private var workspace: String {
        session.workspaceQueryValue
    }

    private var pendingSessions: [PendingSurveySession] {
        queue.sessions(forSurvey: survey.id, workspace: workspace)
    }

    private var pendingPhotos: [PendingSurveyPhoto] {
        queue.photos(forSurvey: survey.id, workspace: workspace)
    }

    private var queueStatus: SurveyQueueStatus {
        SurveyDisplay.queueStatus(
            isOnline: network.isOnline,
            pendingCount: pendingSessions.count + pendingPhotos.count + (survey.isLocal ? 1 : 0),
            lastError: queue.lastFlushError
        )
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                queueBanner
                recordButton
                photoActions
                sessionsSection
                photosSection
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 88)
        }
        .background(OzerPalette.cream.ignoresSafeArea())
        .navigationTitle(survey.title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: survey.id) {
            await load()
        }
        .refreshable {
            await session.flushOfflineWork()
            await load()
        }
        .fullScreenCover(isPresented: $isRecording) {
            SurveyRecordView(survey: survey) {
                await load()
            }
        }
        .onChange(of: pickerItems) { _, items in
            Task { await importPickerItems(items) }
        }
        .sheet(isPresented: $showCamera) {
            SurveyCameraPicker { data in
                if let data {
                    enqueuePhoto(data: data, title: "Site photo")
                }
                showCamera = false
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                PhotosPicker(selection: $pickerItems, maxSelectionCount: 30, matching: .images) {
                    Image(systemName: "photo.on.rectangle")
                        .foregroundStyle(OzerPalette.coral)
                }
                .accessibilityLabel("Add photos from library")
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(survey.title)
                .font(.title2.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text(survey.typeLabel)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(OzerPalette.plum)
            if let client = survey.clientName, !client.isEmpty {
                Text(client)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
            }
        }
    }

    private var queueBanner: some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(isRecording ? OzerPalette.coral : (network.isOnline ? OzerPalette.info : OzerPalette.plumSoft))
                .frame(width: 8, height: 8)
                .padding(.top, 5)
            VStack(alignment: .leading, spacing: 4) {
                if isRecording {
                    Text("Recording")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(OzerPalette.coral)
                }
                Text(queueStatus.banner)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
            }
            Spacer()
        }
        .padding(12)
        .background(OzerPalette.creamDeep, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
    }

    private var recordButton: some View {
        Button {
            isRecording = true
        } label: {
            Label("Record site notes", systemImage: "record.circle")
                .font(.body.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
        }
        .buttonStyle(OzerPrimaryButtonStyle())
    }

    private var photoActions: some View {
        HStack(spacing: 12) {
            Button {
                showCamera = true
            } label: {
                Label("Camera", systemImage: "camera")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(OzerSecondaryButtonStyle())

            PhotosPicker(selection: $pickerItems, maxSelectionCount: 30, matching: .images) {
                Label("Library", systemImage: "photo.on.rectangle")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(OzerSecondaryButtonStyle())
        }
    }

    private var sessionsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Recordings")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)

            if sessions.isEmpty && pendingSessions.isEmpty {
                Text("No sessions yet. Record as you walk the property. Pause and resume on the same take, or start another session later.")
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
            } else {
                ForEach(pendingSessions) { item in
                    sessionCard(
                        title: item.title,
                        body: item.content,
                        waiting: true
                    )
                }
                ForEach(sessions) { item in
                    sessionCard(title: item.title, body: item.content, waiting: false)
                }
            }
        }
    }

    private func sessionCard(title: String, body: String, waiting: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.body.weight(.medium))
                .foregroundStyle(OzerPalette.plum)
            if !body.isEmpty {
                Text(body)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .lineLimit(4)
            }
            if waiting {
                Text("Waiting to upload")
                    .font(.caption)
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

    private var photosSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Photo library")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)

            if photos.isEmpty && pendingPhotos.isEmpty {
                Text("Add photos from the camera or camera roll. They stay on this iPhone until they upload into the survey library.")
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
            } else {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    ForEach(pendingPhotos) { photo in
                        photoTile(title: photo.title, url: queue.photoURL(for: photo), remote: nil, waiting: true)
                    }
                    ForEach(photos) { photo in
                        photoTile(title: photo.title, url: nil, remote: photo.previewUrl, waiting: false)
                    }
                }
            }
            if let loadError {
                Text(loadError)
                    .font(.caption)
                    .foregroundStyle(OzerPalette.plumSoft)
            }
        }
    }

    private func photoTile(title: String, url: URL?, remote: String?, waiting: Bool) -> some View {
        ZStack(alignment: .bottomLeading) {
            if let url, let image = UIImage(contentsOfFile: url.path) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else if let remote, let remoteURL = URL(string: remote) {
                AsyncImage(url: remoteURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        OzerPalette.creamDeep
                    }
                }
            } else {
                OzerPalette.creamDeep
            }
            Text(waiting ? "Queued" : title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(OzerPalette.creamOnDark)
                .padding(6)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(OzerPalette.plum.opacity(0.55))
        }
        .frame(height: 96)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func importPickerItems(_ items: [PhotosPickerItem]) async {
        guard !items.isEmpty else { return }
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self) {
                enqueuePhoto(data: data, title: "Site photo")
            }
        }
        pickerItems = []
        await session.flushOfflineWork()
        await load()
    }

    private func enqueuePhoto(data: Data, title: String) {
        _ = queue.enqueuePhoto(
            workspace: workspace,
            surveyId: survey.id,
            isLocalSurvey: survey.isLocal,
            title: title,
            imageData: data
        )
        Task {
            await session.flushOfflineWork()
            await load()
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        if survey.isLocal {
            sessions = []
            photos = []
            return
        }
        do {
            let token = try await session.validAccessToken()
            let detail = try await api.survey(id: survey.id, workspace: workspace, accessToken: token)
            survey = detail.survey
            sessions = detail.sessions
            photos = detail.photos
            loadError = nil
        } catch let error as NativeAPIError where error == .unauthorized {
            await session.handleUnauthorized()
        } catch {
            loadError = error.localizedDescription
        }
    }
}

struct SurveyCameraPicker: UIViewControllerRepresentable {
    var onCapture: (Data?) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onCapture: onCapture)
    }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        var onCapture: (Data?) -> Void

        init(onCapture: @escaping (Data?) -> Void) {
            self.onCapture = onCapture
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onCapture(nil)
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            let image = (info[.editedImage] ?? info[.originalImage]) as? UIImage
            onCapture(image?.jpegData(compressionQuality: 0.82))
        }
    }
}

import SwiftUI
import UIKit

struct SurveyDetailView: View {
    @Environment(AppSession.self) private var session
    @State private var survey: SurveyItem
    @State private var remoteSections: [SurveySectionItem] = []
    @State private var selectedSection: SurveySectionItem?
    @State private var queue = OfflineSurveyQueue.shared
    @State private var network = NetworkPathMonitor.shared
    @State private var isLoading = false
    @State private var loadError: String?
    @State private var allowMobileData = SurveyPhotoSyncPreference.current.allowsMobileData

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

    private var catalogue: [SurveySectionItem] {
        if !remoteSections.isEmpty {
            return remoteSections
        }
        return SurveySectionCatalogue.onSiteSections(level: survey.resolvedSurveyLevel).map {
            SurveySectionItem.fromCatalogue($0)
        }
    }

    private var sectionRows: [SurveySectionItem] {
        catalogue.map { section in
            let pendingBodies = pendingSessions
                .filter { matches(section, ricsCode: $0.ricsCode) }
                .sorted { $0.createdAt < $1.createdAt }
                .map(\.content)
            var copy = section
            copy.note = SurveyDisplay.accumulatedNote(remote: section.note, pendingBodies: pendingBodies)
            copy.photoCount = section.photoCount
                + pendingPhotos.filter { matches(section, ricsCode: $0.ricsCode) }.count
            return copy
        }
    }

    private var groupedSections: [(group: String, sections: [SurveySectionItem])] {
        var order: [String] = []
        var buckets: [String: [SurveySectionItem]] = [:]
        for item in sectionRows {
            if buckets[item.group] == nil {
                order.append(item.group)
                buckets[item.group] = []
            }
            buckets[item.group]?.append(item)
        }
        return order.compactMap { group in
            guard let sections = buckets[group] else { return nil }
            return (group, sections)
        }
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
                syncSettings
                sectionsList
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
        .fullScreenCover(item: $selectedSection) { section in
            SurveyRecordView(survey: survey, section: section, catalogue: catalogue) {
                await load()
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
                .fill(network.isOnline ? OzerPalette.info : OzerPalette.plumSoft)
                .frame(width: 8, height: 8)
                .padding(.top, 5)
            VStack(alignment: .leading, spacing: 4) {
                Text(queueStatus.banner)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
                Text("Pick a section, then record notes and photos into it. Coming back later appends to the same note.")
                    .font(.caption)
                    .foregroundStyle(OzerPalette.plumSoft)
            }
            Spacer()
        }
        .padding(12)
        .background(OzerPalette.creamDeep, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
    }

    private var syncSettings: some View {
        VStack(alignment: .leading, spacing: 8) {
            Toggle(isOn: $allowMobileData) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Upload large photos on mobile data")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(OzerPalette.plum)
                    Text(SurveyPhotoSyncPreference.from(allowsMobileData: allowMobileData).settingsDetail)
                        .font(.caption)
                        .foregroundStyle(OzerPalette.plumMuted)
                }
            }
            .tint(OzerPalette.coral)
            .onChange(of: allowMobileData) { _, next in
                SurveyPhotoSyncPreference.current = SurveyPhotoSyncPreference.from(allowsMobileData: next)
                if next {
                    Task {
                        await session.flushOfflineWork()
                        await load()
                    }
                }
            }
            Text(SurveyPhotoSync.archiveRetentionNote)
                .font(.caption2)
                .foregroundStyle(OzerPalette.plumMuted)
        }
        .padding(12)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var sectionsList: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Sections")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)

            if sectionRows.isEmpty {
                Text("On-site sections are not available for this survey type yet.")
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
            } else {
                ForEach(groupedSections, id: \.group) { group in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(group.group)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(OzerPalette.plumMuted)
                        ForEach(group.sections) { item in
                            Button {
                                selectedSection = item
                            } label: {
                                sectionRow(item)
                            }
                            .buttonStyle(.plain)
                        }
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

    private func sectionRow(_ item: SurveySectionItem) -> some View {
        let queued = pendingSessions.filter { matches(item, ricsCode: $0.ricsCode) }.count
            + pendingPhotos.filter { matches(item, ricsCode: $0.ricsCode) }.count
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(item.displayLabel)
                    .font(.body.weight(.medium))
                    .foregroundStyle(OzerPalette.plum)
                Spacer()
                if item.photoCount > 0 {
                    Text("\(item.photoCount) photo\(item.photoCount == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundStyle(OzerPalette.plumMuted)
                }
            }
            if item.note.isEmpty {
                Text("No notes yet")
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumSoft)
            } else {
                Text(item.note)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .lineLimit(3)
            }
            if queued > 0 {
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
        .accessibilityLabel(item.displayLabel)
        .accessibilityHint("Record notes and photos for this section")
    }

    private func matches(_ section: SurveySectionItem, ricsCode: String?) -> Bool {
        guard let ricsCode, !ricsCode.isEmpty else { return false }
        if ricsCode.caseInsensitiveCompare(section.ricsCode) == .orderedSame { return true }
        if ricsCode.caseInsensitiveCompare(section.key) == .orderedSame { return true }
        return SurveySectionCatalogue.section(ricsCodeOrKey: ricsCode)?.ricsCode == section.ricsCode
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        if survey.isLocal {
            remoteSections = []
            return
        }
        do {
            let token = try await session.validAccessToken()
            let detail = try await api.survey(id: survey.id, workspace: workspace, accessToken: token)
            survey = detail.survey
            remoteSections = detail.sections
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

import PhotosUI
import SwiftUI
import UIKit

struct SurveyRecordView: View {
    var survey: SurveyItem
    var section: SurveySectionItem
    var catalogue: [SurveySectionItem]
    var onFinished: () async -> Void

    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var selectedSection: SurveySectionItem
    @State private var capture = MeetingCaptureSession()
    @State private var isStopping = false
    @State private var isPausing = false
    @State private var startError: String?
    @State private var network = NetworkPathMonitor.shared
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var showCamera = false
    @State private var queue = OfflineSurveyQueue.shared
    @State private var localNotes: [String: String]

    init(
        survey: SurveyItem,
        section: SurveySectionItem,
        catalogue: [SurveySectionItem],
        onFinished: @escaping () async -> Void
    ) {
        self.survey = survey
        self.section = section
        self.catalogue = catalogue
        self.onFinished = onFinished
        _selectedSection = State(initialValue: section)
        _localNotes = State(initialValue: [:])
    }

    private var controlsLocked: Bool {
        isStopping || isPausing || capture.isLabelling
    }

    private var workspace: String {
        session.workspaceQueryValue
    }

    private var pendingNote: String {
        localNotes[selectedSection.ricsCode] ?? selectedSection.note
    }

    private var pendingPhotos: [PendingSurveyPhoto] {
        queue.photos(
            forSurvey: survey.id,
            workspace: workspace,
            ricsCode: selectedSection.ricsCode
        )
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                header
                runningNote
                captions
                photoStrip
                if let status = capture.statusMessage {
                    Text(status)
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .multilineTextAlignment(.center)
                }
                if let progress = capture.modelProgress {
                    ProgressView(value: progress)
                        .tint(OzerPalette.coral)
                }
                if let banner = startError ?? capture.lastError {
                    Text(banner)
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .multilineTextAlignment(.center)
                }
                photoActions
                recordActions
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 28)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle(selectedSection.displayLabel)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(capture.isRecording ? "Close" : "Done") {
                        if capture.isRecording {
                            capture.cancel()
                        }
                        dismiss()
                    }
                    .foregroundStyle(OzerPalette.plumMuted)
                    .disabled(controlsLocked)
                }
            }
            .onDisappear {
                if capture.isRecording {
                    capture.cancel()
                }
            }
            .task(id: "\(survey.id)-\(workspace)") {
                seedLocalNotes()
            }
            .onChange(of: pickerItems) { _, items in
                Task { await importPickerItems(items) }
            }
            .sheet(isPresented: $showCamera) {
                SurveyCameraPicker { data in
                    if let data {
                        enqueuePhoto(data: data)
                    }
                    showCamera = false
                }
            }
        }
    }

    private var header: some View {
        VStack(spacing: 6) {
            sectionPicker
            Text(survey.title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(OzerPalette.plum)
            HStack(spacing: 8) {
                if capture.isRecording {
                    Circle()
                        .fill(capture.isPaused ? OzerPalette.plumSoft : OzerPalette.coral)
                        .frame(width: 10, height: 10)
                    Text(capture.elapsedLabel)
                        .font(.system(size: 28, weight: .semibold, design: .rounded))
                        .foregroundStyle(OzerPalette.plum)
                        .monospacedDigit()
                }
            }
            Text(network.isOnline ? "Online · will upload when you stop" : "Offline · queued on this iPhone")
                .font(.caption)
                .foregroundStyle(OzerPalette.plumMuted)
            if capture.isPaused {
                Text("Paused")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(OzerPalette.plumMuted)
            }
        }
    }

    private var sectionPicker: some View {
        Menu {
            ForEach(catalogue) { item in
                Button(item.displayLabel) {
                    selectedSection = item
                    seedNote(for: item)
                }
            }
        } label: {
            HStack(spacing: 6) {
                Text(selectedSection.displayLabel)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(OzerPalette.plum)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(OzerPalette.plumMuted)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(OzerPalette.creamDeep, in: Capsule())
        }
        .disabled(capture.isRecording || controlsLocked)
        .accessibilityLabel("Section \(selectedSection.displayLabel)")
    }

    private var runningNote: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Running note")
                .font(.caption.weight(.semibold))
                .foregroundStyle(OzerPalette.plumMuted)
            if pendingNote.isEmpty {
                Text("Nothing in this section yet. Record or add photos — later visits append to this same note.")
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
            } else {
                Text(pendingNote)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plum)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var captions: some View {
        ScrollView {
            SpeakerTranscriptView(
                turns: capture.displayTurns,
                emptyMessage: capture.isRecording
                    ? "Live captions will land here. The audio is saved even if captions miss a word."
                    : "Tap Record to dictate into this section. Photos can be added at the same time."
            )
            .padding(16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var photoStrip: some View {
        Group {
            if !pendingPhotos.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(pendingPhotos) { photo in
                            if let url = queue.photoURL(for: photo),
                               let image = UIImage(contentsOfFile: url.path) {
                                Image(uiImage: image)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 72, height: 72)
                                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            }
                        }
                    }
                }
                .accessibilityLabel("Photos for \(selectedSection.displayLabel)")
            }
        }
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
            .disabled(!selectedSection.allowsPhotos)

            PhotosPicker(selection: $pickerItems, maxSelectionCount: 30, matching: .images) {
                Label("Library", systemImage: "photo.on.rectangle")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(OzerSecondaryButtonStyle())
            .disabled(!selectedSection.allowsPhotos)
        }
    }

    private var recordActions: some View {
        HStack(spacing: 12) {
            if capture.isRecording {
                Button {
                    Task { await togglePause() }
                } label: {
                    Text(pauseResumeTitle)
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(OzerSecondaryButtonStyle())
                .disabled(controlsLocked)

                Button {
                    Task { await stopRecording() }
                } label: {
                    Text(isStopping ? "Saving…" : "Stop")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(OzerPrimaryButtonStyle())
                .disabled(controlsLocked)
            } else {
                Button {
                    Task { await start() }
                } label: {
                    Text("Record")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(OzerPrimaryButtonStyle())
                .disabled(controlsLocked)
            }
        }
    }

    private var pauseResumeTitle: String {
        if isPausing || (capture.isLabelling && capture.isPaused) {
            return "Pausing…"
        }
        return capture.isPaused ? "Resume" : "Pause"
    }

    private func seedLocalNotes() {
        for item in catalogue {
            seedNote(for: item)
        }
    }

    private func seedNote(for item: SurveySectionItem) {
        if localNotes[item.ricsCode] != nil { return }
        let bodies = queue.sessions(
            forSurvey: survey.id,
            workspace: workspace,
            ricsCode: item.ricsCode
        )
        .sorted { $0.createdAt < $1.createdAt }
        .map(\.content)
        localNotes[item.ricsCode] = SurveyDisplay.accumulatedNote(
            remote: item.note,
            pendingBodies: bodies
        )
    }

    private func start() async {
        do {
            try await capture.start()
        } catch is CancellationError {
            return
        } catch {
            startError = error.localizedDescription
        }
    }

    private func togglePause() async {
        if capture.isPaused {
            do {
                try await capture.resume()
            } catch {
                startError = error.localizedDescription
            }
            return
        }
        isPausing = true
        defer { isPausing = false }
        await capture.pause()
    }

    private func stopRecording() async {
        isStopping = true
        defer { isStopping = false }
        do {
            let result = try await capture.stop()
            let fallback = selectedSection.displayLabel
            let title = SurveyDisplay.sessionTitle(from: result.transcript, on: Date(), fallback: fallback)
            let body = result.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
            _ = OfflineSurveyQueue.shared.enqueueSession(
                workspace: workspace,
                surveyId: survey.id,
                isLocalSurvey: survey.isLocal,
                title: title,
                content: body,
                durationSeconds: max(0, Int(result.duration.rounded())),
                meetingDate: TaskItem.dueString(from: Date()),
                audioURL: result.audioURL,
                ricsCode: selectedSection.ricsCode
            )
            let updated = SurveyDisplay.appendNote(
                existing: localNotes[selectedSection.ricsCode] ?? selectedSection.note,
                incoming: body
            )
            localNotes[selectedSection.ricsCode] = updated
            selectedSection.note = updated
            await session.flushOfflineWork()
            await onFinished()
        } catch {
            startError = error.localizedDescription
        }
    }

    private func importPickerItems(_ items: [PhotosPickerItem]) async {
        guard !items.isEmpty else { return }
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self) {
                enqueuePhoto(data: data)
            }
        }
        pickerItems = []
        await session.flushOfflineWork()
        await onFinished()
    }

    private func enqueuePhoto(data: Data) {
        _ = queue.enqueuePhoto(
            workspace: workspace,
            surveyId: survey.id,
            isLocalSurvey: survey.isLocal,
            title: selectedSection.displayLabel,
            imageData: data,
            ricsCode: selectedSection.ricsCode
        )
        Task {
            await session.flushOfflineWork()
            await onFinished()
        }
    }
}

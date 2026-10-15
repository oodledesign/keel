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
    @State private var capture = MeetingCaptureSession(labelSpeakers: false)
    @State private var isStopping = false
    @State private var isPausing = false
    @State private var startError: String?
    @State private var network = NetworkPathMonitor.shared
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var showCamera = false
    @State private var showDataPrompt = false
    @State private var showLeavePrompt = false
    @State private var pendingPhotoEnqueue: Data?
    @State private var queue = OfflineSurveyQueue.shared
    @State private var localNotes: [String: String]
    @State private var sectionNotes: [String: [SurveySectionNote]]
    @State private var selectedNoteId: String?
    @State private var dictation = SurveyDictationController()
    @Environment(\.scenePhase) private var scenePhase

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
        _sectionNotes = State(initialValue: [:])
        _selectedNoteId = State(initialValue: section.notes.last?.id)
    }

    private var currentNotes: [SurveySectionNote] {
        sectionNotes[selectedSection.ricsCode] ?? selectedSection.notes
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
                            showLeavePrompt = true
                        } else {
                            dismiss()
                        }
                    }
                    .foregroundStyle(OzerPalette.plumMuted)
                    .disabled(controlsLocked)
                }
            }
            .onDisappear {
                if capture.isRecording {
                    dictation.pauseCurrent()
                    session.dictationController = dictation
                }
            }
            .confirmationDialog(
                "Leave while recording?",
                isPresented: $showLeavePrompt,
                titleVisibility: .visible
            ) {
                Button("Keep recording", role: .cancel) {}
                Button("Pause") {
                    Task {
                        await capture.pause()
                        dictation.pauseCurrent()
                        session.dictationController = dictation
                        dismiss()
                    }
                }
                Button("Stop and save") {
                    Task {
                        await stopRecording()
                        dismiss()
                    }
                }
                Button("Discard", role: .destructive) {
                    capture.cancel()
                    dictation.discardAll()
                    session.dictationController = nil
                    dismiss()
                }
            } message: {
                Text("Your current take can be paused and resumed from another section, or discarded.")
            }
            .task(id: "\(survey.id)-\(workspace)") {
                if let existing = session.dictationController, existing.hasActiveOrPaused {
                    dictation = existing
                } else {
                    dictation.restoreFromDisk()
                    if dictation.hasActiveOrPaused {
                        session.dictationController = dictation
                    }
                }
                seedLocalNotes()
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .background, capture.isRecording, !capture.isPaused {
                    Task {
                        dictation.updateLive(transcript: liveCaption, elapsed: capture.elapsed)
                        await capture.pause()
                        dictation.pauseCurrent()
                        session.dictationController = dictation
                    }
                }
            }
            .onChange(of: pickerItems) { _, items in
                Task { await importPickerItems(items) }
            }
            .fullScreenCover(isPresented: $showCamera) {
                SurveyCameraPicker { data in
                    if let data {
                        enqueuePhoto(data: data)
                    }
                    showCamera = false
                }
                .ignoresSafeArea()
            }
            .confirmationDialog(
                "Upload photos on mobile data?",
                isPresented: $showDataPrompt,
                titleVisibility: .visible
            ) {
                Button("Wait for Wi-Fi") {
                    if let pending = pendingPhotoEnqueue {
                        actuallyEnqueuePhoto(data: pending)
                    }
                    pendingPhotoEnqueue = nil
                }
                Button("Use mobile data") {
                    SurveyPhotoSyncPreference.current = .useMobileData
                    if let pending = pendingPhotoEnqueue {
                        actuallyEnqueuePhoto(data: pending)
                    }
                    pendingPhotoEnqueue = nil
                }
                Button("Cancel", role: .cancel) {
                    pendingPhotoEnqueue = nil
                }
            } message: {
                Text("Large photos wait for Wi-Fi by default. Recordings still upload on mobile data. \(SurveyPhotoSync.archiveRetentionNote)")
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
            Text(network.isOnline ? "Online · will upload when you stop" : "Offline · queued on this \(OzerDevice.name)")
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
                    Task { await selectSection(item) }
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
        .disabled(controlsLocked)
        .accessibilityLabel("Section \(selectedSection.displayLabel)")
    }

    private var runningNote: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Notes")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(OzerPalette.plumMuted)
                Spacer()
                Button("Add new note") {
                    addEmptyNote()
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(OzerPalette.coral)
                .disabled(controlsLocked)
            }
            if currentNotes.isEmpty && pendingNote.isEmpty {
                Text("Nothing in this section yet. Record or add a note — each dictation becomes its own note.")
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
            } else if !currentNotes.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(currentNotes) { note in
                        Button {
                            selectedNoteId = note.id
                        } label: {
                            HStack(alignment: .top, spacing: 8) {
                                Circle()
                                    .fill(selectedNoteId == note.id ? OzerPalette.coral : OzerPalette.border)
                                    .frame(width: 8, height: 8)
                                    .padding(.top, 5)
                                Text(note.body.isEmpty ? "Empty note — dictation will fill this" : note.body)
                                    .font(.subheadline)
                                    .foregroundStyle(note.body.isEmpty ? OzerPalette.plumMuted : OzerPalette.plum)
                                    .multilineTextAlignment(.leading)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .padding(10)
                            .background(
                                selectedNoteId == note.id ? OzerPalette.creamDeep : OzerPalette.cream,
                                in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(controlsLocked)
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(SurveyDisplay.noteTakes(from: pendingNote).enumerated()), id: \.offset) { index, take in
                        if index > 0 {
                            Rectangle()
                                .fill(OzerPalette.border)
                                .frame(height: 1)
                                .padding(.vertical, 2)
                        }
                        Text(take)
                            .font(.subheadline)
                            .foregroundStyle(OzerPalette.plum)
                    }
                }
            }
            if selectedNoteId != nil {
                Text("Recording appends to the selected note.")
                    .font(.caption2)
                    .foregroundStyle(OzerPalette.plumMuted)
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
            Text(liveCaption.isEmpty ? emptyCaptionMessage : liveCaption)
                .font(.body)
                .foregroundStyle(liveCaption.isEmpty ? OzerPalette.plumMuted : OzerPalette.plum)
                .frame(maxWidth: .infinity, alignment: .leading)
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

    private var liveCaption: String {
        let live = capture.liveTranscript.trimmingCharacters(in: .whitespacesAndNewlines)
        if !live.isEmpty {
            return SpeakerTurnSplitter.plainProse(from: live)
        }
        return capture.displayTurns
            .map { $0.text.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }

    private var emptyCaptionMessage: String {
        capture.isRecording
            ? "Live captions will land here. The audio is saved even if captions miss a word."
            : "Tap Record to dictate into this section. Photos can be added at the same time."
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
        if selectedNoteId == nil {
            selectedNoteId = currentNotes.last?.id
        }
    }

    private func seedNote(for item: SurveySectionItem) {
        if sectionNotes[item.ricsCode] == nil {
            sectionNotes[item.ricsCode] = item.notes
        }
        if localNotes[item.ricsCode] != nil { return }
        let bodies = queue.sessions(
            forSurvey: survey.id,
            workspace: workspace,
            ricsCode: item.ricsCode
        )
        .sorted { $0.createdAt < $1.createdAt }
        .map { SpeakerTurnSplitter.plainProse(from: $0.content) }
        localNotes[item.ricsCode] = SurveyDisplay.accumulatedNote(
            remote: SpeakerTurnSplitter.plainProse(from: item.note),
            pendingBodies: bodies
        )
    }

    private func addEmptyNote() {
        let note = SurveySectionNote(
            id: UUID().uuidString,
            body: "",
            origin: "manual",
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
        var list = currentNotes
        list.append(note)
        sectionNotes[selectedSection.ricsCode] = list
        selectedNoteId = note.id
    }

    private func selectSection(_ item: SurveySectionItem) async {
        guard item.ricsCode != selectedSection.ricsCode else { return }
        if capture.isRecording {
            dictation.updateLive(transcript: liveCaption, elapsed: capture.elapsed)
            if !capture.isPaused {
                await capture.pause()
            }
            dictation.switchSection(
                to: item.ricsCode,
                sectionLabel: item.displayLabel
            )
            session.dictationController = dictation
        }
        selectedSection = item
        seedNote(for: item)
        selectedNoteId = (sectionNotes[item.ricsCode] ?? item.notes).last?.id
    }

    private func start() async {
        do {
            try await capture.start()
            dictation.begin(
                surveyId: survey.id,
                ricsCode: selectedSection.ricsCode,
                sectionLabel: selectedSection.displayLabel
            )
            session.dictationController = dictation
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
                dictation.resume(ricsCode: selectedSection.ricsCode)
                session.dictationController = dictation
            } catch {
                startError = error.localizedDescription
            }
            return
        }
        isPausing = true
        defer { isPausing = false }
        dictation.updateLive(transcript: liveCaption, elapsed: capture.elapsed)
        await capture.pause()
        dictation.pauseCurrent()
        session.dictationController = dictation
    }

    private func stopRecording() async {
        isStopping = true
        defer { isStopping = false }
        do {
            let result = try await capture.stop()
            let fallback = selectedSection.displayLabel
            let body = SpeakerTurnSplitter.plainProse(from: result.transcript)
            let title = SurveyDisplay.sessionTitle(from: body, on: Date(), fallback: fallback)
            let appendId = selectedNoteId.flatMap { id in
                currentNotes.contains(where: { $0.id == id && !$0.body.isEmpty }) ? id : nil
            }
            // Empty local draft notes are not on the server yet — insert a new row.
            let serverAppendId = appendId.flatMap { id in
                UUID(uuidString: id) != nil && selectedSection.notes.contains(where: { $0.id == id })
                    ? id
                    : nil
            }
            _ = OfflineSurveyQueue.shared.enqueueSession(
                workspace: workspace,
                surveyId: survey.id,
                isLocalSurvey: survey.isLocal,
                title: title,
                content: body,
                durationSeconds: max(0, Int(result.duration.rounded())),
                meetingDate: TaskItem.dueString(from: Date()),
                audioURL: result.audioURL,
                ricsCode: selectedSection.ricsCode,
                appendToObservationId: serverAppendId
            )
            var notes = currentNotes
            if let selectedNoteId,
               let index = notes.firstIndex(where: { $0.id == selectedNoteId }) {
                let existing = notes[index].body
                notes[index].body = SurveyDisplay.appendNote(existing: existing, incoming: body)
                sectionNotes[selectedSection.ricsCode] = notes
                selectedSection.notes = notes
                selectedSection.note = notes.map(\.body).filter { !$0.isEmpty }.joined(separator: "\n\n")
            } else {
                let note = SurveySectionNote(
                    id: UUID().uuidString,
                    body: body,
                    origin: "dictation",
                    createdAt: ISO8601DateFormatter().string(from: Date())
                )
                notes.append(note)
                sectionNotes[selectedSection.ricsCode] = notes
                selectedSection.notes = notes
                selectedNoteId = note.id
                selectedSection.note = notes.map(\.body).filter { !$0.isEmpty }.joined(separator: "\n\n")
            }
            localNotes[selectedSection.ricsCode] = selectedSection.note
            _ = dictation.finishCurrent()
            session.dictationController = dictation.hasActiveOrPaused ? dictation : nil
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
        if network.isCellular && !SurveyPhotoSyncPreference.current.allowsMobileData {
            pendingPhotoEnqueue = data
            showDataPrompt = true
            return
        }
        actuallyEnqueuePhoto(data: data)
    }

    private func actuallyEnqueuePhoto(data: Data) {
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

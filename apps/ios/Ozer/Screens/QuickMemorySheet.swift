import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct QuickMemorySheet: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss

    var people: [NativeMemoryPerson]
    var defaultChildIds: [String] = []
    var onSaved: () async -> Void

    @State private var content = ""
    @State private var title = ""
    @State private var occurredAt = Date()
    @State private var kind: MemoryKind?
    @State private var childIds: Set<String> = []
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var attachments: [MemoryPickedFile] = []
    @State private var capture = MeetingCaptureSession(labelSpeakers: false)
    @State private var keepRecording = true
    @State private var isStopping = false
    @State private var showAudioImporter = false
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let client = NativeAPIClient()

    private var children: [NativeMemoryPerson] {
        people.filter(\.isChild)
    }

    private var canSave: Bool {
        !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving && !capture.isRecording
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("What happened") {
                    TextField("Poet said the moon was a biscuit…", text: $content, axis: .vertical)
                        .lineLimit(4...10)
                        .foregroundStyle(OzerPalette.plum)
                    if !capture.liveTranscript.isEmpty {
                        Text(SpeakerTurnSplitter.plainProse(from: capture.liveTranscript))
                            .font(.footnote)
                            .foregroundStyle(OzerPalette.plumMuted)
                    }
                    recordControls
                    Toggle("Keep recording", isOn: $keepRecording)
                        .tint(OzerPalette.coral)
                        .disabled(capture.isRecording)
                    Text("Surveys always keep the site audio. Memories do the same unless you turn this off.")
                        .font(.caption)
                        .foregroundStyle(OzerPalette.plumMuted)
                }

                Section("Title (optional)") {
                    TextField("Moon biscuit", text: $title)
                        .foregroundStyle(OzerPalette.plum)
                }

                Section("When") {
                    DatePicker("Date", selection: $occurredAt, displayedComponents: .date)
                        .tint(OzerPalette.coral)
                }

                Section("Who is in this memory") {
                    if children.isEmpty {
                        Text("Add children from the Children page. Each child is a Person — memories attach to them.")
                            .font(.footnote)
                            .foregroundStyle(OzerPalette.plumMuted)
                    } else {
                        ForEach(children) { child in
                            Button {
                                toggle(child.id)
                            } label: {
                                HStack(spacing: 10) {
                                    MemoryChildAvatarView(
                                        name: child.displayName,
                                        url: child.httpsAvatarURL,
                                        size: 28
                                    )
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(child.displayName)
                                            .foregroundStyle(OzerPalette.plum)
                                        if let age = child.ageLabel {
                                            Text(age)
                                                .font(.caption)
                                                .foregroundStyle(OzerPalette.plumMuted)
                                        }
                                    }
                                    Spacer()
                                    if childIds.contains(child.id) {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(OzerPalette.coral)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Section("Category") {
                    FlowKindPicker(kind: $kind)
                }

                Section("Photos, video, voice notes") {
                    PhotosPicker(
                        selection: $pickerItems,
                        maxSelectionCount: 8,
                        matching: .any(of: [.images, .videos])
                    ) {
                        Label("Library", systemImage: "photo.on.rectangle")
                            .foregroundStyle(OzerPalette.coral)
                    }
                    .onChange(of: pickerItems) { _, items in
                        Task { await importPickerItems(items) }
                    }

                    Button {
                        showAudioImporter = true
                    } label: {
                        Label("Voice memo or audio file", systemImage: "waveform")
                            .foregroundStyle(OzerPalette.coral)
                    }

                    if !attachments.isEmpty {
                        ForEach(attachments) { file in
                            Text(file.filename)
                                .font(.footnote)
                                .foregroundStyle(OzerPalette.plumMuted)
                        }
                    }
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(OzerPalette.coral)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Quick memory")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        if capture.isRecording {
                            capture.cancel()
                        }
                        dismiss()
                    }
                    .foregroundStyle(OzerPalette.plumMuted)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { await save() }
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(canSave ? OzerPalette.coral : OzerPalette.plumSoft)
                    .disabled(!canSave)
                }
            }
            .onAppear {
                childIds = Set(defaultChildIds)
            }
            .onDisappear {
                if capture.isRecording {
                    capture.cancel()
                }
            }
            .fileImporter(
                isPresented: $showAudioImporter,
                allowedContentTypes: [.audio, .mpeg4Audio, .wav, .mp3],
                allowsMultipleSelection: true
            ) { result in
                Task { await importAudioFiles(result) }
            }
        }
    }

    private var recordControls: some View {
        HStack(spacing: 12) {
            if capture.isRecording {
                Text(capture.elapsedLabel)
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(OzerPalette.plum)
                Spacer()
                Button(isStopping ? "Saving…" : "Stop") {
                    Task { await stopRecording() }
                }
                .disabled(isStopping)
                .foregroundStyle(OzerPalette.coral)
            } else {
                Button("Record") {
                    Task { await startRecording() }
                }
                .foregroundStyle(OzerPalette.coral)
            }
        }
    }

    private func toggle(_ id: String) {
        if childIds.contains(id) {
            childIds.remove(id)
        } else {
            childIds.insert(id)
        }
    }

    private func startRecording() async {
        errorMessage = nil
        do {
            try await capture.start()
        } catch is CancellationError {
            return
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func stopRecording() async {
        isStopping = true
        defer { isStopping = false }
        do {
            let result = try await capture.stop()
            let transcript = SpeakerTurnSplitter.plainProse(from: result.transcript)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !transcript.isEmpty {
                content = [content.trimmingCharacters(in: .whitespacesAndNewlines), transcript]
                    .filter { !$0.isEmpty }
                    .joined(separator: "\n\n")
            }
            if keepRecording, let audioURL = result.audioURL {
                try appendFile(
                    data: Data(contentsOf: audioURL),
                    filename: audioURL.lastPathComponent,
                    mimeType: "audio/mp4"
                )
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func importPickerItems(_ items: [PhotosPickerItem]) async {
        var failures = 0
        for item in items {
            do {
                if item.supportedContentTypes.contains(where: { $0.conforms(to: .movie) }) {
                    guard let transfer = try await item.loadTransferable(type: MemoryMovieTransfer.self) else {
                        failures += 1
                        continue
                    }
                    try appendFile(
                        data: transfer.data,
                        filename: "memory-\(attachments.count + 1).mp4",
                        mimeType: "video/mp4"
                    )
                } else {
                    let data: Data
                    if let transfer = try await item.loadTransferable(type: MemoryImageTransfer.self) {
                        data = transfer.data
                    } else if let fallback = try await item.loadTransferable(type: Data.self) {
                        data = fallback
                    } else {
                        failures += 1
                        continue
                    }
                    guard UIImage(data: data) != nil else {
                        failures += 1
                        continue
                    }
                    try appendFile(
                        data: SurveyPhotoCompression.uploadJPEG(from: data),
                        filename: "memory-\(attachments.count + 1).jpg",
                        mimeType: "image/jpeg"
                    )
                }
            } catch {
                failures += 1
                errorMessage = error.localizedDescription
            }
        }
        pickerItems = []
        if failures > 0, errorMessage == nil {
            errorMessage = "Couldn’t load \(failures) item\(failures == 1 ? "" : "s") from the library."
        }
    }

    private func importAudioFiles(_ result: Result<[URL], Error>) async {
        switch result {
        case .failure(let error):
            errorMessage = error.localizedDescription
        case .success(let urls):
            for url in urls {
                let accessed = url.startAccessingSecurityScopedResource()
                defer {
                    if accessed {
                        url.stopAccessingSecurityScopedResource()
                    }
                }
                do {
                    let data = try Data(contentsOf: url)
                    try appendFile(
                        data: data,
                        filename: url.lastPathComponent,
                        mimeType: url.pathExtension.lowercased() == "caf" ? "audio/x-caf" : "audio/mp4"
                    )
                } catch {
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    private func appendFile(data: Data, filename: String, mimeType: String) throws {
        let kind = try MemoryMedia.validate(size: data.count, mimeType: mimeType, filename: filename)
        attachments.append(
            MemoryPickedFile(
                data: data,
                filename: filename,
                mimeType: mimeType,
                kind: kind
            )
        )
    }

    private func save() async {
        let body = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            let created = try await client.createMemory(
                workspace: workspace,
                content: body,
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                occurredAt: MemoryDisplay.todayIso(now: occurredAt),
                kind: kind?.rawValue,
                childIds: Array(childIds),
                accessToken: token
            )
            for file in attachments {
                _ = try await client.uploadMemoryMedia(
                    workspace: workspace,
                    noteId: created.id,
                    fileData: file.data,
                    filename: file.filename,
                    mimeType: file.mimeType,
                    title: file.filename,
                    accessToken: token
                )
            }
            await onSaved()
            dismiss()
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct FlowKindPicker: View {
    @Binding var kind: MemoryKind?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(MemoryKind.allCases) { value in
                Button {
                    kind = kind == value ? nil : value
                } label: {
                    HStack {
                        Text(value.label)
                            .foregroundStyle(OzerPalette.plum)
                        Spacer()
                        if kind == value {
                            Image(systemName: "checkmark")
                                .foregroundStyle(OzerPalette.coral)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }
}

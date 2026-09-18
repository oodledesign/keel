import PhotosUI
import SwiftUI
import UIKit

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
    @State private var photos: [Data] = []
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let client = NativeAPIClient()

    private var children: [NativeMemoryPerson] {
        people.filter(\.isChild)
    }

    private var canSave: Bool {
        !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("What happened") {
                    TextField("Poet said the moon was a biscuit…", text: $content, axis: .vertical)
                        .lineLimit(4...10)
                        .foregroundStyle(OzerPalette.plum)
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
                                    Text(child.displayName)
                                        .foregroundStyle(OzerPalette.plum)
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

                Section("Photo") {
                    PhotosPicker(selection: $pickerItems, maxSelectionCount: 4, matching: .images) {
                        Label(
                            photos.isEmpty ? "Add photos" : "\(photos.count) photo\(photos.count == 1 ? "" : "s") selected",
                            systemImage: "photo"
                        )
                        .foregroundStyle(OzerPalette.coral)
                    }
                    .onChange(of: pickerItems) { _, items in
                        Task { await loadPhotos(items) }
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
                    Button("Cancel") { dismiss() }
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
        }
    }

    private func toggle(_ id: String) {
        if childIds.contains(id) {
            childIds.remove(id)
        } else {
            childIds.insert(id)
        }
    }

    private func loadPhotos(_ items: [PhotosPickerItem]) async {
        var next: [Data] = []
        for item in items {
            guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
            next.append(SurveyPhotoCompression.uploadJPEG(from: data))
        }
        photos = next
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
            for (index, photo) in photos.enumerated() {
                _ = try await client.uploadMemoryPhoto(
                    workspace: workspace,
                    noteId: created.id,
                    imageData: photo,
                    filename: "memory-\(index + 1).jpg",
                    mimeType: "image/jpeg",
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

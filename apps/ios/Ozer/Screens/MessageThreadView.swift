import PhotosUI
import SwiftUI
import UIKit

struct MessageThreadView: View {
    @Environment(AppSession.self) private var session
    @Environment(WorkspaceTabBarState.self) private var tabBar

    let threadId: String
    var thread: MessageThreadItem?

    @State private var header: MessageThreadItem?
    @State private var messages: [ChatMessageItem] = []
    @State private var draft = ""
    @State private var pickerItem: PhotosPickerItem?
    @State private var pendingImage: UIImage?
    @State private var isLoading = false
    @State private var isSending = false
    @State private var loadError: NativeAPIError?
    @State private var sendError: String?

    private let client = NativeAPIClient()

    private var title: String {
        header?.title ?? thread?.title ?? "Chat"
    }

    var body: some View {
        VStack(spacing: 0) {
            if let loadError, messages.isEmpty {
                Text(loadError.localizedDescription)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .padding()
            } else if isLoading && messages.isEmpty {
                ProgressView()
                    .tint(OzerPalette.coral)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 8) {
                            ForEach(messages) { message in
                                bubble(message)
                                    .id(message.id)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                    }
                    .onChange(of: messages.last?.id) { _, id in
                        guard let id else { return }
                        withAnimation {
                            proxy.scrollTo(id, anchor: .bottom)
                        }
                    }
                }
            }
            if let sendError {
                Text(sendError)
                    .font(.footnote)
                    .foregroundStyle(OzerPalette.coral)
                    .padding(.horizontal, 16)
                    .padding(.top, 4)
            }
            composer
        }
        .background(OzerPalette.cream.ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            tabBar.isHidden = true
        }
        .onDisappear {
            tabBar.isHidden = false
        }
        .task {
            await load()
            await markRead()
        }
        .onChange(of: pickerItem) { _, item in
            Task { await loadPickerImage(item) }
        }
    }

    private func bubble(_ message: ChatMessageItem) -> some View {
        HStack {
            if message.isMine { Spacer(minLength: 48) }
            VStack(alignment: message.isMine ? .trailing : .leading, spacing: 4) {
                if !message.isMine {
                    Text(message.senderLabel)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(OzerPalette.plumMuted)
                }
                if let url = message.httpsImageURL {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFill()
                        default:
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(OzerPalette.creamDeep)
                                .frame(width: 180, height: 120)
                        }
                    }
                    .frame(maxWidth: 220, maxHeight: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                if !message.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(message.body)
                        .font(.body)
                        .foregroundStyle(message.isMine ? Color.white : OzerPalette.plum)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(
                            message.isMine ? OzerPalette.coral : OzerPalette.panel,
                            in: RoundedRectangle(cornerRadius: 18, style: .continuous)
                        )
                }
                ForEach(message.attachments) { attachment in
                    Label(attachment.title, systemImage: "paperclip")
                        .font(.caption)
                        .foregroundStyle(OzerPalette.plumMuted)
                }
                Text(message.timeLabel)
                    .font(.caption2)
                    .foregroundStyle(OzerPalette.plumSoft)
            }
            if !message.isMine { Spacer(minLength: 48) }
        }
    }

    private var composer: some View {
        VStack(spacing: 8) {
            if let pendingImage {
                HStack {
                    Image(uiImage: pendingImage)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 56, height: 56)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    Spacer()
                    Button("Remove") {
                        self.pendingImage = nil
                        pickerItem = nil
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(OzerPalette.coral)
                }
                .padding(.horizontal, 16)
            }
            HStack(alignment: .bottom, spacing: 8) {
                PhotosPicker(selection: $pickerItem, matching: .images) {
                    Image(systemName: "photo")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(OzerPalette.plumMuted)
                        .frame(width: 36, height: 36)
                }
                .accessibilityLabel("Add image")

                TextField("Message", text: $draft, axis: .vertical)
                    .lineLimit(1...5)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(OzerPalette.panel, in: Capsule())
                    .overlay {
                        Capsule().stroke(OzerPalette.border, lineWidth: 1)
                    }

                Button {
                    Task { await send() }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 30))
                        .foregroundStyle(canSend ? OzerPalette.coral : OzerPalette.plumSoft)
                }
                .disabled(!canSend || isSending)
                .accessibilityLabel("Send")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .background(OzerPalette.cream)
    }

    private var canSend: Bool {
        let hasText = !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return hasText || pendingImage != nil
    }

    private func load() async {
        let workspace = session.workspaceQueryValue
        guard !workspace.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let token = try await session.validAccessToken()
            async let headerTask = client.messageThread(
                id: threadId,
                workspace: workspace,
                accessToken: token
            )
            async let messagesTask = client.threadMessages(
                threadId: threadId,
                workspace: workspace,
                accessToken: token
            )
            header = try await headerTask
            messages = try await messagesTask.items
            loadError = nil
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            loadError = error
        } catch {
            loadError = .transport(error.localizedDescription)
        }
    }

    private func markRead() async {
        let workspace = session.workspaceQueryValue
        guard !workspace.isEmpty else { return }
        do {
            let token = try await session.validAccessToken()
            try await client.markThreadRead(
                threadId: threadId,
                workspace: workspace,
                accessToken: token
            )
        } catch {
            return
        }
    }

    private func loadPickerImage(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        if let data = try? await item.loadTransferable(type: Data.self),
           let image = UIImage(data: data)
        {
            pendingImage = image
        }
    }

    private func send() async {
        let workspace = session.workspaceQueryValue
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !workspace.isEmpty, canSend else { return }
        isSending = true
        defer { isSending = false }
        do {
            let token = try await session.validAccessToken()
            var imageUrl: String?
            if let pendingImage,
               let data = pendingImage.jpegData(compressionQuality: 0.82)
            {
                imageUrl = try await client.uploadMessageImage(
                    threadId: threadId,
                    workspace: workspace,
                    imageData: data,
                    filename: "photo.jpg",
                    mimeType: "image/jpeg",
                    accessToken: token
                )
            }
            let sent = try await client.sendThreadMessage(
                threadId: threadId,
                workspace: workspace,
                body: text,
                imageUrl: imageUrl,
                accessToken: token
            )
            messages.append(sent)
            draft = ""
            pendingImage = nil
            pickerItem = nil
            sendError = nil
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            sendError = error.localizedDescription
        } catch {
            sendError = error.localizedDescription
        }
    }
}

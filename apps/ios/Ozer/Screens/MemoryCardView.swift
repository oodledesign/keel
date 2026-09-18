import SwiftUI

struct MemoryChildAvatarView: View {
    var name: String
    var url: URL?
    var size: CGFloat = 22

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        initials
                    }
                }
            } else {
                initials
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }

    private var initials: some View {
        Text(MemoryDisplay.initials(name))
            .font(.system(size: max(9, size * 0.38), weight: .semibold))
            .foregroundStyle(OzerPalette.plum)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.creamDeep)
    }
}

struct MemoryCardView: View {
    let memory: NativeMemoryItem
    var onChild: ((String) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let url = memory.previewPhotoURL {
                ZStack(alignment: .bottomTrailing) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFill()
                        default:
                            OzerPalette.creamDeep
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 180)
                    .clipped()

                    if memory.extraMediaCount > 0 {
                        Text("+\(memory.extraMediaCount) more")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(OzerPalette.creamOnDark)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(OzerPalette.plum.opacity(0.8), in: Capsule())
                            .padding(8)
                    }
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Text(MemoryDisplay.formatDay(memory.occurredOn))
                        .font(.footnote)
                        .foregroundStyle(OzerPalette.plumMuted)
                    if let kind = memory.kindLabel {
                        Text(kind)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(OzerPalette.coral)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(OzerPalette.coral.opacity(0.12), in: Capsule())
                    }
                }

                if let title = memory.displayTitle {
                    Text(title)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(OzerPalette.plum)
                }

                Text(MemoryDisplay.excerpt(memory.content))
                    .font(.body)
                    .foregroundStyle(OzerPalette.plum)
                    .fixedSize(horizontal: false, vertical: true)

                if !memory.children.isEmpty {
                    HStack(spacing: 8) {
                        ForEach(memory.children) { child in
                            Button {
                                onChild?(child.id)
                            } label: {
                                HStack(spacing: 6) {
                                    MemoryChildAvatarView(
                                        name: child.displayName,
                                        url: child.httpsAvatarURL,
                                        size: 20
                                    )
                                    Text(child.displayName)
                                        .font(.caption.weight(.medium))
                                        .foregroundStyle(OzerPalette.plum)
                                }
                                .padding(.horizontal, 8)
                                .padding(.vertical, 5)
                                .background(
                                    OzerPalette.creamDeep,
                                    in: Capsule()
                                )
                            }
                            .buttonStyle(.plain)
                            .disabled(onChild == nil)
                        }
                    }
                }
            }
            .padding(16)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
    }
}

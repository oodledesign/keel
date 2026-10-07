import PhotosUI
import SwiftUI
import UIKit

struct SettingsAvatar: View {
    let url: String?
    let name: String
    var size: CGFloat = 40

    var body: some View {
        ZStack {
            Circle().fill(OzerPalette.creamDeep)
            Text(initials)
                .font(.system(size: size * 0.38, weight: .semibold))
                .foregroundStyle(OzerPalette.plumMuted)
            if let url, let parsed = URL(string: url) {
                AsyncImage(url: parsed) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    }
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }

    private var initials: String {
        let letters = name
            .split(separator: " ")
            .prefix(2)
            .compactMap(\.first)
        return letters.isEmpty ? "?" : String(letters).uppercased()
    }
}

enum SettingsImagePreparation {
    /// Square-ish avatars and logos never need more than this on any screen.
    static let maxPixelSize = 1024

    static func profileJPEG(from item: PhotosPickerItem) async -> Data? {
        guard let image = await loadImage(from: item) else { return nil }
        return SurveyPhotoCompression.scale(image, maxPixelSize: maxPixelSize)
            .jpegData(compressionQuality: 0.85)
    }

    /// PNG keeps logo transparency.
    static func logoPNG(from item: PhotosPickerItem) async -> Data? {
        guard let image = await loadImage(from: item) else { return nil }
        return SurveyPhotoCompression.scale(image, maxPixelSize: maxPixelSize).pngData()
    }

    private static func loadImage(from item: PhotosPickerItem) async -> UIImage? {
        guard let data = try? await item.loadTransferable(type: Data.self) else { return nil }
        return UIImage(data: data)
    }
}

enum WebSettingsLink {
    static var personal: URL {
        AppConfiguration.apiBaseURL.appending(path: "app/settings")
    }

    static func workspace(slug: String) -> URL {
        AppConfiguration.apiBaseURL.appending(path: "app/\(slug)/settings")
    }
}

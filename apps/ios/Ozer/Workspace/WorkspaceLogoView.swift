import SwiftUI
import UIKit

/// Cookie-free HTTPS fetch for workspace marks. Fallback shows immediately.
enum WorkspaceImageSession {
    static let shared: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieAcceptPolicy = .never
        configuration.httpShouldSetCookies = false
        configuration.httpCookieStorage = nil
        configuration.urlCache = nil
        return URLSession(configuration: configuration)
    }()
}

struct WorkspaceLogoView: View {
    let workspace: NativeWorkspace
    var size: CGFloat = 30

    @State private var bitmap: UIImage?

    var body: some View {
        ZStack {
            if bitmap != nil, !workspace.isPersonalAccount {
                markShape.fill(OzerPalette.creamDeep)
            } else {
                fallback
            }
            if let bitmap {
                if workspace.isPersonalAccount {
                    Image(uiImage: bitmap)
                        .resizable()
                        .interpolation(.high)
                        .scaledToFill()
                } else {
                    Image(uiImage: bitmap)
                        .resizable()
                        .interpolation(.high)
                        .scaledToFit()
                        .padding(size * 0.08)
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(markShape)
        .overlay {
            markShape.stroke(OzerPalette.border, lineWidth: 1)
        }
        .accessibilityHidden(true)
        .task(id: workspace.httpsImageURL) {
            bitmap = nil
            guard let url = workspace.httpsImageURL else { return }
            var request = URLRequest(url: url)
            request.httpShouldHandleCookies = false
            request.cachePolicy = .reloadIgnoringLocalCacheData
            do {
                let (data, response) = try await WorkspaceImageSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse, http.statusCode == 200,
                      let image = UIImage(data: data)
                else { return }
                bitmap = image
            } catch {
                // Keep initials / person mark. The list is already on screen.
            }
        }
    }

    private var markShape: RoundedRectangle {
        RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
    }

    private var fallback: some View {
        ZStack {
            markShape.fill(OzerPalette.plum)
            if workspace.isPersonalAccount {
                Image(systemName: "person.fill")
                    .font(.system(size: size * 0.42, weight: .medium))
                    .foregroundStyle(OzerPalette.cream)
            } else if !workspace.logoInitials.isEmpty {
                Text(workspace.logoInitials)
                    .font(.system(size: size * 0.38, weight: .semibold, design: .rounded))
                    .foregroundStyle(OzerPalette.cream)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
            }
        }
    }
}

import SwiftUI
import UIKit

enum OzerLayout {
    /// Wide enough to fill an 11" iPad in portrait; wider screens get a centred column.
    static let readableWidth: CGFloat = 840
    static let menuWidth: CGFloat = 640
}

/// "iPhone" or "iPad", for copy that names the device the data stays on.
/// `OzerApp.init` reads it first on the main thread, as `UIDevice` requires; later reads are safe anywhere.
enum OzerDevice {
    static let name: String = UIDevice.current.userInterfaceIdiom == .pad ? "iPad" : "iPhone"
}

extension View {
    /// Centres content in a column on iPad. No effect on iPhone, which is narrower than the column.
    func ozerReadableWidth(_ maxWidth: CGFloat = OzerLayout.readableWidth) -> some View {
        frame(maxWidth: maxWidth)
            .frame(maxWidth: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
    }
}

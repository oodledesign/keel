import SwiftUI

/// Calm light tokens from DESIGN_SYSTEM.md (cream canvas, plum text, coral accent).
enum OzerPalette {
    static let cream = Color(red: 251 / 255.0, green: 246 / 255.0, blue: 236 / 255.0)
    static let creamDeep = Color(red: 242 / 255.0, green: 233 / 255.0, blue: 219 / 255.0)
    static let panel = Color.white
    static let plum = Color(red: 42 / 255.0, green: 23 / 255.0, blue: 32 / 255.0)
    static let plumMuted = Color(red: 110 / 255.0, green: 88 / 255.0, blue: 98 / 255.0)
    static let plumSoft = Color(red: 155 / 255.0, green: 133 / 255.0, blue: 144 / 255.0)
    static let coral = Color(red: 255 / 255.0, green: 92 / 255.0, blue: 52 / 255.0)
    static let coralHover = Color(red: 255 / 255.0, green: 122 / 255.0, blue: 92 / 255.0)
    static let info = Color(red: 65 / 255.0, green: 96 / 255.0, blue: 111 / 255.0)
    static let creamOnDark = Color(red: 251 / 255.0, green: 246 / 255.0, blue: 236 / 255.0)
    static let border = Color(red: 42 / 255.0, green: 23 / 255.0, blue: 32 / 255.0).opacity(0.10)
    static let shadow = Color(red: 42 / 255.0, green: 23 / 255.0, blue: 32 / 255.0).opacity(0.12)

    /// Stable colour per speaker index (Me = 0, Speaker 1 = 1, …).
    static func speakerFill(index: Int) -> Color {
        let palette = [coral, info, plum, coralHover, plumMuted, Color(red: 90 / 255.0, green: 58 / 255.0, blue: 72 / 255.0)]
        let safe = abs(index)
        return palette[safe % palette.count]
    }
}

enum OzerRadius {
    static let card: CGFloat = 16
    static let pill: CGFloat = 24
    static let button: CGFloat = 14
}

struct OzerFlowerMark: View {
    var size: CGFloat = 56

    var body: some View {
        Canvas { context, canvasSize in
            let center = CGPoint(x: canvasSize.width / 2, y: canvasSize.height / 2)
            let petalRadius = canvasSize.width * 0.16
            let petalLength = canvasSize.width * 0.28
            let petalOffset = canvasSize.width * 0.22

            for index in 0 ..< 5 {
                let angle = Angle.degrees(Double(index) * 72 - 90)
                var transform = CGAffineTransform.identity
                    .translatedBy(x: center.x, y: center.y)
                    .rotated(by: CGFloat(angle.radians))
                    .translatedBy(x: 0, y: -petalOffset)
                let petal = CGPath(
                    ellipseIn: CGRect(
                        x: -petalRadius,
                        y: -petalLength,
                        width: petalRadius * 2,
                        height: petalLength * 2
                    ),
                    transform: &transform
                )
                context.fill(Path(petal), with: .color(OzerPalette.coral))
            }

            let core = canvasSize.width * 0.18
            let coreRect = CGRect(
                x: center.x - core,
                y: center.y - core,
                width: core * 2,
                height: core * 2
            )
            context.fill(Path(ellipseIn: coreRect), with: .color(OzerPalette.coral))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

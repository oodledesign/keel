import SwiftUI

/// Pulse placeholder used while remote data is in flight. Cream/plum, not a spinner.
enum OzerSkeleton {
    static let pulseDuration: TimeInterval = 1.05
}

struct OzerSkeletonBar: View {
    var width: CGFloat? = nil
    var height: CGFloat = 12
    var cornerRadius: CGFloat = 6

    var body: some View {
        OzerSkeletonFill(cornerRadius: cornerRadius)
            .frame(width: width, height: height)
    }
}

struct OzerSkeletonFill: View {
    var cornerRadius: CGFloat = 8

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { context in
            let tick = context.date.timeIntervalSinceReferenceDate
            let wave = (sin(tick * (.pi * 2 / OzerSkeleton.pulseDuration)) + 1) / 2
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(OzerPalette.creamDeep)
                .opacity(0.48 + (0.42 * wave))
        }
    }
}

struct OzerSkeletonRow: View {
    var titleWidth: CGFloat = 160
    var subtitleWidth: CGFloat = 110
    var showSubtitle: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            OzerSkeletonBar(width: titleWidth, height: 14)
            if showSubtitle {
                OzerSkeletonBar(width: subtitleWidth, height: 11)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct OzerListSkeleton: View {
    var rows: Int = 7
    var accessibilityLabel: String = "Loading"

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ForEach(0 ..< rows, id: \.self) { index in
                    OzerSkeletonRow(
                        titleWidth: index.isMultiple(of: 2) ? 168 : 132,
                        subtitleWidth: index.isMultiple(of: 3) ? 96 : 120
                    )
                    if index < rows - 1 {
                        Divider().overlay(OzerPalette.border)
                    }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                    .stroke(OzerPalette.border, lineWidth: 1)
            }
            .padding(.top, 8)
            .padding(.bottom, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(.updatesFrequently)
    }
}

struct OzerFinanceSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            OzerSkeletonBar(width: 88, height: 10)
            HStack(alignment: .top, spacing: 12) {
                financeColumn
                financeColumn
            }
            OzerSkeletonFill(cornerRadius: 12)
                .frame(maxWidth: .infinity)
                .frame(height: 96)
            OzerSkeletonBar(width: 140, height: 12)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading finances")
        .accessibilityAddTraits(.updatesFrequently)
    }

    private var financeColumn: some View {
        VStack(alignment: .leading, spacing: 8) {
            OzerSkeletonBar(width: 28, height: 10)
            OzerSkeletonBar(width: 72, height: 22, cornerRadius: 7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct OzerHomeSkeleton: View {
    var showsFinances: Bool
    var isSurveyor: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if isSurveyor {
                    surveyor
                } else {
                    personal
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading today")
        .accessibilityAddTraits(.updatesFrequently)
    }

    private var personal: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                OzerSkeletonBar(width: 168, height: 26, cornerRadius: 8)
                OzerSkeletonBar(width: 120, height: 13)
                OzerSkeletonBar(width: 96, height: 13)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(0 ..< 4, id: \.self) { _ in
                        OzerSkeletonBar(width: 92, height: 34, cornerRadius: 17)
                    }
                }
            }
            if showsFinances {
                OzerFinanceSkeleton()
            }
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 8) {
                    OzerSkeletonBar(width: 64, height: 28, cornerRadius: 14)
                    OzerSkeletonBar(width: 64, height: 28, cornerRadius: 14)
                    OzerSkeletonBar(width: 72, height: 28, cornerRadius: 14)
                }
                .padding(12)
                ForEach(0 ..< 4, id: \.self) { index in
                    OzerSkeletonRow(
                        titleWidth: index.isMultiple(of: 2) ? 176 : 140,
                        subtitleWidth: 100
                    )
                    if index < 3 {
                        Divider().overlay(OzerPalette.border)
                    }
                }
                .padding(.bottom, 8)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                    .stroke(OzerPalette.border, lineWidth: 1)
            }
        }
    }

    private var surveyor: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                OzerSkeletonBar(width: 180, height: 26, cornerRadius: 8)
                OzerSkeletonBar(width: 220, height: 13)
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(0 ..< 4, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: 8) {
                        OzerSkeletonBar(width: 18, height: 12)
                        OzerSkeletonBar(width: 36, height: 22, cornerRadius: 7)
                        OzerSkeletonBar(width: 88, height: 11)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                            .stroke(OzerPalette.border, lineWidth: 1)
                    }
                }
            }
            card(rows: 3)
            card(rows: 3)
        }
    }

    private func card(rows: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            OzerSkeletonBar(width: 120, height: 12)
                .padding(12)
            ForEach(0 ..< rows, id: \.self) { index in
                OzerSkeletonRow(titleWidth: 150, subtitleWidth: 90)
                if index < rows - 1 {
                    Divider().overlay(OzerPalette.border)
                }
            }
            .padding(.bottom, 8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }
}

struct OzerThreadSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(0 ..< 5, id: \.self) { index in
                HStack {
                    if index.isMultiple(of: 2) {
                        OzerSkeletonBar(width: 180, height: 36, cornerRadius: 14)
                        Spacer(minLength: 48)
                    } else {
                        Spacer(minLength: 48)
                        OzerSkeletonBar(width: 150, height: 36, cornerRadius: 14)
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .accessibilityLabel("Loading messages")
        .accessibilityAddTraits(.updatesFrequently)
    }
}

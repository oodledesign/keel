import SwiftUI

struct RecipeDetailView: View {
    @Environment(AppSession.self) private var session
    let recipeId: String
    let title: String

    @State private var detail: NativeRecipeDetail?
    @State private var loadError: NativeAPIError?
    private let client = NativeAPIClient()

    var body: some View {
        Group {
            if let detail {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(detail.name)
                            .font(.title2.weight(.bold))
                            .foregroundStyle(OzerPalette.plum)
                        if let description = detail.description, !description.isEmpty {
                            Text(description)
                                .font(.body)
                                .foregroundStyle(OzerPalette.plumMuted)
                        }
                        if !detail.dietTags.isEmpty {
                            Text(detail.dietTags.joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(OzerPalette.plumMuted)
                        }
                        NavigationLink {
                            RecipeCookView(detail: detail)
                        } label: {
                            Label("Cook mode", systemImage: "frying.pan")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(OzerPalette.coral, in: RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous))
                        }
                        .buttonStyle(.plain)

                        section("Ingredients") {
                            ForEach(detail.ingredients, id: \.self) { line in
                                Text(line)
                                    .font(.body)
                                    .foregroundStyle(OzerPalette.plum)
                            }
                        }

                        if !detail.steps.isEmpty {
                            section("Method") {
                                ForEach(Array(detail.steps.enumerated()), id: \.element.id) { index, step in
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(step.title.isEmpty ? "Step \(index + 1)" : step.title)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(OzerPalette.plum)
                                        Text(step.content)
                                            .font(.body)
                                            .foregroundStyle(OzerPalette.plumMuted)
                                    }
                                }
                            }
                        } else if let instructions = detail.instructions, !instructions.isEmpty {
                            section("Method") {
                                Text(instructions)
                                    .font(.body)
                                    .foregroundStyle(OzerPalette.plumMuted)
                            }
                        }
                    }
                    .padding(20)
                }
            } else if let loadError {
                Text(loadError.localizedDescription)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .padding()
            } else {
                ProgressView().tint(OzerPalette.coral)
            }
        }
        .background(OzerPalette.cream.ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
                .foregroundStyle(OzerPalette.plum)
            content()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func load() async {
        do {
            let token = try await session.validAccessToken()
            detail = try await client.recipe(
                id: recipeId,
                workspace: session.workspaceQueryValue,
                accessToken: token
            )
        } catch is CancellationError {
            return
        } catch let error as NativeAPIError {
            if error == .unauthorized { await session.handleUnauthorized() }
            loadError = error
        } catch {
            if error.isTaskCancellation { return }
            loadError = .transport(error.localizedDescription)
        }
    }
}

struct RecipeCookView: View {
    let detail: NativeRecipeDetail
    @State private var servings: Int
    @State private var stepIndex = 0
    @State private var remaining: Int?
    @State private var running = false

    init(detail: NativeRecipeDetail) {
        self.detail = detail
        _servings = State(initialValue: max(1, detail.servings ?? 1))
    }

    private var baseServings: Int { max(1, detail.servings ?? 1) }
    private var scale: Double { Double(servings) / Double(baseServings) }

    private var steps: [NativeRecipeStep] {
        if !detail.steps.isEmpty { return detail.steps }
        if let instructions = detail.instructions, !instructions.isEmpty {
            return [NativeRecipeStep(id: "fallback", title: "Method", content: instructions, timerSeconds: nil)]
        }
        return []
    }

    private var currentStep: NativeRecipeStep? { steps[safe: stepIndex] }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    Text("Servings")
                        .foregroundStyle(OzerPalette.plumMuted)
                    Spacer()
                    Button { servings = max(1, servings - 1) } label: {
                        Image(systemName: "minus")
                    }
                    Text("\(servings)")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(OzerPalette.plum)
                        .frame(minWidth: 28)
                    Button { servings = min(50, servings + 1) } label: {
                        Image(systemName: "plus")
                    }
                }

                if !scaledIngredients.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Ingredients")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(OzerPalette.plumMuted)
                        ForEach(scaledIngredients, id: \.self) { line in
                            Text(line)
                                .font(.body)
                                .foregroundStyle(OzerPalette.plum)
                        }
                    }
                }

                if let step = currentStep {
                    Text("Step \(stepIndex + 1) of \(steps.count)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(OzerPalette.plumMuted)
                    Text(step.title.isEmpty ? "Method" : step.title)
                        .font(.headline)
                        .foregroundStyle(OzerPalette.plum)
                    Text(step.content)
                        .font(.title3.weight(.medium))
                        .foregroundStyle(OzerPalette.plum)

                    if let timer = step.timerSeconds, timer > 0 {
                        HStack(spacing: 12) {
                            Text(formatTimer(remaining ?? timer))
                                .font(.title.weight(.semibold).monospacedDigit())
                                .foregroundStyle(OzerPalette.plum)
                            Button(running ? "Pause" : "Start timer") {
                                if remaining == nil { remaining = timer }
                                running.toggle()
                            }
                            if remaining != nil {
                                Button("Reset") {
                                    running = false
                                    remaining = timer
                                }
                            }
                        }
                    }

                    HStack {
                        Button("Previous") { moveStep(to: stepIndex - 1) }
                            .disabled(stepIndex == 0)
                        Spacer()
                        Button("Next") { moveStep(to: stepIndex + 1) }
                            .disabled(stepIndex >= steps.count - 1)
                    }
                } else {
                    Text("This recipe has no method yet.")
                        .foregroundStyle(OzerPalette.plumMuted)
                }
            }
            .padding(20)
        }
        .background(OzerPalette.cream.ignoresSafeArea())
        .navigationTitle("Cook")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            guard running, let value = remaining, value > 0 else { return }
            let next = value - 1
            remaining = next
            if next == 0 { running = false }
        }
    }

    private var scaledIngredients: [String] {
        if !detail.structuredIngredients.isEmpty {
            return detail.structuredIngredients.map { ingredient in
                if let amount = ingredient.amount {
                    let scaled = amount * scale
                    let amountText = scaled == floor(scaled)
                        ? String(Int(scaled))
                        : String(format: "%g", (scaled * 100).rounded() / 100)
                    let unit = ingredient.unit?.isEmpty == false ? " \(ingredient.unit!)" : ""
                    return "\(amountText)\(unit) \(ingredient.name)"
                }
                return ingredient.originalText
            }
        }
        return detail.ingredients
    }

    private func moveStep(to index: Int) {
        stepIndex = min(max(0, index), max(0, steps.count - 1))
        running = false
        remaining = currentStep?.timerSeconds
    }

    private func formatTimer(_ total: Int) -> String {
        String(format: "%d:%02d", total / 60, total % 60)
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        guard indices.contains(index) else { return nil }
        return self[index]
    }
}

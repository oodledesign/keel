import AuthenticationServices
import SwiftUI

struct SignInView: View {
    @Environment(AppSession.self) private var session
    @State private var email = ""
    @State private var otpCode = ""
    @State private var magicLinkSent = false
    @State private var magicLinkMessage: String?
    @State private var isWorking = false
    @State private var appleNonce = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                header
                if !AppConfiguration.isSupabaseConfigured {
                    configHint
                }
                providerButtons
                magicLink
                if let error = session.lastError {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(OzerPalette.coral)
                }
            }
            .padding(28)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .background(OzerPalette.cream.ignoresSafeArea())
        .disabled(isWorking)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            OzerFlowerMark(size: 52)
            Text("Ozer")
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .foregroundStyle(OzerPalette.plum)
            Text("Pick up where you left off — studio, life, and plans in one home.")
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, 24)
    }

    private var configHint: some View {
        Text("Add OZER_SUPABASE_ANON_KEY in Config/Local.xcconfig to sign in. The key is never committed.")
            .font(.footnote)
            .foregroundStyle(OzerPalette.plumMuted)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(OzerPalette.creamDeep, in: RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous))
    }

    private var providerButtons: some View {
        VStack(spacing: 12) {
            SignInWithAppleButton(.signIn) { request in
                let raw = PKCE.randomURLSafe(byteCount: 32)
                appleNonce = raw
                request.requestedScopes = [.email, .fullName]
                request.nonce = PKCE.sha256Hex(raw)
            } onCompletion: { result in
                switch result {
                case .success(let authorization):
                    Task { await run { await session.completeAppleSignIn(authorization: authorization, rawNonce: appleNonce) } }
                case .failure(let error):
                    let nsError = error as NSError
                    if nsError.domain == ASAuthorizationError.errorDomain,
                       nsError.code == ASAuthorizationError.canceled.rawValue {
                        return
                    }
                    session.reportError(error.localizedDescription)
                }
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: 52)
            .clipShape(RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous))
            .accessibilityLabel("Sign in with Apple")

            Button {
                Task { await run { await session.signInWithGoogle() } }
            } label: {
                labelRow(title: "Continue with Google", systemImage: "g.circle")
            }
            .buttonStyle(OzerSecondaryButtonStyle())
        }
    }

    private var magicLink: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Or use a magic link")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(OzerPalette.plumMuted)

            TextField("Email address", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.horizontal, 14)
                .frame(height: 52)
                .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous)
                        .stroke(OzerPalette.border, lineWidth: 1)
                }

            Button {
                Task {
                    await run {
                        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
                        magicLinkMessage = await session.sendMagicLink(email: trimmed)
                        if magicLinkMessage != nil {
                            magicLinkSent = true
                        }
                    }
                }
            } label: {
                Text("Email me a link")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
            }
            .buttonStyle(OzerPrimaryButtonStyle())
            .disabled(trimmedEmail.isEmpty)

            if magicLinkSent {
                if let magicLinkMessage {
                    Text(magicLinkMessage)
                        .font(.footnote)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                otpFields
            }
        }
    }

    private var trimmedEmail: String {
        email.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var sanitizedOTP: String {
        String(otpCode.filter(\.isNumber).prefix(8))
    }

    private var otpFields: some View {
        VStack(alignment: .leading, spacing: 10) {
            TextField("8-digit code", text: otpCodeBinding)
                .textContentType(.oneTimeCode)
                .keyboardType(.numberPad)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.horizontal, 14)
                .frame(height: 52)
                .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous)
                        .stroke(OzerPalette.border, lineWidth: 1)
                }
                .accessibilityLabel("8-digit code")

            Button {
                Task {
                    await run {
                        await session.verifyEmailOTP(email: trimmedEmail, token: sanitizedOTP)
                    }
                }
            } label: {
                Text("Verify code")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
            }
            .buttonStyle(OzerPrimaryButtonStyle())
            .disabled(!(sanitizedOTP.count == 6 || sanitizedOTP.count == 8) || trimmedEmail.isEmpty)
            .accessibilityLabel("Verify code")
        }
    }

    private var otpCodeBinding: Binding<String> {
        Binding(
            get: { otpCode },
            set: { otpCode = String($0.filter(\.isNumber).prefix(8)) }
        )
    }

    private func labelRow(title: String, systemImage: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: systemImage)
            Text(title)
                .font(.body.weight(.semibold))
        }
        .frame(maxWidth: .infinity)
        .frame(height: 52)
    }

    private func run(_ work: () async -> Void) async {
        isWorking = true
        defer { isWorking = false }
        await work()
    }
}

struct OzerPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(Color.white)
            .background(
                configuration.isPressed ? OzerPalette.coralHover : OzerPalette.coral,
                in: RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous)
            )
    }
}

struct OzerSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(OzerPalette.plum)
            .background(
                configuration.isPressed ? OzerPalette.creamDeep : OzerPalette.panel,
                in: RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous)
                    .stroke(OzerPalette.border, lineWidth: 1)
            }
    }
}

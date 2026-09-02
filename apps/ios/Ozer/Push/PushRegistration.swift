import Foundation
import UIKit
import UserNotifications

extension Notification.Name {
    static let ozerDidReceiveDeviceToken = Notification.Name("so.ozer.app.didReceiveDeviceToken")
    static let ozerDidReceiveInvoicePush = Notification.Name("so.ozer.app.didReceiveInvoicePush")
}

enum PushRegistration {
    private static let tokenKey = "so.ozer.app.apnsToken"

    static var lastToken: String? {
        get { UserDefaults.standard.string(forKey: tokenKey) }
        set { UserDefaults.standard.set(newValue, forKey: tokenKey) }
    }

    static func requestAuthorization() async {
        let center = UNUserNotificationCenter.current()
        let granted: Bool
        do {
            granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            return
        }
        guard granted else { return }
        await MainActor.run {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    
    @MainActor
    static func registerIfNeeded(session: AppSession) async {
        await requestAuthorization()
        if let lastToken {
            await register(token: lastToken, session: session)
        }
    }

    
    @MainActor
    static func register(token hex: String, session: AppSession) async {
        lastToken = hex
        do {
            let accessToken = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            try await NativeAPIClient().registerDevice(
                token: hex,
                workspace: workspace.isEmpty ? nil : workspace,
                accessToken: accessToken
            )
        } catch {
            return
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let hex = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        NotificationCenter.default.post(name: .ozerDidReceiveDeviceToken, object: hex)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // Simulator has no APNs token. Fail quietly.
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) {
        let userInfo = response.notification.request.content.userInfo
        if let invoiceId = userInfo["invoice_id"] as? String, !invoiceId.isEmpty {
            NotificationCenter.default.post(name: .ozerDidReceiveInvoicePush, object: invoiceId)
            return
        }
        if let raw = userInfo["url"] as? String {
            NotificationCenter.default.post(name: .ozerDidReceiveInvoicePush, object: raw)
        }
    }
}

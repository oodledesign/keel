import Foundation

enum SurveyPhotoSyncPreference: String, Equatable {
    case waitForWifi = "wifi"
    case useMobileData = "cellular"

    static let storageKey = "so.ozer.survey.photoSyncUsesMobileData"

    var allowsMobileData: Bool {
        self == .useMobileData
    }

    var settingsLabel: String {
        switch self {
        case .waitForWifi:
            return "Wait for Wi-Fi"
        case .useMobileData:
            return "Use mobile data"
        }
    }

    var settingsDetail: String {
        switch self {
        case .waitForWifi:
            return "Large survey photos stay on this iPhone until you are on Wi-Fi. Recordings still upload on mobile data."
        case .useMobileData:
            return "Survey photos may upload over mobile data when you reconnect."
        }
    }

    static var current: SurveyPhotoSyncPreference {
        get { from(allowsMobileData: UserDefaults.standard.bool(forKey: storageKey)) }
        set { UserDefaults.standard.set(newValue.allowsMobileData, forKey: storageKey) }
    }

    static func from(allowsMobileData: Bool) -> SurveyPhotoSyncPreference {
        allowsMobileData ? .useMobileData : .waitForWifi
    }
}

enum SurveyPhotoSync {
    /// Longest edge for the report-bound JPEG uploaded to Ozer.
    static let maxUploadPixelSize = 2048
    /// Sensible quality for desk-review / report copies.
    static let uploadJpegQuality: Double = 0.72

    static let archiveRetentionNote =
        "The iPhone keeps the higher-resolution original in the on-device archive. The copy uploaded to Ozer is compressed for the report library."

    static func shouldUploadPhotos(
        isOnline: Bool,
        isCellular: Bool,
        preference: SurveyPhotoSyncPreference
    ) -> Bool {
        guard isOnline else { return false }
        if isCellular && !preference.allowsMobileData {
            return false
        }
        return true
    }

    static func waitingForWifiMessage(pendingPhotoCount: Int) -> String {
        pendingPhotoCount == 1
            ? "1 photo is waiting for Wi-Fi. Turn on mobile data in survey settings to upload now."
            : "\(pendingPhotoCount) photos are waiting for Wi-Fi. Turn on mobile data in survey settings to upload now."
    }
}

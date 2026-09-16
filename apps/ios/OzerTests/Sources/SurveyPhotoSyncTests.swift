import Foundation
@testable import OzerSurveys

enum SurveyPhotoSyncTests {
    static func run(check: (String, () -> Bool) -> Void) {
        check("photos wait for Wi-Fi when the preference is off") {
            !SurveyPhotoSync.shouldUploadPhotos(
                isOnline: true,
                isCellular: true,
                preference: .waitForWifi
            )
            && SurveyPhotoSync.shouldUploadPhotos(
                isOnline: true,
                isCellular: true,
                preference: .useMobileData
            )
            && SurveyPhotoSync.shouldUploadPhotos(
                isOnline: true,
                isCellular: false,
                preference: .waitForWifi
            )
            && !SurveyPhotoSync.shouldUploadPhotos(
                isOnline: false,
                isCellular: false,
                preference: .useMobileData
            )
        }

        check("preference maps the mobile-data toggle") {
            SurveyPhotoSyncPreference.from(allowsMobileData: false) == .waitForWifi
                && SurveyPhotoSyncPreference.from(allowsMobileData: true) == .useMobileData
                && SurveyPhotoSyncPreference.waitForWifi.settingsLabel == "Wait for Wi-Fi"
                && SurveyPhotoSync.maxUploadPixelSize == 2048
                && SurveyPhotoSync.uploadJpegQuality == 0.72
        }

        check("waiting copy names the queued photos") {
            SurveyPhotoSync.waitingForWifiMessage(pendingPhotoCount: 1)
                .contains("1 photo")
                && SurveyPhotoSync.waitingForWifiMessage(pendingPhotoCount: 3)
                    .contains("3 photos")
        }
    }
}

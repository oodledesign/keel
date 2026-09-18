import Foundation
@testable import OzerWorkspace

enum ContentLoadPhaseTests {
    static func run(check: (String, () -> Bool) -> Void) {
        check("first paint with no payload is a skeleton, not empty or error") {
            ContentLoadPhase.resolve(
                workspacesLoaded: false,
                workspaceQueryEmpty: true,
                hasContent: false,
                hasError: false
            ) == .skeleton
        }

        check("pending workspace memberships stay on skeleton") {
            ContentLoadPhase.resolve(
                workspacesLoaded: false,
                workspaceQueryEmpty: true,
                hasContent: false,
                hasError: false
            ) == .skeleton
        }

        check("cached content wins over a refresh error") {
            ContentLoadPhase.resolve(
                workspacesLoaded: true,
                workspaceQueryEmpty: false,
                hasContent: true,
                hasError: true
            ) == .content
        }

        check("true empty memberships show the no-workspace state") {
            ContentLoadPhase.resolve(
                workspacesLoaded: true,
                workspaceQueryEmpty: true,
                hasContent: false,
                hasError: false
            ) == .noWorkspaces
        }

        check("failed cold start shows error after the load") {
            ContentLoadPhase.resolve(
                workspacesLoaded: true,
                workspaceQueryEmpty: false,
                hasContent: false,
                hasError: true
            ) == .error
        }

        check("finances stay on skeleton until the fetch finishes") {
            FinanceLoadPhase.resolve(
                hasFinances: false,
                isLoading: false,
                loadFinished: false
            ) == .skeleton
                && FinanceLoadPhase.resolve(
                    hasFinances: false,
                    isLoading: true,
                    loadFinished: false
                ) == .skeleton
        }

        check("finances unavailable is only after a finished failed load") {
            FinanceLoadPhase.resolve(
                hasFinances: false,
                isLoading: false,
                loadFinished: true
            ) == .unavailable
        }

        check("cached finances stay visible during a quiet refresh") {
            FinanceLoadPhase.resolve(
                hasFinances: true,
                isLoading: true,
                loadFinished: false
            ) == .content
        }

        check("cached home content shows while workspaces are still loading") {
            ContentLoadPhase.resolve(
                workspacesLoaded: false,
                workspaceQueryEmpty: false,
                hasContent: true,
                hasError: false
            ) == .content
        }
    }
}

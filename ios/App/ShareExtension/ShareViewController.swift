// Totem — iOS Share Extension
//
// When the user shares a URL from Spotify / Apple Music / YouTube Music
// (or any app that emits a public.url), we don't render UI ourselves — we
// pull the URL out of the share intent, build a custom-scheme deep link
// (dev.cmrd.totem://share?url=…), hand off to the main app via
// extensionContext?.open(_:completionHandler:), and exit.
//
// The main app's Capacitor App plugin's appUrlOpen listener catches the
// URL and routes to the "Add to Totem" picker view. This keeps the
// extension's memory footprint trivial (Apple caps share extensions at
// ~120 MB) and avoids reimplementing the picker UI in Swift.

import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        // Subtle backdrop while we resolve the URL — most users will see this
        // only as a flicker before the host app opens.
        view.backgroundColor = UIColor(white: 0, alpha: 0.4)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        extractSharedUrl { [weak self] url in
            guard let self = self else { return }
            if let url = url {
                self.openHostApp(with: url)
            } else {
                self.completeRequest()
            }
        }
    }

    /// Walks the input items looking for a public.url attachment and resolves
    /// it via NSItemProvider. Falls back to public.plain-text in case the
    /// host app shared the URL as a text string (some music apps do this).
    private func extractSharedUrl(completion: @escaping (URL?) -> Void) {
        guard
            let items = extensionContext?.inputItems as? [NSExtensionItem]
        else {
            completion(nil)
            return
        }

        for item in items {
            guard let attachments = item.attachments else { continue }
            for provider in attachments {
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { (data, _) in
                        if let url = data as? URL {
                            completion(url)
                        } else if let s = data as? String, let url = URL(string: s) {
                            completion(url)
                        } else {
                            completion(nil)
                        }
                    }
                    return
                }
            }
            for provider in attachments {
                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { (data, _) in
                        if let s = data as? String, let url = URL(string: s.trimmingCharacters(in: .whitespacesAndNewlines)) {
                            completion(url)
                        } else {
                            completion(nil)
                        }
                    }
                    return
                }
            }
        }
        completion(nil)
    }

    /// Build dev.cmrd.totem://share?url=<percent-encoded> and ask iOS to open
    /// the host app with it. The URL scheme is registered in the main app's
    /// Info.plist (CFBundleURLTypes).
    private func openHostApp(with url: URL) {
        let encoded = url.absoluteString.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        guard let deepLink = URL(string: "dev.cmrd.totem://share?url=\(encoded)") else {
            completeRequest()
            return
        }

        // openURL is only available on UIApplication, which extensions can't
        // touch directly. The supported pattern is to walk the responder chain
        // and call `open(_:options:completionHandler:)` on whatever responder
        // implements it (in practice, the host app's UIApplication).
        var responder: UIResponder? = self
        while responder != nil {
            if let app = responder as? UIApplication {
                app.open(deepLink, options: [:], completionHandler: nil)
                break
            }
            responder = responder?.next
        }
        // Some iOS versions don't expose UIApplication via the responder chain
        // for extensions. The selector-based fallback below is the legacy path.
        if responder == nil {
            let selectorOpenURL = NSSelectorFromString("openURL:")
            var r: UIResponder? = self
            while let cur = r {
                if cur.responds(to: selectorOpenURL) {
                    cur.perform(selectorOpenURL, with: deepLink)
                    break
                }
                r = cur.next
            }
        }

        completeRequest()
    }

    private func completeRequest() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }
}

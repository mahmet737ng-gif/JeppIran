# JEPPIRAN Android phone + subscriptions — staged integration (2026-10-13)

## Scope and invariant UI
- Target: Android 6–6.9 inch phones, portrait and landscape.
- The iPad/Safari web interface is the SINGLE visual source of truth. Android
  phone preview uses a WebView of the actual hosted web experience and an
  Android-only responsive CSS layer; do not redraw or replace approved chart
  gestures, icons, Home ILS backgrounds, aircraft marker, TAXI or CDFA.
- Minimum primary touch target: 44 CSS px/dp where practical, readable
  labels at 320–430 CSS px, no horizontal overflow of the entire page.
- **Offline intentionally out of scope.** Do not plan/download subscription
  packages to offline storage in this feature. Existing offline implementation
  elsewhere must not be refactored without a separate request.

## Current safe staging
- `MobileWebActivity` opens the deployed online web UI and is available ONLY
  by long-pressing the native Home **Charts** card on this feature branch.
- Normal native UI remains unchanged while encrypted chart backend is absent.
- The mobile WebView is **not** a license boundary; it cannot be used to protect
  publicly hosted chart PDFs. DO NOT ship the preview as a paid secure release.
- No production Web/Safari styling or functionality has been changed.

## Subscription design (NOT YET IMPLEMENTED)
1. UI states: Guest/Demo, active subscriber, expired subscriber, administrator.
2. Use username/password auth service with rate limiting, salted password hashes
   (managed IdP strongly preferred), HttpOnly/secure tokens where possible.
3. Only the backend enforces access. All terminal and enroute content, including
   PDF source, changed-chart variants, thumbnails that reveal charts, and
   packages must move to PRIVATE encrypted object storage.
4. Publish a `.jpc` encrypted per-airport/per-cycle package. Use AES-256-GCM
   with fresh random nonce per encrypted object; DO NOT embed decryption key
   or plaintext PDF in Android binary, JS source, source repository, manifest,
   GitHub Pages, or public update release.
5. On successful login, backend verifies subscription, entitlements, device
   binding and chart-cycle permissions before releasing short-lived scoped
   key grants / data. The renderer decrypts into memory using Web Crypto
   or native crypto, feeds bytes to existing PDF.js viewer, and immediately
   discards plaintext after page/session.
6. Guest account receives only synthetic or explicitly licensed demo data;
   do not grant real chart URLs and hide buttons as a substitute for security.
7. Payment activation requires a verified server-side webhook; NEVER unlock
   from a browser-supplied `payment=success` flag.
8. Separate mandatory end-to-end tests: expired account cannot obtain blobs
   or keys, direct chart URL blocked, tampered token fails, second/third device
   controlled, prior releases no longer anonymously expose PDF.
9. Remove or revoke public legacy chart links and verify downstream caches
   before calling this feature secure. Browser cannot prevent all screenshots
   or extraction of already decrypted pixels, so communicate DRM limitations.

## Remaining deployment prerequisites
- Owner-provisioned authentication host/credentials, encrypted private storage,
  payment provider (if purchases required), authorized chart feed and key
  management. Never commit secrets to GitHub.
- QA across phone portrait/landscape, JS gestures, GPS permissions, simulator
  handshake and live chart rendering, plus automated Android build/signature.
- Main-branch APK must NOT be published until backend entitlement enforcement
  and encrypted-chart migration pass security checks.

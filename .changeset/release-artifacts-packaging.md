---
"@wuneo/nativescript-env": minor
---

feat(artifacts): add automated release artifacts collection and symbols packaging for Android and iOS

- **Android**: Automatically collects `.aab`, `.apk`, packages C++/NDK native debug symbols (`.so`) into `.zip` files ready for Google Play Console (supports AGP 7/8), and archives R8/ProGuard `mapping.txt`.
- **iOS**: Archives `.xcarchive` directly into structured `dist/v{version}-{buildNumber}_{env}/` directories, collects `.ipa` packages, packages `.dSYM` debug symbols to `.zip`, and provides optional automatic upload to Firebase Crashlytics via `upload-symbols`.
- **Hooks**: Added unified, multi-alias `after-build` lifecycle hooks with debounce protection.
- **CLI**: Added `npx wuneo-env artifacts [android|ios|all]` command and updated template configuration in `init`.

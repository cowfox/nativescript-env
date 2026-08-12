# @wuneo/nativescript-env

[![NPM version](https://img.shields.io/npm/v/@wuneo/nativescript-env.svg)](https://www.npmjs.com/package/@wuneo/nativescript-env)
[![License](https://img.shields.io/npm/l/@wuneo/nativescript-env.svg)](LICENSE)
[![Downloads](https://img.shields.io/npm/dm/@wuneo/nativescript-env.svg)](https://www.npmjs.com/package/@wuneo/nativescript-env)

The complete environment management plugin for **NativeScript 8+**. Effortlessly switch **App IDs**, **App Icons**, and **Environment-Specific Resources** (such as `GoogleService-Info.plist`, `google-services.json`, or API environment configs) per build command!

---

## 🚀 Why @wuneo/nativescript-env?

* ❌ **Without this plugin**: You have to manually edit `nativescript.config.ts`, rename `GoogleService-Info.plist` / `google-services.json`, or copy icons every time you switch between Dev, Staging, and Production builds.
* ✅ **With this plugin**: Simply pass `--env.use.<name>` in your CLI command (`ns run android --env.use.staging`). Everything—from **App ID** to **native resources** and **icons**—is swapped automatically with zero manual effort!

---

## ⚡️ Quick Start

### 1. Installation

```bash
npm i @wuneo/nativescript-env --save-dev
# or
yarn add @wuneo/nativescript-env --dev
```

### 2. Initialize Configuration File

Run the initialization command in your NativeScript project root:

```bash
npx wuneo-env init
```

This will create an `environment-rules.yaml` template file in your project root with detailed explanatory comments.

*(No modifications to `nativescript.config.ts` required! The plugin automatically manages App IDs, assets, and resources in the background during build time.)*

---

### ⚙️ Environment Configuration (`environment-rules.yaml` or `.json`)

You can use either **`environment-rules.yaml`** (recommended for adding comments) or `environment-rules.json`:

```yaml
# ==============================================================================
# NativeScript Environment Rules Configuration (@wuneo/nativescript-env)
# ==============================================================================

# App Version & Build Numbers
version: "6.10.0"
buildNumber: "6"
autoVersionCode: true

# Default active environment when no CLI flag (e.g. --env.use.<env>) is specified
default: "development"

# Extra directories to scan for environment-specific file overrides (e.g. environment.dev.ts -> environment.ts)
extraPaths:
  - "environments"

# Direct file copy mappings (Source file in env folder -> Destination file in project)
directCopyRules:
  Info.plist: "App_Resources/iOS/Info.plist"
  GoogleService-Info.plist: "App_Resources/iOS/GoogleService-Info.plist"
  Podfile: "App_Resources/iOS/Podfile"

# Master App Icon path (Automatically resizes for iOS & Android)
appIconPath: "environments/app-icon/icon.png"

# Environment Definitions
environments:
  - name: "development"
    appBundleId: "com.example.app.dev"

  - name: "staging"
    appBundleId: "com.example.app.staging"

  - name: "release"
    appBundleId:
      android: "com.example.app.android"
      ios: "com.example.app.ios"
```

### 4. Build Your App

```bash
# Build for Development (Uses default env)
ns run android

# Build for Staging / Release
ns run ios --env.use.release
```

---

## 📂 Deep Dive: Managing Environment Files & Native Resources

This plugin provides two complementary mechanisms for managing environment-specific files: **`extraPaths`** and **`directCopyRules`**.

### 1. `extraPaths` (Suffix-Based In-Place File Swapping)

In your source code (e.g. `src/environments/` or `app/`), you can keep environment-specific variants alongside your base files.

#### Project File Structure Example:
```text
my-project/
├── environments/
│   ├── environment.ts            <-- Base file (Imported in your JS/TS code)
│   ├── environment.dev.ts        <-- Active when --env.use.development
│   ├── environment.staging.ts    <-- Active when --env.use.staging
│   └── environment.release.ts    <-- Active when --env.use.release
```

#### How it works:
When `extraPaths: ["environments"]` is set and you build with `--env.use.staging`:
1. The plugin finds `environment.staging.ts`.
2. It overwrites `environment.ts` with the contents of `environment.staging.ts`.
3. In `after-prepare`, all `*.staging.ts`, `*.dev.ts`, etc. files are automatically filtered out from the final native build bundle to keep production binaries clean.

---

### 2. `directCopyRules` (Native Resource Overrides for iOS & Android)

Native resources for iOS and Android often require exact filenames placed in specific directories (like `App_Resources/iOS` or `App_Resources/Android`).

#### Project File Structure Example:
```text
my-project/
├── environments/
│   ├── iOS/
│   │   ├── Info.dev.plist
│   │   ├── Info.release.plist
│   │   ├── GoogleService-Info.dev.plist
│   │   ├── GoogleService-Info.release.plist
│   │   ├── Podfile.dev
│   │   └── Podfile.release
│   └── Android/
│       ├── google-services.dev.json
│       └── google-services.release.json
```

#### Configuration Example in `environment-rules.yaml`:
```yaml
directCopyRules:
  # iOS Resources
  Info.plist: "App_Resources/iOS/Info.plist"
  GoogleService-Info.plist: "App_Resources/iOS/GoogleService-Info.plist"
  Podfile: "App_Resources/iOS/Podfile"

  # Android Resources
  google-services.json: "App_Resources/Android/google-services.json"
```

#### How iOS & Android Resource Management Works:
- **iOS (`Info.plist`, `GoogleService-Info.plist`, `Podfile`)**:
  During `before-prepare`, the plugin matches `Info.<env>.plist` inside your `environments/` directory and copies it directly to `App_Resources/iOS/Info.plist`. Xcode / CocoaPods then picks up the updated file during compile time.
- **Android (`google-services.json`)**:
  Android's Google Services Gradle plugin (`com.google.gms.google-services`) requires `google-services.json` to be physically present at `App_Resources/Android/google-services.json`. The plugin copies `google-services.<env>.json` $\rightarrow$ `App_Resources/Android/google-services.json` before Gradle tasks execute, ensuring Firebase & Push Notifications build seamlessly per environment.

---

## 🛠 Features & Capabilities

- 🎯 **Dynamic App Bundle ID**: Set per-environment App IDs directly in `environment-rules.yaml`, with optional platform overrides (`{ "android": "...", "ios": "..." }`).
- 📁 **Smart File Swapping**: Automatically matches files like `environment.staging.ts` $\rightarrow$ `environment.ts` or `GoogleService-Info.dev.plist` $\rightarrow$ `GoogleService-Info.plist` during build.
- 🎨 **App Icon Generation**: Integrates with NativeScript resource generator to build environment-specific App Icons automatically.
- 🔢 **Auto Versioning**: Manages `versionName`, `versionCode`, and `buildNumber` across builds.
- ⚡️ **Zero Code Modifications**: Built natively for NativeScript 8+ with zero runtime overhead or `nativescript.config.ts` hacks.

---

## 📖 Configuration Reference (`environment-rules.yaml` / `.json`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `default` | `string` | Default environment name if `--env.use.<name>` is omitted. |
| `environments` | `Array` | Environment definitions (`name`, `appBundleId`, optional `matchRules`). |
| `environments[].appBundleId` | `string` \| `object` | App Bundle ID string or `{ "android": "...", "ios": "..." }`. |
| `environments[].matchRules` | `string` (Optional) | Custom regex matching pattern (Auto-derived as `.*\.name\..*` if omitted). |
| `extraPaths` | `string[]` | Additional directories outside `App_Resources` to process suffix file swapping. |
| `directCopyRules` | `Record<string, string>` | Direct file copy mappings after standard environment file swap. |
| `appIconPath` | `string` | Master icon file path to generate platform app icons. |

---

## 📦 Legacy Support (NativeScript 6/7)

If you are using NativeScript 7 or older, please install version `0.8.2` of the legacy package:

```bash
npm i nativescript-multiple-environments-building@0.8.2 --save-dev
```

For legacy documentation and usage instructions, please refer to the [v0.8.2 Git Tag Documentation](https://github.com/cowfox/nativescript-multiple-environments-building/tree/v0.8.2#readme).

---

## 📄 License

Apache-2.0 © [cowfox](https://github.com/cowfox)

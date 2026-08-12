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

## 🛠 Features & Capabilities

- 🎯 **Dynamic App Bundle ID**: Set per-environment App IDs directly in `environment-rules.json`, with optional platform overrides (`{ "android": "...", "ios": "..." }`).
- 📁 **Smart File Copying**: Automatically matches files like `google-services.staging.json` $\rightarrow$ `google-services.json` or `environment.prod.ts` $\rightarrow$ `environment.ts` during build.
- 🎨 **App Icon Generation**: Integrates with `ns resources generate icons` to build environment-specific App Icons automatically.
- 🔢 **Auto Versioning**: Manages `versionName`, `versionCode`, and `buildNumber` across builds.
- ⚡️ **Zero Legacy Hacks**: Built natively for NativeScript 8+ with zero runtime overhead.

---

## 📖 Configuration Reference (`environment-rules.json`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `default` | `string` | Default environment name if `--env.use.<name>` is omitted. |
| `environments` | `Array` | Environment definitions (`name`, `appBundleId`, optional `matchRules`). |
| `environments[].appBundleId` | `string` \| `object` | App Bundle ID string or `{ "android": "...", "ios": "..." }`. |
| `environments[].matchRules` | `string` (Optional) | Custom regex matching pattern (Auto-derived as `.*\.name\..*` if omitted). |
| `extraPaths` | `string[]` | Additional directories outside `App_Resources` to process file swapping. |
| `directCopyRules` | `Record<string, string>` | Direct file copy mappings after standard environment file swap. |
| `appIconPath` | `string` | Icon file path to run `ns resources generate icons`. |

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

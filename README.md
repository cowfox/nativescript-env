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

### 2. Configure `nativescript.config.ts`

Import `getAppId` from `@wuneo/nativescript-env/helper` to dynamically resolve the App ID:

```typescript
import { NativeScriptConfig } from '@nativescript/core';

let getAppId: any;
try {
  getAppId = require('@wuneo/nativescript-env').getAppId;
} catch (_e) {}

export default {
  // Dynamically resolves App ID based on CLI flags (--env.use.release, etc.)
  id: typeof getAppId === 'function' ? getAppId(__dirname, 'com.example.app') : 'com.example.app',
  appResourcesPath: 'App_Resources',
  appPath: 'src',
} as NativeScriptConfig;
```

### 3. Create `environment-rules.json`

Create `environment-rules.json` in your project root directory:

```json
{
  "version": "1.0.0",
  "default": "development",
  "extraPaths": [
    "src/environments"
  ],
  "directCopyRules": {
    "Info.plist": "App_Resources/iOS/Info.plist",
    "GoogleService-Info.plist": "App_Resources/iOS/GoogleService-Info.plist"
  },
  "appIconPath": "environments/app-icon/icon.png",
  "environments": [
    {
      "name": "development",
      "appBundleId": "com.example.app.dev"
    },
    {
      "name": "release",
      "appBundleId": {
        "android": "com.example.app.android",
        "ios": "com.example.app.ios"
      }
    }
  ]
}
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

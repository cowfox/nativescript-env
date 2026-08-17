# @wuneo/nativescript-env

[![NPM version](https://img.shields.io/npm/v/@wuneo/nativescript-env.svg)](https://www.npmjs.com/package/@wuneo/nativescript-env)
[![License](https://img.shields.io/npm/l/@wuneo/nativescript-env.svg)](LICENSE)
[![Downloads](https://img.shields.io/npm/dm/@wuneo/nativescript-env.svg)](https://www.npmjs.com/package/@wuneo/nativescript-env)

The complete environment management plugin for **NativeScript 8+**. Effortlessly switch **App IDs**, **App Icons**, and **Environment-Specific Resources** (such as `GoogleService-Info.plist`, `google-services.json`, or API environment configs) per build command!

---

## 🚀 Why @wuneo/nativescript-env?

- ❌ **Without this plugin**: You have to manually edit `nativescript.config.ts`, rename `GoogleService-Info.plist` / `google-services.json`, or copy icons every time you switch between Dev, Staging, and Production builds.
- ✅ **With this plugin**: Simply pass `--env.use.<name>` in your CLI command (`ns run android --env.use.staging`). Everything—from **App ID** to **native resources** and **icons**—is swapped automatically with zero manual effort!

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

_(No modifications to `nativescript.config.ts` required! The plugin automatically manages App IDs, assets, and resources in the background during build time.)_

---

### ⚙️ Environment Configuration (`environment-rules.yaml` or `.json`)

You can use either **`environment-rules.yaml`** (recommended for adding comments) or `environment-rules.json`:

```yaml
# ==============================================================================
# NativeScript Environment Rules Configuration (@wuneo/nativescript-env)
# ==============================================================================

# App Version & Build Numbers (Supports single value or platform-specific object)
version: '6.10.0'
buildNumber:
  ios: '6'
  android: '6'
versionCode:
  ios: '6100006'
  android: '6100006'
autoVersionCode: true

# Default active environment when no CLI flag (e.g. --env.use.<env>) is specified
default: 'development'

# Extra directories to scan for environment-specific file overrides (e.g. environment.dev.ts -> environment.ts)
extraPaths:
  - 'environments'

# Direct file copy mappings (Source file in env folder -> Destination file in project)
directCopyRules:
  Info.plist: 'App_Resources/iOS/Info.plist'
  GoogleService-Info.plist: 'App_Resources/iOS/GoogleService-Info.plist'
  Podfile: 'App_Resources/iOS/Podfile'

# Master App Icon path (Automatically resizes for iOS & generates Android 8+ Adaptive Icons)
appIconPath: 'environments/app-icon/icon.png'

# Environment Definitions
environments:
  - name: 'development'
    appBundleId: 'com.example.app.dev'

  - name: 'staging'
    appBundleId: 'com.example.app.staging'

  - name: 'release'
    appBundleId:
      android: 'com.example.app.android'
      ios: 'com.example.app.ios'
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

#### Project File Structure Example

```text
my-project/
├── environments/
│   ├── environment.ts            <-- Base file (Imported in your JS/TS code)
│   ├── environment.dev.ts        <-- Active when --env.use.development
│   ├── environment.staging.ts    <-- Active when --env.use.staging
│   └── environment.release.ts    <-- Active when --env.use.release
```

#### How it works

When `extraPaths: ["environments"]` is set and you build with `--env.use.staging`:

1. The plugin finds `environment.staging.ts`.
2. It overwrites `environment.ts` with the contents of `environment.staging.ts`.
3. In `after-prepare`, all `*.staging.ts`, `*.dev.ts`, etc. files are automatically filtered out from the final native build bundle to keep production binaries clean.

---

### 2. `directCopyRules` (Native Resource Overrides for iOS & Android)

Native resources for iOS and Android often require exact filenames placed in specific directories (like `App_Resources/iOS` or `App_Resources/Android`).

#### Project File Structure Example

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

#### Configuration Example in `environment-rules.yaml`

```yaml
directCopyRules:
  # iOS Resources
  Info.plist: 'App_Resources/iOS/Info.plist'
  GoogleService-Info.plist: 'App_Resources/iOS/GoogleService-Info.plist'
  Podfile: 'App_Resources/iOS/Podfile'

  # Android Resources
  google-services.json: 'App_Resources/Android/google-services.json'
```

#### How iOS & Android Resource Management Works

- **iOS (`Info.plist`, `GoogleService-Info.plist`, `Podfile`)**:
  During `before-prepare`, the plugin matches `Info.<env>.plist` inside your `environments/` directory and copies it directly to `App_Resources/iOS/Info.plist`. Xcode / CocoaPods then picks up the updated file during compile time.
- **Android (`google-services.json`)**:
  Android's Google Services Gradle plugin (`com.google.gms.google-services`) requires `google-services.json` to be physically present at `App_Resources/Android/google-services.json`. The plugin copies `google-services.<env>.json` $\rightarrow$ `App_Resources/Android/google-services.json` before Gradle tasks execute, ensuring Firebase & Push Notifications build seamlessly per environment.

---

## 🛠 Features & Capabilities

- 🎯 **Dynamic App Bundle ID**: Set per-environment App IDs directly in `environment-rules.yaml`, with optional platform overrides (`{ "android": "...", "ios": "..." }`).
- 📁 **Smart File Swapping**: Automatically matches files like `environment.staging.ts` $\rightarrow$ `environment.ts` or `GoogleService-Info.dev.plist` $\rightarrow$ `GoogleService-Info.plist` during build.
- 🎨 **App Icon & Splash Generation**: Integrates with NativeScript resource generator to build environment-specific App Icons. Automatically handles Android 8+ Adaptive Icons (`ic_launcher_foreground.png` with transparent background, monochrome layers, and `ic_launcher_background.xml` color extraction) and applies 66.7% Safe Zone padding to Android 12+ Splash logos (`splash_screen_logo.png`).
- 🔢 **Auto Versioning**: Manages `versionName`, `versionCode`, and `buildNumber` across builds with platform isolation (`{ "android": "...", "ios": "..." }`).

---

## 📖 Configuration Reference (`environment-rules.yaml` / `.json`)

| Field                        | Type                     | Description                                                                                             |
| :--------------------------- | :----------------------- | :------------------------------------------------------------------------------------------------------ |
| `version`                    | `string`                 | App SemVer string synced with `package.json`.                                                           |
| `buildNumber`                | `string` \| `object`     | Build number string or `{ "android": "...", "ios": "..." }` for isolated platform tracking.             |
| `versionCode`                | `string` \| `object`     | Version code string or `{ "android": "...", "ios": "..." }`. Auto-generated if `autoVersionCode: true`. |
| `autoVersionCode`            | `boolean`                | Auto-calculates integer version code based on version & buildNumber during release builds.              |
| `default`                    | `string`                 | Default environment name if `--env.use.<name>` is omitted.                                              |
| `environments`               | `Array`                  | Environment definitions (`name`, `appBundleId`, optional `matchRules`).                                 |
| `environments[].appBundleId` | `string` \| `object`     | App Bundle ID string or `{ "android": "...", "ios": "..." }`.                                           |
| `environments[].matchRules`  | `string` (Optional)      | Custom regex matching pattern (Auto-derived as `.*\.name\..*` if omitted).                              |
| `extraPaths`                 | `string[]`               | Additional directories outside `App_Resources` to process suffix file swapping.                         |
| `directCopyRules`            | `Record<string, string>` | Direct file copy mappings after standard environment file swap.                                         |
| `appIconPath`                | `string`                 | Master icon file path to generate platform app icons (iOS & Android Adaptive Icons).                    |

---

## 📦 Legacy Support (NativeScript 6/7)

If you are using NativeScript 7 or older, please install version `0.8.2` of the legacy package:

```bash
npm i nativescript-multiple-environments-building@0.8.2 --save-dev
```

For legacy documentation and usage instructions, please refer to the [v0.8.2 Git Tag Documentation](https://github.com/cowfox/nativescript-multiple-environments-building/tree/v0.8.2#readme).

---

## 🧑‍💻 Development & Testing

This package uses **[pnpm](https://pnpm.io)** + **[Vitest](https://vitest.dev)** + **[Changesets](https://github.com/changesets/changesets)**
for versioning, and publishes to **npmjs.org** via GitHub Actions. A `Makefile` (neo shared
tooling, vendored under `makefiles/`) wraps the common commands.

### Local Commands

```bash
pnpm install          # or: make install
make build            # compile src/ -> lib/ (tsc)
make type             # tsc --noEmit
make test             # run unit tests (vitest)
make cover            # run unit tests with coverage report
make qa               # type + test
make ci               # type + test + build
make exports          # validate published exports (publint)
make help             # list all commands
```

### Branch model

| Branch      | Purpose               | Publishes                          |
| ----------- | --------------------- | ---------------------------------- |
| `master`    | production line       | CI only (no publish)               |
| `develop`   | integration           | `dev` pre-releases                 |
| `release/*` | release stabilization | `alpha` → `beta` → `rc` → `latest` |
| `feature/*` | working branches      | —                                  |

### Cutting a release

```bash
# 1. From develop — create a release branch (patch by default; minor / major)
make cut minor                 # -> release/1.1.0

# 2. On the release branch — enter pre-release mode
make pre alpha

# 3. Generate a changeset from your commits, then commit it
make changeset auto
git commit -m "🐳 chore(changeset): Add new changeset"

# 4. Bump the version + push → CI publishes the alpha to npm
make release push              # 1.1.0-alpha.0  (dist-tag: alpha)

# 5. Iterate (beta / rc) as needed, then ship the final release
make pre exit
make release push              # 1.1.0          (bumps version & commits)
make tag push                  # v1.1.0         (triggers CI npm release)
```

`changeset publish` (run in CI on push to `release/**` / `develop` when `package.json`
changes) auto-selects the npm dist-tag from `.changeset/pre.json`, and is idempotent —
an already-published version is skipped.

### CI secret

Add a repository secret **`NPM_TOKEN`** — an npm **automation** token with publish rights
on the `@wuneo` scope. The release workflow uses it as `NODE_AUTH_TOKEN`.

---

## 📄 License

Apache-2.0 © [cowfox](https://github.com/cowfox)

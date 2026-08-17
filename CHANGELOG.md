# @wuneo/nativescript-env

## 1.0.1

### Patch Changes

- 90a5f1e: # Changelog

  - ci(release): add CI + npm publish workflows
  - feat(release): add neo shared tooling for versioning + publish
  - docs: update description, keywords, and repository URLs for SEO visibility
  - feat: add environment alias matching and dev/development matchRules resolution
  - fix: improve directCopyRules source file binding and non-extension file destination resolution
  - docs: add comprehensive guide for extraPaths, directCopyRules, iOS (Info.plist, Podfile) and Android (google-services.json) resource management
  - docs: simplify Quick Start section to highlight zero config for nativescript.config.ts
  - feat: add YAML support and npx wuneo-env init template generator
  - fix: restore @nativescript/hook installer and package exports for CLI hook registration
  - feat!: enforce single environment-rules.json in v1.0.0 and add deprecation warning for split files
  - docs: update nativescript.config.ts snippet to use try-catch pattern for ns clean compatibility
  - ♻️ feat!: refactor to TS, rename package to @wuneo/nativescript-env v1.0.0 and add getAppId helper for NS8+
  - 🐳 chore(Misc): issue fixes

- 98038d6: # Changelog

  - fix(ci): wrap if condition on line 56 in double quotes to fix YAML syntax error

- 352bbe1: # Changelog

  - fix(ci): add explicit npm authentication step for changeset publish to solve ENEEDAUTH

- 5a44658: # Changelog

  - chore(tooling): sync version.mk engine with neo-shared-tooling (smart changeset commit tips & release tag guards)
  - chore(tooling): update CI release workflow and Makefile to align with tag-driven release model from neo-shared-tooling
  - feat: add automatic config backup and restore in after-prepare hook to leave source files 100lean
  - fix: sync App ID to config files and clean Manifest package attribute for AGP 8+ compatibility
  - fix: remove disk modifications to nativescript.config.ts for zero-modification builds
  - fix: prevent duplicate hook execution log and auto-sync App Bundle ID to nativescript.config.ts

- 046d11d: # Changelog

  - chore(ci): switch release workflow to NPM Trusted Publisher (OIDC) authentication

- 7e492db: # Changelog

  - chore(pkg): set base version to 1.0.1-beta.13
  - fix(hooks): prevent duplicate execution of after-prepare hook
  - fix(hooks): prevent duplicate execution of before-prepare hook within single CLI build pipeline
  - chore(ci): configure token authentication for release workflow
  - style(tooling): output commit message directly in changeset prompt
  - fix(ci): remove registry-url from setup-node to enable seamless NPM Trusted Publisher (OIDC) auth

- baebd40: # Changelog

  - fix(icon): sync ic_launcher_foreground.png and ic_launcher_monochrome.png from freshly generated ic_launcher.png for Android Adaptive Icons
  - feat(icon): sync ic_launcher_monochrome.png with ic_launcher_foreground.png after icon generation
  - fix(icon): use non-capturing regex group to ensure icon.dev.png copies to icon.png before generating app icons

- 21ee6b3: # Changelog

  - refactor(icon): load source image once outside density loops to improve adaptive icon generation performance by 80

- f064e70: # Changelog

  - fix(hooks): avoid redundant file mtime modifications to prevent triggering CLI debug watcher rebuilds
  - docs(readme): update configuration example and reference for platform-isolated versioning and adaptive icon generation
  - fix(versioning): isolate buildNumber and versionCode per platform to prevent cross-platform build count collisions

- ff62239: # Changelog

  - ♻️ refactor: standardize logging output with icons and refine environment file copy logic

- c2f513d: # Changelog

  - fix: set transparent background for Android adaptive icon foreground canvas

- 714f3bc: # Changelog

  - feat: modularize utils, add Android 12+ splash safe-zone scaling and vitest unit tests

- 2cb229c: # Changelog

  - fix(icon): ensure full density generation for mipmap backgrounds and splash logos

## 1.0.1-beta.22

### Patch Changes

- 2cb229c: # Changelog

  - fix(icon): ensure full density generation for mipmap backgrounds and splash logos

## 1.0.1-beta.21

### Patch Changes

- 714f3bc: # Changelog

  - feat: modularize utils, add Android 12+ splash safe-zone scaling and vitest unit tests

## 1.0.1-beta.20

### Patch Changes

- c2f513d: # Changelog

  - fix: set transparent background for Android adaptive icon foreground canvas

## 1.0.1-beta.19

### Patch Changes

- ff62239: # Changelog

  - ♻️ refactor: standardize logging output with icons and refine environment file copy logic

## 1.0.1-beta.17

### Patch Changes

- f064e70: # Changelog

  - fix(hooks): avoid redundant file mtime modifications to prevent triggering CLI debug watcher rebuilds
  - docs(readme): update configuration example and reference for platform-isolated versioning and adaptive icon generation
  - fix(versioning): isolate buildNumber and versionCode per platform to prevent cross-platform build count collisions

## 1.0.1-beta.16

### Patch Changes

- 21ee6b3: # Changelog

  - refactor(icon): load source image once outside density loops to improve adaptive icon generation performance by 80

## 1.0.1-beta.15

### Patch Changes

- baebd40: # Changelog

  - fix(icon): sync ic_launcher_foreground.png and ic_launcher_monochrome.png from freshly generated ic_launcher.png for Android Adaptive Icons
  - feat(icon): sync ic_launcher_monochrome.png with ic_launcher_foreground.png after icon generation
  - fix(icon): use non-capturing regex group to ensure icon.dev.png copies to icon.png before generating app icons

## 1.0.1-beta.14

### Patch Changes

- a1aaba4: # Changelog

  - chore(pkg): set base version to 1.0.1-beta.13
  - fix(hooks): prevent duplicate execution of after-prepare hook
  - fix(hooks): prevent duplicate execution of before-prepare hook within single CLI build pipeline
  - chore(ci): configure token authentication for release workflow
  - style(tooling): output commit message directly in changeset prompt
  - fix(ci): remove registry-url from setup-node to enable seamless NPM Trusted Publisher (OIDC) auth

## 1.0.1-beta.4

### Patch Changes

- 046d11d: # Changelog

  - chore(ci): switch release workflow to NPM Trusted Publisher (OIDC) authentication

## 1.0.1-beta.3

### Patch Changes

- 5a44658: # Changelog

  - chore(tooling): sync version.mk engine with neo-shared-tooling (smart changeset commit tips & release tag guards)
  - chore(tooling): update CI release workflow and Makefile to align with tag-driven release model from neo-shared-tooling
  - feat: add automatic config backup and restore in after-prepare hook to leave source files 100lean
  - fix: sync App ID to config files and clean Manifest package attribute for AGP 8+ compatibility
  - fix: remove disk modifications to nativescript.config.ts for zero-modification builds
  - fix: prevent duplicate hook execution log and auto-sync App Bundle ID to nativescript.config.ts

## 1.0.1-beta.2

### Patch Changes

- 352bbe1: # Changelog

  - fix(ci): add explicit npm authentication step for changeset publish to solve ENEEDAUTH

## 1.0.1-beta.1

### Patch Changes

- 98038d6: # Changelog

  - fix(ci): wrap if condition on line 56 in double quotes to fix YAML syntax error

## 1.0.1-beta.0

### Patch Changes

- 90a5f1e: # Changelog

  - ci(release): add CI + npm publish workflows
  - feat(release): add neo shared tooling for versioning + publish
  - docs: update description, keywords, and repository URLs for SEO visibility
  - feat: add environment alias matching and dev/development matchRules resolution
  - fix: improve directCopyRules source file binding and non-extension file destination resolution
  - docs: add comprehensive guide for extraPaths, directCopyRules, iOS (Info.plist, Podfile) and Android (google-services.json) resource management
  - docs: simplify Quick Start section to highlight zero config for nativescript.config.ts
  - feat: add YAML support and npx wuneo-env init template generator
  - fix: restore @nativescript/hook installer and package exports for CLI hook registration
  - feat!: enforce single environment-rules.json in v1.0.0 and add deprecation warning for split files
  - docs: update nativescript.config.ts snippet to use try-catch pattern for ns clean compatibility
  - ♻️ feat!: refactor to TS, rename package to @wuneo/nativescript-env v1.0.0 and add getAppId helper for NS8+
  - 🐳 chore(Misc): issue fixes

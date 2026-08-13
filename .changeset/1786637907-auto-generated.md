---
'@wuneo/nativescript-env': patch
---

# Changelog

- fix(hooks): avoid redundant file mtime modifications to prevent triggering CLI debug watcher rebuilds
- docs(readme): update configuration example and reference for platform-isolated versioning and adaptive icon generation
- fix(versioning): isolate buildNumber and versionCode per platform to prevent cross-platform build count collisions

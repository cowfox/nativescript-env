---
'@wuneo/nativescript-env': patch
---

# Changelog

- chore(tooling): sync version.mk engine with neo-shared-tooling (smart changeset commit tips & release tag guards)
- chore(tooling): update CI release workflow and Makefile to align with tag-driven release model from neo-shared-tooling
- feat: add automatic config backup and restore in after-prepare hook to leave source files 100lean
- fix: sync App ID to config files and clean Manifest package attribute for AGP 8+ compatibility
- fix: remove disk modifications to nativescript.config.ts for zero-modification builds
- fix: prevent duplicate hook execution log and auto-sync App Bundle ID to nativescript.config.ts

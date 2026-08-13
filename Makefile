# ==============================================================================
# @wuneo/nativescript-env — Makefile
# ==============================================================================
# Neo shared tooling (versioning + release management), vendored from
# neo-shared-tooling. 本仓库为 public,无法 subtree 私有 tooling repo —— 有用的
# 片段直接拷贝进 makefiles/。更新引擎时从 neo-shared-tooling 手动重新拷贝。
#
# Usage: make <command> [subcommand]
#   make help               Show all available commands
#   make install            Install dependencies (pnpm)
#   make build              Compile TypeScript (src -> lib)
#   make qa                 type + test
#   make ci                 type + test + build
#   make cut [minor|major]  Create a release branch from develop
#   make pre alpha          Enter alpha pre-release mode (release/* only)
#   make changeset auto     Auto-generate a changeset from commits
#   make release push       Bump pre-release version, commit + push → CI publishes
# ==============================================================================

# Capture subcommand (second argument), absorb as no-op target
SUBCMD := $(word 2,$(MAKECMDGOALS))
%:
	@:

-include .env.local

# ── neo shared tooling (vendored) ─────────────────────────────────────────────
include makefiles/install.mk
include makefiles/quality.mk
include makefiles/version.mk
include makefiles/utils.mk

# ── 项目特有 targets (可选) ───────────────────────────────────────────────────
-include makefiles/extras.mk

.DEFAULT_GOAL := help

# ==============================================================================
# Help
# ==============================================================================

.PHONY: help
help: ## Show this help message
	@echo ""
	@echo "@wuneo/nativescript-env — make commands"
	@echo "======================================="
	@echo ""
	@echo "📦 安装:   make install [lock]"
	@echo "🔍 质量:   make type / test [coverage|watch] / exports / build"
	@echo "           make qa (type+test) / ci (type+test+build)"
	@echo "🏷️  版本:  make cut [minor|major] / changeset [auto|status]"
	@echo "           make pre <dev|alpha|beta|rc|exit> / version [apply]"
	@echo "           make release [push] / tag [push]"
	@echo "🔧 工具:   make clean [all]"
	@echo ""
	@echo "发布流程 (publish to npmjs.org):"
	@echo "  1. develop:   make cut [minor|major]      → 创建 release/<ver> 分支"
	@echo "  2. release/*: make pre alpha              → 进入预发布模式"
	@echo "  3.            make changeset auto && git commit"
	@echo "  4.            make release push           → 推送 → CI 发布 alpha 到 npm"
	@echo "  5. 最终版:    make pre exit && make release push  → 发布 latest 到 npm"
	@echo ""

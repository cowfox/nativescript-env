# ==============================================================================
# makefiles/utils.mk — 工具命令 (单包)
# ==============================================================================
# Vendored & adapted from neo-shared-tooling (makefile-scenarios/ts-lib/utils.mk).
# 注:本仓库为 public,tooling 以拷贝方式 vendored(非 subtree),故没有
# `sync-tooling` target。如需更新引擎,从 neo-shared-tooling 手动重新拷贝对应片段。
# ==============================================================================

.PHONY: clean
clean: ## Clean build artifacts (subcommands: all)
ifeq ($(SUBCMD),all)
	@echo "🧹 Deep cleaning..."
	rm -rf lib node_modules
else
	@echo "🧹 Cleaning build artifacts..."
	rm -rf lib
endif

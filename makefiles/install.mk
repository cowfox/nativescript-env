# ==============================================================================
# makefiles/install.mk — 依赖安装 (pnpm)
# ==============================================================================
# Vendored from neo-shared-tooling (makefile-engines/node/install.mk).
# 本仓库为 public,无法 subtree 私有 tooling repo,故直接拷贝有用片段。
# ==============================================================================

.PHONY: install
install: ## Install dependencies (subcommands: lock)
ifeq ($(SUBCMD),lock)
	@echo "📦 Installing dependencies (updating lockfile)..."
	pnpm install
else
	@echo "📦 Installing dependencies..."
	pnpm install --frozen-lockfile
endif

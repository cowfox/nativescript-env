# ==============================================================================
# makefiles/quality.mk — 代码质量 (tsc + exports, 单包)
# ==============================================================================
# Vendored & adapted from neo-shared-tooling (makefile-scenarios/ts-lib/quality.mk).
# 本项目目前无 Biome / Vitest,故裁掉 lint/format,保留对已发布 npm 包真正有用的
# type check / build / exports 校验。将来接入 linter/测试框架时,补回对应 target 即可。
#
# 前置:package.json 需声明 scripts — check:types / check:exports / test /
#       test:coverage / test:watch / build
# ==============================================================================

.PHONY: type
type: ## TypeScript type checking (tsc --noEmit)
	@echo "🏷️  Type checking..."
	pnpm check:types

.PHONY: test
test: ## Run tests (subcommands: coverage, watch)
ifeq ($(SUBCMD),coverage)
	@echo "🧪 Running tests with coverage..."
	pnpm test:coverage
else ifeq ($(SUBCMD),watch)
	@echo "🧪 Running tests in watch mode..."
	pnpm test:watch
else
	@echo "🧪 Running unit tests..."
	pnpm test
endif

.PHONY: cover
cover: ## Run tests with coverage (alias for make test coverage)
	@echo "🧪 Running tests with coverage..."
	pnpm test:coverage

exports: ## Validate published package (publint)
	@echo "🔗 Validating package exports..."
	pnpm check:exports

.PHONY: build
build: ## Build the library (tsc -> lib/)
	@echo "🏗️  Building..."
	pnpm build

.PHONY: qa
qa: type test ## Run typecheck + test
	@echo "✅ QA passed"

.PHONY: ci
ci: type test build ## Full CI: qa + build
	@echo "✅ CI passed"

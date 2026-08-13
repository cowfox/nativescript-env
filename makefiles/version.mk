# ==============================================================================
# makefiles/version.mk — 版本管理引擎 (Changesets)
# ==============================================================================
# Vendored & adapted from neo-shared-tooling (makefile-engines/node/version.mk).
# 本仓库为 public, 无法 subtree 私有 tooling repo, 故直接拷贝该引擎。
#
# 单包库: MONOREPO / SCOPED_RELEASE 保持默认 0 (读根 package.json, release/<ver>)。
# RELEASE_VIA_TAG=1 (ts-lib): 发布只由 git tag 触发 (make tag push)。
#
# Pre-release 阶梯: dev → alpha → beta → rc → stable (只能顺着往前, 不能倒退)
#   develop   → make pre dev          release/*  → make pre alpha / beta / rc
#
# 命令:
#   make cut [minor|major]   → 从 develop 创建 release 分支
#   make changeset [auto]    → 创建/自动生成 changeset
#   make pre <tag>           → 进入/切换预发布阶段
#   make release [push]      → 在当前 tag 下 bump + commit [+ push 分支]
#   make tag [push]          → 给 release commit 打 v<version> tag [+ push] 触发 CI 发布
# ==============================================================================

MONOREPO        ?= 0
SCOPED_RELEASE  ?= 0
APP             ?= web
# 1 → 发布由 tag 触发 (ts-lib); 0 → 分支触发 (web-monorepo / mobile-expo)
RELEASE_VIA_TAG ?= 1

# --- APP 自动推断: SCOPED_RELEASE=1 时从 release/<app>/<ver> 分支取 app ------------
ifeq ($(SCOPED_RELEASE),1)
  _BRANCH_APP := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null | sed -n 's,^release/\([^/]*\)/.*,\1,p')
  ifneq ($(origin APP),command line)
    ifneq ($(_BRANCH_APP),)
      APP := $(_BRANCH_APP)
    endif
  endif
endif

# --- 包路径解析 (单包 vs monorepo) -----------------------------------------------
ifeq ($(MONOREPO),1)
  PKG_JSON := apps/$(APP)/package.json
else
  PKG_JSON := package.json
endif

# --- release 分支前缀 (scoped 时加 <app>/) --------------------------------------
ifeq ($(SCOPED_RELEASE),1)
  RELEASE_PREFIX := release/$(APP)/
else
  RELEASE_PREFIX := release/
endif

# --- 发布 tag 名前缀: 单包 v<ver>; scoped monorepo <app>-v<ver> ------------------
ifeq ($(SCOPED_RELEASE),1)
  TAG_NAME_PREFIX := $(APP)-v
else
  TAG_NAME_PREFIX := v
endif

GET_PKG_NAME = node -p "require('./$(PKG_JSON)').name"
GET_VERSION  = node -p "require('./$(PKG_JSON)').version"
GET_BRANCH   = git rev-parse --abbrev-ref HEAD
IS_RELEASE_BRANCH = $$(echo "$$($(GET_BRANCH))" | grep -q "^release/" && echo "yes" || echo "no")
LOAD_ENV = if [ -f "$(dir $(PKG_JSON)).env" ]; then set -a; . "$(dir $(PKG_JSON)).env"; set +a; fi; \
	if [ -n "$$GITHUB_PAT" ]; then export GITHUB_TOKEN="$$GITHUB_PAT"; fi

.PHONY: status alpha beta rc exit current apply auto major minor patch push
status alpha beta rc exit current apply auto major minor patch push:
	@:

# JS: 发现 pkg-name → package.json 路径。monorepo 扫 apps/*+packages/*,
# 单包回落到根 package.json。pre-reset 用它把各包版本还原到 initialVersions。
define PKG_MAP_JS
	const fs = require('fs'), path = require('path');
	function scan(dir) {
		if (!fs.existsSync(dir)) return {};
		const r = {};
		for (const e of fs.readdirSync(dir)) {
			const pj = path.join(dir, e, 'package.json');
			if (fs.existsSync(pj)) { try { const d = JSON.parse(fs.readFileSync(pj, 'utf8')); if (d.name) r[d.name] = pj; } catch(e) {} }
		}
		return r;
	}
	const map = { ...scan('apps'), ...scan('packages') };
	try { const root = JSON.parse(fs.readFileSync('package.json', 'utf8')); if (root.name && !map[root.name]) map[root.name] = 'package.json'; } catch(e) {}
	return map;
endef
export PKG_MAP_JS

# -----------------------------------------------------------------------------
# Cut — 从 develop 创建 release 分支
# -----------------------------------------------------------------------------

.PHONY: cut
cut: ## Create a release branch from develop (subcommands: patch, minor, major)
	@BRANCH=$$($(GET_BRANCH)); \
	if [ "$$BRANCH" != "develop" ]; then \
		echo "❌ cut 仅限 develop 分支  当前分支: $$BRANCH"; \
		exit 1; \
	fi; \
	if [ -n "$$(git status --porcelain)" ]; then \
		echo "❌ 工作区有未提交的更改, 请先提交"; \
		exit 1; \
	fi; \
	BUMP="$(or $(SUBCMD),patch)"; \
	if [ "$$BUMP" != "patch" ] && [ "$$BUMP" != "minor" ] && [ "$$BUMP" != "major" ]; then \
		echo "❌ 未知的版本级别: $$BUMP  可用: patch (默认) | minor | major"; \
		exit 1; \
	fi; \
	TARGET=$$(node -e " \
		const [M, m, p] = require('./$(PKG_JSON)').version.split('-')[0].split('.').map(Number); \
		if ('$$BUMP' === 'major') console.log((M+1)+'.0.0'); \
		else if ('$$BUMP' === 'minor') console.log(M+'.'+(m+1)+'.0'); \
		else console.log(M+'.'+m+'.'+(p+1)); \
	"); \
	RELEASE_BRANCH="$(RELEASE_PREFIX)$$TARGET"; \
	echo "📦 版本级别: $$BUMP (APP=$(APP))"; \
	echo "🔀 创建分支: $$RELEASE_BRANCH"; \
	git checkout -b "$$RELEASE_BRANCH"; \
	echo "✅ 已切换到 $$RELEASE_BRANCH"; \
	if [ "$(RELEASE_VIA_TAG)" = "1" ]; then echo "💡 下一步: make pre alpha → make changeset auto → make release push → make tag push"; else echo "💡 下一步: make pre alpha → make changeset auto → make release push"; fi

# -----------------------------------------------------------------------------
# Changeset — 创建变更描述
# -----------------------------------------------------------------------------

.PHONY: changeset
changeset: ## Create a changeset (subcommands: auto, status)
ifeq ($(SUBCMD),status)
	@echo "📋 Pending changesets:"
	pnpm changeset status
else ifeq ($(SUBCMD),auto)
	@BRANCH=$$($(GET_BRANCH)); \
	if [ "$$BRANCH" = "master" ]; then \
		echo "❌ 不能在 master 分支上创建 changeset"; \
		exit 1; \
	fi; \
	echo "🔍 从 commit 历史生成 changeset (APP=$(APP))..."; \
	echo ""; \
	LAST_CHANGESET_COMMIT=$$(git log -1 --format="%H" -- ".changeset/*.md" ":!.changeset/README.md" 2>/dev/null | head -1); \
	if [ -n "$$LAST_CHANGESET_COMMIT" ]; then \
		BASE_REF="$$LAST_CHANGESET_COMMIT"; \
		echo "📌 起点: 上一次 changeset 提交 ($$(git log -1 --format='%h %s' $$BASE_REF))"; \
	else \
		BASE_REF=$$(git merge-base HEAD master 2>/dev/null || git merge-base HEAD develop 2>/dev/null || git rev-list --max-parents=0 HEAD); \
		echo "📌 起点: 分支分叉点 ($$(git log -1 --format='%h %s' $$BASE_REF))"; \
	fi; \
	echo ""; \
	IS_RELEASE=$(IS_RELEASE_BRANCH); \
	COMMITS=$$(git log --oneline --no-merges --invert-grep --grep="chore(release):" "$$BASE_REF..HEAD" 2>/dev/null); \
	if [ -n "$$COMMITS" ]; then \
		echo "📝 找到以下 commit:"; echo "$$COMMITS"; echo ""; \
	else \
		echo "⚠️  没有找到新的 commit (自上次 changeset 以来)"; echo ""; \
	fi; \
	if [ "$$IS_RELEASE" = "yes" ]; then \
		BUMP="patch"; echo "📌 release/* 分支: 版本级别固定为 patch"; \
	elif [ -z "$$COMMITS" ]; then \
		BUMP="patch"; \
	else \
		HAS_BREAKING=$$(echo "$$COMMITS" | grep -i "breaking\|!" || true); \
		HAS_FEAT=$$(echo "$$COMMITS" | grep -iE "^[a-f0-9]+ ✨|^[a-f0-9]+ feat" || true); \
		if [ -n "$$HAS_BREAKING" ]; then BUMP="major"; \
		elif [ -n "$$HAS_FEAT" ]; then BUMP="minor"; \
		else BUMP="patch"; fi; \
	fi; \
	echo "📦 版本级别: $$BUMP"; echo ""; \
	NOTES=$$(git log --format="- %s" --no-merges --invert-grep --grep="chore(release):" "$$BASE_REF..HEAD" 2>/dev/null); \
	PKG_NAME=$$($(GET_PKG_NAME)); \
	FILENAME=".changeset/$$(date +%s)-auto-generated.md"; \
	printf -- "---\n'$$PKG_NAME': $$BUMP\n---\n\n# Changelog\n\n$$NOTES\n" > "$$FILENAME"; \
	echo "✅ 已生成: $$FILENAME"; echo ""; \
	cat "$$FILENAME"; echo ""; \
	if [ -n "$$COMMITS" ]; then git add .changeset/; echo "✅ 已暂存 changeset"; fi; echo ""; echo "💡 建议 commit message:"; echo "   🐳 chore(changeset): Add new changeset"
else
	@BRANCH=$$($(GET_BRANCH)); \
	if [ "$$BRANCH" = "master" ]; then \
		echo "❌ 不能在 master 分支上创建 changeset"; \
		exit 1; \
	fi
	pnpm changeset
	@echo ""
	@echo "💡 建议 commit message:"
	@echo "   🐳 chore(changeset): Add new changeset"
endif

# -----------------------------------------------------------------------------
# Pre-release — 管理预发布模式 (pkg-path 动态发现, 单包/monorepo 通用)
# -----------------------------------------------------------------------------

.PHONY: pre
pre: ## Manage pre-release mode (subcommands: dev, alpha, beta, rc, exit)
	@BRANCH=$$($(GET_BRANCH)); \
	IS_RELEASE=$(IS_RELEASE_BRANCH); \
	if [ -z "$(SUBCMD)" ]; then \
		echo "用法: make pre [dev|alpha|beta|rc|exit]"; \
		exit 1; \
	fi; \
	if [ "$(SUBCMD)" = "exit" ]; then \
		echo "🔓 退出预发布模式..."; \
		pnpm changeset pre exit; \
		echo "✅ 已退出预发布模式"; \
	elif [ "$(SUBCMD)" = "dev" ]; then \
		if [ "$$BRANCH" != "develop" ]; then \
			echo "❌ dev 预发布模式仅限 develop 分支  当前分支: $$BRANCH"; \
			exit 1; \
		fi; \
		echo "🔒 进入 dev 预发布模式..."; \
		if [ -f ".changeset/pre.json" ]; then $(MAKE) --no-print-directory _pre-reset TAG=dev; \
		else pnpm changeset pre enter dev; fi; \
		echo "✅ 已进入 dev 模式"; \
	elif [ "$(SUBCMD)" = "alpha" ] || [ "$(SUBCMD)" = "beta" ] || [ "$(SUBCMD)" = "rc" ]; then \
		if [ "$$IS_RELEASE" != "yes" ]; then \
			echo "❌ $(SUBCMD) 预发布模式仅限 release/* 分支  当前分支: $$BRANCH"; \
			exit 1; \
		fi; \
		if [ -f ".changeset/pre.json" ]; then \
			CURRENT_TAG=$$(node -p "(() => { try { return JSON.parse(require('fs').readFileSync('.changeset/pre.json','utf8')).tag; } catch(e) { return ''; } })()"); \
			rank() { case "$$1" in alpha) echo 1;; beta) echo 2;; rc) echo 3;; *) echo 0;; esac; }; \
			CUR_RANK=$$(rank "$$CURRENT_TAG"); NEW_RANK=$$(rank "$(SUBCMD)"); \
			if [ -n "$$CURRENT_TAG" ] && [ "$$CURRENT_TAG" != "dev" ] && [ "$$NEW_RANK" -lt "$$CUR_RANK" ]; then \
				echo "❌ 错误: 不能从 $$CURRENT_TAG 阶段倒退到 $(SUBCMD)  只能 alpha → beta → rc 往前走"; \
				exit 1; \
			fi; \
		fi; \
		echo "🔒 进入 $(SUBCMD) 预发布模式..."; \
		if [ -f ".changeset/pre.json" ]; then $(MAKE) --no-print-directory _pre-reset TAG=$(SUBCMD); \
		else pnpm changeset pre enter $(SUBCMD); fi; \
		echo "✅ 已进入 $(SUBCMD) 模式"; \
	else \
		echo "❌ 未知的预发布类型: $(SUBCMD)  可用: dev | alpha | beta | rc | exit"; \
		exit 1; \
	fi

# 内部: 已在 pre 模式时, 切换 tag + 清空 counter + 把各包版本还原到 initialVersions
.PHONY: _pre-reset
_pre-reset:
	@node -e " \
		const fs = require('fs'); \
		const map = (() => { $$PKG_MAP_JS })(); \
		const p = JSON.parse(fs.readFileSync('.changeset/pre.json', 'utf8')); \
		p.mode = 'pre'; p.tag = '$(TAG)'; p.changesets = []; \
		fs.writeFileSync('.changeset/pre.json', JSON.stringify(p, null, 2) + '\n'); \
		for (const [pkg, ver] of Object.entries(p.initialVersions)) { \
			const pjPath = map[pkg]; \
			if (!pjPath) { console.log('skip (not found):', pkg); continue; } \
			try { const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8')); pj.version = ver; fs.writeFileSync(pjPath, JSON.stringify(pj, null, 2) + '\n'); console.log('reset', pkg, '->', ver); } catch(e) {} \
		} \
	"

# -----------------------------------------------------------------------------
# Version — 查看或应用版本
# -----------------------------------------------------------------------------

.PHONY: version
version: ## Show current version, or apply pending changesets (subcommand: apply)
ifeq ($(SUBCMD),apply)
	@echo "📦 Applying pending changesets..."
	@$(LOAD_ENV); pnpm changeset version
	@echo "✅ 新版本: $$($(GET_VERSION))"
else
	@echo "📋 当前版本 ($(APP)): $$($(GET_VERSION))"
endif

# -----------------------------------------------------------------------------
# Release — Pre-release 一键发布 (bump + commit [+ push])
# -----------------------------------------------------------------------------

.PHONY: release
release: ## Bump pre-release version and commit (subcommand: push → also push)
	@BRANCH=$$($(GET_BRANCH)); \
	IS_RELEASE=$(IS_RELEASE_BRANCH); \
	if [ "$$BRANCH" = "master" ]; then \
		echo "❌ master 分支请使用标准流程 (PR → Version PR → CI 自动发布/部署)"; \
		exit 1; \
	fi; \
	if [ "$$IS_RELEASE" != "yes" ] && [ "$$BRANCH" != "develop" ]; then \
		echo "❌ release 仅限 release/* 或 develop 分支  当前分支: $$BRANCH"; \
		exit 1; \
	fi; \
	if [ ! -f ".changeset/pre.json" ]; then \
		echo "❌ 未进入 pre-release 模式  请先执行: make pre alpha (或 dev/beta/rc)"; \
		exit 1; \
	fi; \
	PENDING_CHANGESETS=$$(find .changeset -maxdepth 1 -name "*.md" ! -name "README.md" 2>/dev/null); \
	if [ -z "$$PENDING_CHANGESETS" ]; then \
		echo "⚠️  没有找到待处理的 changeset  请先运行: make changeset auto"; \
		exit 1; \
	fi; \
	echo "🚀 Pushing commits to remote (for changelog generation)..."; \
	git push -u origin "$$BRANCH"; \
	echo ""; \
	echo "📦 Applying pending changesets..."; \
	$(LOAD_ENV); pnpm changeset version; \
	VERSION=$$($(GET_VERSION)); \
	PKG_NAME=$$($(GET_PKG_NAME)); \
	echo "📋 版本 ($(APP)): $$VERSION"; \
	if ! echo "$$VERSION" | grep -q "-"; then \
		echo "❌ 版本号不是 pre-release 格式: $$VERSION"; \
		exit 1; \
	fi; \
	echo "📝 Committing version bump..."; \
	git add -A; \
	if [ "$(SCOPED_RELEASE)" = "1" ]; then \
		git commit --no-verify -m "🐳 chore(release): Bump \`$$PKG_NAME\` to \`$$VERSION\`"; \
	else \
		git commit --no-verify -m "🐳 chore(release): Bump version to \`$$VERSION\`"; \
	fi; \
	if [ "$(SUBCMD)" = "push" ]; then \
		echo "🚀 Pushing branch to remote..."; \
		git push -u origin "$$BRANCH"; \
		if [ "$(RELEASE_VIA_TAG)" = "1" ]; then \
			echo "✅ 已推送 $$VERSION 到 $$BRANCH (分支 push 不触发发布)"; \
			echo "💡 发布这一版: make tag push  (打 $(TAG_NAME_PREFIX)$$VERSION 并 push → 触发 CI 发布)"; \
		else \
			echo "✅ 已推送 $$VERSION → CI/Vercel 将自动构建/部署"; \
		fi; \
	else \
		echo "✅ 本地 commit 完成: $$VERSION"; \
		if [ "$(RELEASE_VIA_TAG)" = "1" ]; then \
			echo "💡 下一步: make release push  然后  make tag push  (tag 触发发布)"; \
		else \
			echo "💡 推送: make release push"; \
		fi; \
	fi

# -----------------------------------------------------------------------------
# Tag — 给 release commit 打 v<version> tag
# -----------------------------------------------------------------------------

.PHONY: tag
tag: ## Tag the release commit → v<version> [push] (RELEASE_VIA_TAG=1: push triggers CI publish)
ifeq ($(RELEASE_VIA_TAG),1)
	@BRANCH=$$($(GET_BRANCH)); \
	IS_RELEASE=$(IS_RELEASE_BRANCH); \
	VERSION=$$($(GET_VERSION)); \
	TAG_NAME="$(TAG_NAME_PREFIX)$$VERSION"; \
	HEAD_MSG=$$(git log -1 --format=%s HEAD); \
	if ! echo "$$HEAD_MSG" | grep -q "chore(release): Bump"; then \
		echo "❌ make tag 只能在 release commit 上打 tag。"; \
		echo "   当前 HEAD: $$HEAD_MSG"; \
		echo "   请先 make release 生成版本 bump commit, 再 make tag。"; \
		exit 1; \
	fi; \
	if ! echo "$$HEAD_MSG" | grep -qF "$$VERSION"; then \
		echo "❌ package.json 版本 ($$VERSION) 与 HEAD release commit 不一致:"; \
		echo "   $$HEAD_MSG"; \
		echo "   请确认 HEAD 是最近一次 make release 的 commit。"; \
		exit 1; \
	fi; \
	if [ "$$BRANCH" = "master" ]; then \
		echo "❌ master 分支不打发布 tag (发布走 develop / release/*)。"; exit 1; \
	elif [ "$$BRANCH" = "develop" ]; then \
		if ! echo "$$VERSION" | grep -q -- "-dev\."; then \
			echo "❌ develop 只能 tag dev 预发布 (如 $(TAG_NAME_PREFIX)1.2.0-dev.0)  当前: $$VERSION"; \
			echo "   💡 先 make pre dev"; exit 1; \
		fi; \
	elif [ "$$IS_RELEASE" = "yes" ]; then \
		if echo "$$VERSION" | grep -q -- "-dev\."; then \
			echo "❌ release/* 不能 tag dev 版本  当前: $$VERSION"; exit 1; \
		fi; \
	else \
		echo "❌ 当前分支不允许打发布 tag: $$BRANCH"; exit 1; \
	fi; \
	if git rev-parse -q --verify "refs/tags/$$TAG_NAME" >/dev/null 2>&1; then \
		echo "❌ tag 已存在: $$TAG_NAME (同一版本请勿重复 tag)。"; exit 1; \
	fi; \
	echo "🏷️  创建 tag: $$TAG_NAME  ($$BRANCH)"; \
	git tag -a "$$TAG_NAME" -m "Release $$TAG_NAME"; \
	echo "✅ Tag $$TAG_NAME 已创建"; \
	if [ "$(SUBCMD)" = "push" ]; then \
		echo "📤 推送 tag 到远程 (触发 CI 发布)..."; \
		git push origin "$$TAG_NAME"; \
		echo "✅ 已推送 $$TAG_NAME → CI 将构建并发布"; \
	else \
		echo "💡 推送 tag: git push origin $$TAG_NAME  或: make tag push"; \
	fi
else
	@echo "🏷️  创建 tag (pnpm changeset tag)..."; \
	pnpm changeset tag; \
	if [ "$(SUBCMD)" = "push" ]; then \
		echo "📤 推送 tag 到远程..."; git push --tags; echo "✅ Tag 已推送到 origin"; \
	else \
		echo "💡 推送 tag: git push --tags  或: make tag push"; \
	fi
endif

#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as envRulesUtils from './utils/env-rules';
import {
  collectAndroidArtifacts,
  collectIosArtifacts,
  printArtifactsSummary
} from './utils/artifacts';

const YAML_TEMPLATE = `# ==============================================================================
# NativeScript Environment Rules Configuration (@wuneo/nativescript-env)
# ==============================================================================

# App Version & Build Numbers
version: "1.0.0"
buildNumber: "1"
autoVersionCode: true

# Default active environment when no CLI flag (e.g. --env.use.<env>) is specified
default: "development"

# Extra directories to scan for environment-specific file overrides (e.g. environment.dev.ts -> environment.ts)
extraPaths:
  - "environments"

# Direct file copy mappings (Source file in env folder -> Destination file in project)
directCopyRules:
  Info.plist: "App_Resources/iOS/Info.plist"
  GoogleService-Info.plist: "App_Resources/iOS/GoogleService-Info.plist"
  Podfile: "App_Resources/iOS/Podfile"

# Master App Icon path (Automatically resizes for iOS & Android)
appIconPath: "environments/app-icon/icon.png"

# Release Artifacts & Symbols Packaging (Automated on ns build --release)
artifacts:
  outputDir: "dist"              # Target output folder for release bundles and archives
  appName: ""                    # Custom app name prefix (defaults to package.json name)
  versionFolder: true            # Group outputs under dist/v{version}_b{buildNumber}/
  clean: false                   # Clean output folder before packaging
  android:
    packAab: true                # Archive .aab bundle for Google Play
    packApk: true                # Archive .apk package if built
    packNativeSymbols: true      # Pack C++/NDK .so debug symbols to .zip for Google Play
    packMapping: true            # Archive R8/ProGuard mapping.txt if available
  ios:
    packArchive: true            # Archive .xcarchive for Xcode Organizer / App Store
    packDsym: true               # Pack .dSYM folders to .zip for Firebase Crashlytics
    autoUploadCrashlytics: false # Auto-upload dSYMs via Firebase upload-symbols binary

# Environment Definitions
environments:
  - name: "development"
    appBundleId: "com.example.app.dev"

  - name: "staging"
    appBundleId: "com.example.app.staging"

  - name: "release"
    appBundleId:
      android: "com.example.app.android"
      ios: "com.example.app.ios"
`;

function runInit() {
  const cwd = process.cwd();
  const targetYaml = path.join(cwd, 'environment-rules.yaml');
  const targetYml = path.join(cwd, 'environment-rules.yml');
  const targetJson = path.join(cwd, 'environment-rules.json');

  if (fs.existsSync(targetYaml) || fs.existsSync(targetYml) || fs.existsSync(targetJson)) {
    console.log(`\x1b[33m-o[NeoEnv]o--! Configuration file already exists in current directory!\x1b[0m`);
    return;
  }

  fs.writeFileSync(targetYaml, YAML_TEMPLATE, 'utf8');
  console.log(`\x1b[32m-o[NeoEnv]o--> Successfully created "environment-rules.yaml" with template comments!\x1b[0m`);
  console.log(`\x1b[36mYou can now edit environment-rules.yaml to configure your environments.\x1b[0m`);
}

function runArtifacts(platformArg?: string, envArg?: string) {
  const projectDir = process.cwd();
  const envRulesFilePath = envRulesUtils.getEnvRulesFilePath('environment-rules.yaml', projectDir);
  const envRules = envRulesUtils.readEnvRules(envRulesFilePath);

  const envName = envArg || envRules.default || 'release';
  const targetPlatform = (platformArg || '').toLowerCase();

  const logger = {
    info: (msg: string) => console.log(msg),
    warn: (msg: string) => console.warn(msg),
    debug: (_msg: string) => {},
  };

  if (!targetPlatform || targetPlatform === 'android' || targetPlatform === 'all') {
    const androidRes = collectAndroidArtifacts(logger, projectDir, envRules, envName);
    printArtifactsSummary(logger, androidRes);
  }

  if (!targetPlatform || targetPlatform === 'ios' || targetPlatform === 'all') {
    const iosRes = collectIosArtifacts(logger, projectDir, envRules, envName);
    printArtifactsSummary(logger, iosRes);
  }
}

const args = process.argv.slice(2);
if (args.includes('init')) {
  runInit();
} else if (args.includes('artifacts') || args.includes('collect')) {
  const filtered = args.filter((a) => a !== 'artifacts' && a !== 'collect');
  const platform = filtered.find((a) => ['android', 'ios', 'all'].includes(a.toLowerCase())) || 'all';
  const env = filtered.find((a) => !['android', 'ios', 'all'].includes(a.toLowerCase()) && !a.startsWith('--'));
  runArtifacts(platform, env);
} else {
  console.log(`@wuneo/nativescript-env CLI`);
  console.log(`Usage:`);
  console.log(`  npx wuneo-env init                 Generate environment-rules.yaml template`);
  console.log(`  npx wuneo-env artifacts [platform] Manually collect and package release artifacts (android | ios | all)`);
}

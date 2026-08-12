#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

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

const args = process.argv.slice(2);
if (args.includes('init')) {
  runInit();
} else {
  console.log(`Usage: npx wuneo-env init`);
}

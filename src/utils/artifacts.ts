import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';
import {
  ArtifactsConfig,
  EnvironmentRulesContent,
  getPlatformValue
} from './env-rules';

export interface CollectedArtifactItem {
  type: 'aab' | 'apk' | 'symbols' | 'mapping' | 'archive' | 'dsym' | 'ipa';
  sourcePath: string;
  targetPath: string;
  description: string;
  sizeBytes?: number;
}

export interface CollectionResult {
  platform: 'android' | 'ios';
  outputDir: string;
  items: CollectedArtifactItem[];
  uploadedCrashlytics?: boolean;
}

/**
 * Resolves full ArtifactsConfig with defaults
 */
export function resolveArtifactsConfig(envRules?: EnvironmentRulesContent): Required<ArtifactsConfig> {
  const custom = envRules?.artifacts || {};
  return {
    enabled: custom.enabled !== false,
    outputDir: custom.outputDir || 'dist',
    appName: custom.appName || '',
    versionFolder: custom.versionFolder !== false,
    clean: custom.clean === true,
    android: {
      packAab: custom.android?.packAab !== false,
      packApk: custom.android?.packApk !== false,
      packNativeSymbols: custom.android?.packNativeSymbols !== false,
      packMapping: custom.android?.packMapping !== false,
    },
    ios: {
      packArchive: custom.ios?.packArchive !== false,
      packDsym: custom.ios?.packDsym !== false,
      autoUploadCrashlytics: custom.ios?.autoUploadCrashlytics === true,
    },
  };
}

/**
 * Detects whether the current build execution is a release build.
 * Debug builds, simulator runs, or development device runs without `--release` are excluded.
 */
export function isReleaseBuild(hookArgs?: any, argv: string[] = process.argv): boolean {
  const buildData = hookArgs?.buildData || hookArgs?.prepareData;
  const options = hookArgs?.options;

  // 1. Hook data flags provided by NativeScript CLI
  if (buildData?.release === true || hookArgs?.release === true || options?.release === true) {
    return true;
  }

  if (buildData?.env?.release === true || options?.env?.release === true) {
    return true;
  }

  // 2. Command line arguments
  const normalizedArgv = argv.map((a) => a.toLowerCase());
  return (
    normalizedArgv.includes('--release') ||
    normalizedArgv.includes('-release') ||
    normalizedArgv.includes('--env.release') ||
    normalizedArgv.some((a) => a === '--release' || a.startsWith('--release=') || a === '-r')
  );
}

/**
 * Resolves a clean application name for file naming
 */
export function resolveAppName(projectDir: string, explicitAppName?: string, fallbackName?: string): string {
  if (explicitAppName && explicitAppName.trim()) {
    return sanitizeFileName(explicitAppName.trim());
  }

  try {
    const pkgPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) {
        // Strip scoped package prefix (e.g. @company/app -> app)
        const cleanName = pkg.name.replace(/^@[^/]+\//, '');
        return sanitizeFileName(cleanName);
      }
    }
  } catch (_e) {}

  if (fallbackName && fallbackName.trim()) {
    return sanitizeFileName(fallbackName.trim());
  }

  return 'App';
}

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
}

/**
 * Resolves the structured release output directory
 */
export function resolveReleaseOutputDir(
  projectDir: string,
  config: Required<ArtifactsConfig>,
  version: string,
  buildNumber: string,
  envName: string,
  platform: 'android' | 'ios'
): string {
  const baseOut = path.resolve(projectDir, config.outputDir);
  if (config.versionFolder) {
    const buildTag = buildNumber ? `v${version}-${buildNumber}` : `v${version}`;
    const folderName = envName ? `${buildTag}_${envName}` : buildTag;
    return path.join(baseOut, folderName, platform);
  }
  return path.join(baseOut, platform);
}

/**
 * Cross-platform directory zipping helper
 */
export function createZipFromDirectory(
  sourceDir: string,
  targetZipFile: string,
  options: { contentsOnly?: boolean } = {}
): boolean {
  if (!fs.existsSync(sourceDir)) return false;

  const targetDir = path.dirname(targetZipFile);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Remove existing target zip file if exists
  if (fs.existsSync(targetZipFile)) {
    try {
      fs.unlinkSync(targetZipFile);
    } catch (_e) {}
  }

  try {
    if (process.platform === 'win32') {
      const srcPath = options.contentsOnly ? path.join(sourceDir, '*') : sourceDir;
      const psCommand = `Compress-Archive -Path "${srcPath}" -DestinationPath "${targetZipFile}" -Force`;
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCommand], {
        stdio: 'pipe',
      });
      return result.status === 0 && fs.existsSync(targetZipFile);
    } else {
      // Unix / macOS zip
      if (options.contentsOnly) {
        const result = spawnSync('zip', ['-r', '-q', targetZipFile, '.'], {
          cwd: sourceDir,
          stdio: 'pipe',
        });
        return result.status === 0 && fs.existsSync(targetZipFile);
      } else {
        const parentDir = path.dirname(sourceDir);
        const baseName = path.basename(sourceDir);
        const result = spawnSync('zip', ['-r', '-q', targetZipFile, baseName], {
          cwd: parentDir,
          stdio: 'pipe',
        });
        return result.status === 0 && fs.existsSync(targetZipFile);
      }
    }
  } catch (_err) {
    return false;
  }
}

/**
 * Cross-platform multiple directories/files zipping helper
 */
export function createZipFromPaths(
  sourcePaths: string[],
  targetZipFile: string,
  baseCwd: string
): boolean {
  if (!sourcePaths || sourcePaths.length === 0) return false;

  const targetDir = path.dirname(targetZipFile);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  if (fs.existsSync(targetZipFile)) {
    try {
      fs.unlinkSync(targetZipFile);
    } catch (_e) {}
  }

  try {
    if (process.platform === 'win32') {
      const joinedPaths = sourcePaths.map((p) => `"${p}"`).join(',');
      const psCommand = `Compress-Archive -Path ${joinedPaths} -DestinationPath "${targetZipFile}" -Force`;
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCommand], {
        stdio: 'pipe',
      });
      return result.status === 0 && fs.existsSync(targetZipFile);
    } else {
      const relPaths = sourcePaths.map((p) => path.relative(baseCwd, p));
      const result = spawnSync('zip', ['-r', '-q', targetZipFile, ...relPaths], {
        cwd: baseCwd,
        stdio: 'pipe',
      });
      return result.status === 0 && fs.existsSync(targetZipFile);
    }
  } catch (_err) {
    return false;
  }
}

/**
 * Searches for files matching a pattern in a directory recursively
 */
export function findFilesRecursive(dir: string, pattern: RegExp, maxDepth: number = 5): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];

  function walk(currentDir: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath, depth + 1);
        } else if (entry.isFile() && pattern.test(entry.name)) {
          results.push(fullPath);
        }
      }
    } catch (_e) {}
  }

  walk(dir, 0);
  return results;
}

/**
 * Collects Android Release Build Artifacts (.aab, .apk, native debug symbols, mapping.txt)
 */
export function collectAndroidArtifacts(
  logger: any,
  projectDir: string,
  envRules: EnvironmentRulesContent,
  envName: string,
  fallbackProjectName?: string
): CollectionResult | null {
  const config = resolveArtifactsConfig(envRules);
  if (!config.enabled) {
    logger.debug?.('[NeoEnv] Artifacts collection is disabled.');
    return null;
  }

  const version = envRules.version || '1.0.0';
  const buildNumber = getPlatformValue(envRules.buildNumber, 'android', '1');
  const appName = resolveAppName(projectDir, config.appName, fallbackProjectName);
  const outDir = resolveReleaseOutputDir(projectDir, config, version, buildNumber, envName, 'android');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const collected: CollectedArtifactItem[] = [];
  const prefix = `${appName}-v${version}-${buildNumber}-${envName}`;
  const androidBuildDir = path.join(projectDir, 'platforms/android/app/build');

  // 1. Collect AAB
  if (config.android.packAab) {
    const aabCandidates = findFilesRecursive(
      path.join(androidBuildDir, 'outputs/bundle'),
      /\.aab$/i
    );
    if (aabCandidates.length > 0) {
      // Pick the newest or release aab
      const targetAab = aabCandidates.find((f) => f.includes('release')) || aabCandidates[0];
      const targetAabPath = path.join(outDir, `${prefix}.aab`);
      fs.copyFileSync(targetAab, targetAabPath);
      const stat = fs.statSync(targetAabPath);
      logger?.info?.(`[NeoEnv]   ↳ Copied AAB: ${path.relative(projectDir, targetAabPath)} (${formatBytes(stat.size)})`);
      collected.push({
        type: 'aab',
        sourcePath: targetAab,
        targetPath: targetAabPath,
        description: 'Android App Bundle (Google Play Release)',
        sizeBytes: stat.size,
      });
    }
  }

  // 2. Collect APK (if built)
  if (config.android.packApk) {
    const apkCandidates = findFilesRecursive(
      path.join(androidBuildDir, 'outputs/apk'),
      /\.apk$/i
    );
    if (apkCandidates.length > 0) {
      const releaseApk = apkCandidates.find((f) => f.includes('release') && !f.includes('unsigned')) || apkCandidates[0];
      const targetApkPath = path.join(outDir, `${prefix}.apk`);
      fs.copyFileSync(releaseApk, targetApkPath);
      const stat = fs.statSync(targetApkPath);
      logger?.info?.(`[NeoEnv]   ↳ Copied APK: ${path.relative(projectDir, targetApkPath)} (${formatBytes(stat.size)})`);
      collected.push({
        type: 'apk',
        sourcePath: releaseApk,
        targetPath: targetApkPath,
        description: 'Android APK Package',
        sizeBytes: stat.size,
      });
    }
  }

  // 3. Collect Native Debug Symbols (.so)
  if (config.android.packNativeSymbols) {
    const possibleNativeLibDirs = [
      path.join(androidBuildDir, 'intermediates/merged_native_libs/release/mergeReleaseNativeLibs/out/lib'),
      path.join(androidBuildDir, 'intermediates/merged_native_libs/release/out/lib'),
      path.join(androidBuildDir, 'intermediates/stripped_native_libs/release/stripReleaseDebugSymbols/out/lib'),
      path.join(androidBuildDir, 'intermediates/stripped_native_libs/release/out/lib'),
      path.join(androidBuildDir, 'intermediates/merged_jni_libs/release/mergeReleaseJniLibFolders/out'),
    ];

    const gradleSymbolsZip = path.join(androidBuildDir, 'outputs/native-debug-symbols/release/native-debug-symbols.zip');
    const targetSymbolsZip = path.join(outDir, `${prefix}-native-symbols.zip`);

    if (fs.existsSync(gradleSymbolsZip)) {
      fs.copyFileSync(gradleSymbolsZip, targetSymbolsZip);
      const stat = fs.statSync(targetSymbolsZip);
      logger?.info?.(`[NeoEnv]   ↳ Copied Native Symbols: ${path.relative(projectDir, targetSymbolsZip)} (${formatBytes(stat.size)})`);
      collected.push({
        type: 'symbols',
        sourcePath: gradleSymbolsZip,
        targetPath: targetSymbolsZip,
        description: 'Native C++/NDK Debug Symbols (.so zip for Google Play)',
        sizeBytes: stat.size,
      });
    } else {
      const foundNativeLibsDir = possibleNativeLibDirs.find(
        (d) =>
          fs.existsSync(d) &&
          fs
            .readdirSync(d)
            .some((entry) => ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'].includes(entry))
      );

      if (foundNativeLibsDir) {
        const zipped = createZipFromDirectory(foundNativeLibsDir, targetSymbolsZip, { contentsOnly: true });
        if (zipped && fs.existsSync(targetSymbolsZip)) {
          const stat = fs.statSync(targetSymbolsZip);
          logger?.info?.(`[NeoEnv]   ↳ Zipped & Copied Native Symbols: ${path.relative(projectDir, targetSymbolsZip)} (${formatBytes(stat.size)})`);
          collected.push({
            type: 'symbols',
            sourcePath: foundNativeLibsDir,
            targetPath: targetSymbolsZip,
            description: 'Native C++/NDK Debug Symbols (.so zip for Google Play)',
            sizeBytes: stat.size,
          });
        }
      }
    }
  }

  // 4. Collect Mapping file (if R8/ProGuard was used)
  if (config.android.packMapping) {
    const mappingCandidates = findFilesRecursive(
      path.join(androidBuildDir, 'outputs/mapping'),
      /mapping\.txt$/i
    );
    if (mappingCandidates.length > 0) {
      const mappingFile = mappingCandidates[0];
      const targetMappingPath = path.join(outDir, `${prefix}-mapping.txt`);
      fs.copyFileSync(mappingFile, targetMappingPath);
      const stat = fs.statSync(targetMappingPath);
      logger?.info?.(`[NeoEnv]   ↳ Copied Mapping: ${path.relative(projectDir, targetMappingPath)} (${formatBytes(stat.size)})`);
      collected.push({
        type: 'mapping',
        sourcePath: mappingFile,
        targetPath: targetMappingPath,
        description: 'R8/ProGuard Deobfuscation Mapping File',
        sizeBytes: stat.size,
      });
    }
  }

  return {
    platform: 'android',
    outputDir: outDir,
    items: collected,
  };
}

/**
 * Collects iOS Release Build Artifacts (.xcarchive, .dSYM.zip, and optional Firebase upload)
 */
export function collectIosArtifacts(
  logger: any,
  projectDir: string,
  envRules: EnvironmentRulesContent,
  envName: string,
  fallbackProjectName?: string
): CollectionResult | null {
  const config = resolveArtifactsConfig(envRules);
  if (!config.enabled) {
    logger.debug?.('[NeoEnv] Artifacts collection is disabled.');
    return null;
  }

  const version = envRules.version || '1.0.0';
  const buildNumber = getPlatformValue(envRules.buildNumber, 'ios', '1');
  const appName = resolveAppName(projectDir, config.appName, fallbackProjectName);
  const outDir = resolveReleaseOutputDir(projectDir, config, version, buildNumber, envName, 'ios');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const collected: CollectedArtifactItem[] = [];
  const prefix = `${appName}-v${version}-${buildNumber}-${envName}`;
  const iosPlatformsDir = path.join(projectDir, 'platforms/ios');

  // 1. Search for .xcarchive
  const archiveCandidates: string[] = [];
  const searchDirs = [
    path.join(iosPlatformsDir, 'build'),
    path.join(iosPlatformsDir, 'build/Release-iphoneos'),
    path.join(iosPlatformsDir, 'build/archive'),
    iosPlatformsDir,
  ];

  for (const sDir of searchDirs) {
    if (fs.existsSync(sDir)) {
      try {
        const entries = fs.readdirSync(sDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory() && e.name.endsWith('.xcarchive')) {
            archiveCandidates.push(path.join(sDir, e.name));
          }
        }
      } catch (_e) {}
    }
  }

  let foundArchive: string | undefined = archiveCandidates[0];
  if (foundArchive && config.ios.packArchive) {
    const targetArchivePath = path.join(outDir, `${prefix}.xcarchive`);
    // Copy entire .xcarchive directory recursively
    try {
      if (fs.existsSync(targetArchivePath)) {
        fs.rmSync(targetArchivePath, { recursive: true, force: true });
      }
      fs.cpSync(foundArchive, targetArchivePath, { recursive: true, force: true });
      logger?.info?.(`[NeoEnv]   ↳ Copied Xcode Archive: ${path.relative(projectDir, targetArchivePath)}`);
      collected.push({
        type: 'archive',
        sourcePath: foundArchive,
        targetPath: targetArchivePath,
        description: 'Xcode Release Archive (Use in Xcode Organizer for App Store Distribution)',
      });
    } catch (_e) {
      logger.warn?.(`[NeoEnv] Failed to copy .xcarchive: ${_e}`);
    }
  }

  // 2. Search and pack .dSYM files
  let dsymDirs: string[] = [];
  if (foundArchive) {
    const archiveDsyms = path.join(foundArchive, 'dSYMs');
    if (fs.existsSync(archiveDsyms)) {
      const entries = fs.readdirSync(archiveDsyms);
      for (const entry of entries) {
        if (entry.endsWith('.dSYM')) {
          dsymDirs.push(path.join(archiveDsyms, entry));
        }
      }
    }
  }

  if (dsymDirs.length === 0) {
    const releaseIphoneos = path.join(iosPlatformsDir, 'build/Release-iphoneos');
    if (fs.existsSync(releaseIphoneos)) {
      const entries = fs.readdirSync(releaseIphoneos);
      for (const entry of entries) {
        if (entry.endsWith('.dSYM')) {
          dsymDirs.push(path.join(releaseIphoneos, entry));
        }
      }
    }
  }

  if (dsymDirs.length > 0 && config.ios.packDsym) {
    const targetDsymZip = path.join(outDir, `${prefix}-dSYM.zip`);
    const baseDir = path.dirname(dsymDirs[0]);
    const zipped = createZipFromPaths(dsymDirs, targetDsymZip, baseDir);
    if (zipped && fs.existsSync(targetDsymZip)) {
      const stat = fs.statSync(targetDsymZip);
      logger?.info?.(`[NeoEnv]   ↳ Zipped & Copied iOS dSYMs: ${path.relative(projectDir, targetDsymZip)} (${formatBytes(stat.size)})`);
      collected.push({
        type: 'dsym',
        sourcePath: baseDir,
        targetPath: targetDsymZip,
        description: 'iOS dSYM Debug Symbol Archive (For Firebase Crashlytics / Symbolication)',
        sizeBytes: stat.size,
      });
    }
  }

  // 3. Search and collect .ipa (if built for device)
  const ipaCandidates: { path: string; mtime: number }[] = [];
  const ipaSearchDirs = [
    path.join(iosPlatformsDir, 'build/Release-iphoneos'),
    path.join(iosPlatformsDir, 'build'),
  ];
  for (const sDir of ipaSearchDirs) {
    if (fs.existsSync(sDir)) {
      try {
        const entries = fs.readdirSync(sDir);
        for (const e of entries) {
          if (e.endsWith('.ipa')) {
            const fullP = path.join(sDir, e);
            ipaCandidates.push({ path: fullP, mtime: fs.statSync(fullP).mtimeMs });
          }
        }
      } catch (_e) {}
    }
  }
  if (ipaCandidates.length > 0) {
    ipaCandidates.sort((a, b) => b.mtime - a.mtime);
    const newestIpa = ipaCandidates[0].path;
    const targetIpaPath = path.join(outDir, `${prefix}.ipa`);
    try {
      fs.copyFileSync(newestIpa, targetIpaPath);
      const stat = fs.statSync(targetIpaPath);
      logger?.info?.(`[NeoEnv]   ↳ Copied IPA: ${path.relative(projectDir, targetIpaPath)} (${formatBytes(stat.size)})`);
      collected.push({
        type: 'ipa',
        sourcePath: newestIpa,
        targetPath: targetIpaPath,
        description: 'iOS IPA Application Package',
        sizeBytes: stat.size,
      });
    } catch (_e) {}
  }

  // 4. Optional Firebase Crashlytics Auto-Upload
  let uploadedCrashlytics = false;
  if (config.ios.autoUploadCrashlytics && dsymDirs.length > 0) {
    const uploadScriptCandidates = [
      path.join(iosPlatformsDir, 'Pods/FirebaseCrashlytics/upload-symbols'),
      path.join(projectDir, 'node_modules/@nativescript/firebase-crashlytics/platforms/ios/Pods/FirebaseCrashlytics/upload-symbols'),
    ];
    const googleServicePlistCandidates = [
      path.join(projectDir, 'App_Resources/iOS/GoogleService-Info.plist'),
      path.join(iosPlatformsDir, `${fallbackProjectName || appName}/GoogleService-Info.plist`),
    ];

    const uploadScript = uploadScriptCandidates.find((p) => fs.existsSync(p));
    const googleServicePlist = googleServicePlistCandidates.find((p) => fs.existsSync(p));

    if (uploadScript && googleServicePlist) {
      try {
        fs.chmodSync(uploadScript, 0o755);
        logger.info?.(`[NeoEnv] 🚀 Uploading iOS dSYMs to Firebase Crashlytics...`);
        const uploadProc = spawnSync(uploadScript, ['-gsp', googleServicePlist, '-p', 'ios', path.dirname(dsymDirs[0])], {
          stdio: 'pipe',
          encoding: 'utf8',
        });
        if (uploadProc.status === 0) {
          uploadedCrashlytics = true;
          logger.info?.(`[NeoEnv] ✅ Successfully uploaded iOS dSYMs to Firebase Crashlytics!`);
        } else {
          logger.warn?.(`[NeoEnv] ⚠️ Firebase upload-symbols exited with code ${uploadProc.status}: ${uploadProc.stderr || uploadProc.stdout}`);
        }
      } catch (err: any) {
        logger.warn?.(`[NeoEnv] ⚠️ Error running Firebase upload-symbols: ${err?.message || err}`);
      }
    } else {
      logger.debug?.('[NeoEnv] Firebase upload-symbols or GoogleService-Info.plist not found, skipping auto-upload.');
    }
  }

  return {
    platform: 'ios',
    outputDir: outDir,
    items: collected,
    uploadedCrashlytics,
  };
}

/**
 * Formats bytes into a human readable string
 */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Prints a clean, beautiful summary table to the console/logger
 */
export function printArtifactsSummary(logger: any, result: CollectionResult | null) {
  if (!result || result.items.length === 0) {
    const msg = '[NeoEnv] ℹ️ No release artifacts were found to collect.';
    logger?.info ? logger.info(msg) : console.log(msg);
    return;
  }

  const logLine = (msg: string) => {
    if (logger?.info) {
      logger.info(msg);
    } else {
      console.log(msg);
    }
  };

  const relOutDir = path.relative(process.cwd(), result.outputDir);
  logLine('\n======================================================================');
  logLine(`📦 [NeoEnv] Release Artifacts Packaged (${result.platform.toUpperCase()})`);
  logLine(`📁 Destination: ${relOutDir}`);
  logLine('----------------------------------------------------------------------');

  for (const item of result.items) {
    const relFile = path.relative(process.cwd(), item.targetPath);
    const sizeStr = item.sizeBytes ? ` (${formatBytes(item.sizeBytes)})` : '';
    logLine(`  ✓ ${relFile}${sizeStr}`);
    logLine(`    ↳ ${item.description}`);
  }

  if (result.platform === 'ios') {
    const archiveItem = result.items.find((i) => i.type === 'archive');
    if (archiveItem) {
      logLine('----------------------------------------------------------------------');
      logLine(`💡 Quick Action (Open in Xcode Organizer):`);
      logLine(`   open "${archiveItem.targetPath}"`);
    }
  }

  logLine('======================================================================\n');
}

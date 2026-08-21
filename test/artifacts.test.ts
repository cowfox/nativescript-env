import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  resolveArtifactsConfig,
  resolveAppName,
  resolveReleaseOutputDir,
  collectAndroidArtifacts,
  collectIosArtifacts,
  formatBytes,
  printArtifactsSummary,
  isReleaseBuild
} from '../src/utils/artifacts';
import { EnvironmentRulesContent } from '../src/utils/env-rules';

describe('artifacts.ts', () => {
  const mockLogger = {
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {},
  };

  describe('resolveArtifactsConfig', () => {
    it('should provide sensible defaults when artifacts config is omitted', () => {
      const config = resolveArtifactsConfig({ environments: [] });
      expect(config.enabled).toBe(true);
      expect(config.outputDir).toBe('dist');
      expect(config.appName).toBe('');
      expect(config.versionFolder).toBe(true);
      expect(config.clean).toBe(false);
      expect(config.android.packAab).toBe(true);
      expect(config.android.packNativeSymbols).toBe(true);
      expect(config.ios.packArchive).toBe(true);
      expect(config.ios.packDsym).toBe(true);
      expect(config.ios.autoUploadCrashlytics).toBe(false);
    });

    it('should respect custom overrides', () => {
      const config = resolveArtifactsConfig({
        environments: [],
        artifacts: {
          enabled: false,
          outputDir: 'release-artifacts',
          appName: 'CustomApp',
          versionFolder: false,
          clean: true,
          android: {
            packAab: false,
            packNativeSymbols: false,
          },
          ios: {
            autoUploadCrashlytics: true,
          },
        },
      });

      expect(config.enabled).toBe(false);
      expect(config.outputDir).toBe('release-artifacts');
      expect(config.appName).toBe('CustomApp');
      expect(config.versionFolder).toBe(false);
      expect(config.clean).toBe(true);
      expect(config.android.packAab).toBe(false);
      expect(config.android.packNativeSymbols).toBe(false);
      expect(config.ios.autoUploadCrashlytics).toBe(true);
    });
  });

  describe('resolveAppName', () => {
    it('should prioritize explicit appName in config', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-appname-'));
      expect(resolveAppName(tmpDir, 'MyAwesomeApp', 'Fallback')).toBe('MyAwesomeApp');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should read package.json name and strip scopes', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-appname-'));
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: '@myorg/my-mobile-app' }),
        'utf8'
      );

      expect(resolveAppName(tmpDir, '', 'Fallback')).toBe('my-mobile-app');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should sanitize illegal filename characters in appName', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-appname-'));
      expect(resolveAppName(tmpDir, 'My App/Special:V1', 'Fallback')).toBe('My_App-Special-V1');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('resolveReleaseOutputDir', () => {
    it('should generate versioned output directory with buildNumber and envName', () => {
      const config = resolveArtifactsConfig({});
      const outDir = resolveReleaseOutputDir('/workspace', config, '1.2.3', '10', 'release', 'android');
      expect(outDir).toBe(path.normalize('/workspace/dist/v1.2.3-10_release/android'));
    });

    it('should omit version subfolder when versionFolder is false', () => {
      const config = resolveArtifactsConfig({
        environments: [],
        artifacts: { versionFolder: false },
      });
      const outDir = resolveReleaseOutputDir('/workspace', config, '1.2.3', '10', 'release', 'ios');
      expect(outDir).toBe(path.normalize('/workspace/dist/ios'));
    });
  });

  describe('collectAndroidArtifacts', () => {
    it('should discover and package AAB, APK, native symbols, and mapping.txt', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-android-art-'));

      // Mock package.json
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app' }));

      // Mock Android build outputs
      const bundleDir = path.join(tmpDir, 'platforms/android/app/build/outputs/bundle/release');
      const apkDir = path.join(tmpDir, 'platforms/android/app/build/outputs/apk/release');
      const mappingDir = path.join(tmpDir, 'platforms/android/app/build/outputs/mapping/release');
      const nativeLibsDir = path.join(tmpDir, 'platforms/android/app/build/intermediates/merged_native_libs/release/out/lib/arm64-v8a');

      fs.mkdirSync(bundleDir, { recursive: true });
      fs.mkdirSync(apkDir, { recursive: true });
      fs.mkdirSync(mappingDir, { recursive: true });
      fs.mkdirSync(nativeLibsDir, { recursive: true });

      fs.writeFileSync(path.join(bundleDir, 'app-release.aab'), 'mock-aab-data');
      fs.writeFileSync(path.join(apkDir, 'app-release.apk'), 'mock-apk-data');
      fs.writeFileSync(path.join(mappingDir, 'mapping.txt'), 'mock-mapping-data');
      fs.writeFileSync(path.join(nativeLibsDir, 'libNativeScript.so'), 'mock-so-binary');

      const envRules: EnvironmentRulesContent = {
        version: '6.10.1',
        buildNumber: '5',
        environments: [{ name: 'release', appBundleId: 'com.test.app' }],
      };

      const result = collectAndroidArtifacts(mockLogger, tmpDir, envRules, 'release', 'test-app');

      expect(result).not.toBeNull();
      expect(result?.platform).toBe('android');
      expect(result?.items.length).toBeGreaterThanOrEqual(3);

      const targetDir = result?.outputDir || '';
      expect(fs.existsSync(targetDir)).toBe(true);

      // Verify AAB collected
      const aabItem = result?.items.find((i) => i.type === 'aab');
      expect(aabItem).toBeDefined();
      expect(aabItem?.targetPath).toContain('test-app-v6.10.1-5-release.aab');
      expect(fs.existsSync(aabItem!.targetPath)).toBe(true);

      // Verify Native Symbols zipped
      const symItem = result?.items.find((i) => i.type === 'symbols');
      expect(symItem).toBeDefined();
      expect(symItem?.targetPath).toContain('test-app-v6.10.1-5-release-native-symbols.zip');
      expect(fs.existsSync(symItem!.targetPath)).toBe(true);

      // Verify Mapping collected
      const mapItem = result?.items.find((i) => i.type === 'mapping');
      expect(mapItem).toBeDefined();
      expect(mapItem?.targetPath).toContain('test-app-v6.10.1-5-release-mapping.txt');
      expect(fs.existsSync(mapItem!.targetPath)).toBe(true);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('collectIosArtifacts', () => {
    it('should discover xcarchive and package dSYM files', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-ios-art-'));

      // Mock package.json
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app' }));

      // Mock iOS build outputs
      const archiveDir = path.join(tmpDir, 'platforms/ios/build/Release-iphoneos/test-app.xcarchive');
      const dsymsDir = path.join(archiveDir, 'dSYMs/test-app.app.dSYM/Contents');

      fs.mkdirSync(dsymsDir, { recursive: true });
      fs.writeFileSync(path.join(dsymsDir, 'Info.plist'), '<plist></plist>');

      const envRules: EnvironmentRulesContent = {
        version: '6.10.1',
        buildNumber: '5',
        environments: [{ name: 'release', appBundleId: 'com.test.app' }],
      };

      const result = collectIosArtifacts(mockLogger, tmpDir, envRules, 'release', 'test-app');

      expect(result).not.toBeNull();
      expect(result?.platform).toBe('ios');

      const archiveItem = result?.items.find((i) => i.type === 'archive');
      expect(archiveItem).toBeDefined();
      expect(archiveItem?.targetPath).toContain('test-app-v6.10.1-5-release.xcarchive');
      expect(fs.existsSync(archiveItem!.targetPath)).toBe(true);

      const dsymItem = result?.items.find((i) => i.type === 'dsym');
      expect(dsymItem).toBeDefined();
      expect(dsymItem?.targetPath).toContain('test-app-v6.10.1-5-release-dSYM.zip');
      expect(fs.existsSync(dsymItem!.targetPath)).toBe(true);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('formatBytes & printArtifactsSummary', () => {
    it('should format bytes cleanly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024 * 5.5)).toBe('5.5 MB');
    });

    it('should print summary without throwing error', () => {
      expect(() => {
        printArtifactsSummary(mockLogger, {
          platform: 'android',
          outputDir: '/dist/android',
          items: [
            {
              type: 'aab',
              sourcePath: '/src/app.aab',
              targetPath: '/dist/app.aab',
              description: 'Android App Bundle',
              sizeBytes: 15000000,
            },
          ],
        });
      }).not.toThrow();
    });
  });

  describe('isReleaseBuild', () => {
    it('should detect release build from buildData.release', () => {
      expect(isReleaseBuild({ buildData: { release: true } }, ['node', 'ns', 'build', 'android'])).toBe(true);
      expect(isReleaseBuild({ buildData: { release: false } }, ['node', 'ns', 'build', 'android'])).toBe(false);
    });

    it('should detect release build from hookArgs.release or options.release', () => {
      expect(isReleaseBuild({ release: true }, ['node', 'ns'])).toBe(true);
      expect(isReleaseBuild({ options: { release: true } }, ['node', 'ns'])).toBe(true);
    });

    it('should detect release build from argv --release flag', () => {
      expect(isReleaseBuild({}, ['node', 'ns', 'build', 'android', '--release'])).toBe(true);
      expect(isReleaseBuild({}, ['node', 'ns', 'build', 'ios', '--release'])).toBe(true);
      expect(isReleaseBuild({}, ['node', 'ns', 'build', 'android', '--env.release'])).toBe(true);
    });

    it('should NOT treat general debug builds or run to device as release build', () => {
      expect(isReleaseBuild({}, ['node', 'ns', 'run', 'ios'])).toBe(false);
      expect(isReleaseBuild({}, ['node', 'ns', 'run', 'android'])).toBe(false);
      expect(isReleaseBuild({}, ['node', 'ns', 'run', 'ios', '--device'])).toBe(false);
      expect(isReleaseBuild({}, ['node', 'ns', 'build', 'ios', '--for-device'])).toBe(false);
      expect(isReleaseBuild({}, ['node', 'ns', 'run', 'android', '--device'])).toBe(false);
      expect(isReleaseBuild({}, ['node', 'ns', 'run', 'ios', '--env.use.prod'])).toBe(false);
      expect(isReleaseBuild({}, ['node', 'ns', 'run', 'android', '--env.use.release'])).toBe(false);
    });

    it('should treat build to device WITH --release as release build', () => {
      expect(isReleaseBuild({}, ['node', 'ns', 'build', 'ios', '--for-device', '--release'])).toBe(true);
      expect(isReleaseBuild({ buildData: { release: true } }, ['node', 'ns', 'build', 'ios', '--for-device'])).toBe(true);
    });
  });
});


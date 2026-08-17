import { describe, it, expect } from 'vitest';
import {
  updateAppBundleId,
  restoreAppBundleIdBackup
} from '../src/utils/bundle-id';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('bundle-id.ts', () => {
  const mockLogger = {
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {}
  };

  it('should update bundle id across config files and create backup', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-env-bundle-'));
    const configPath = path.join(tmpDir, 'nativescript.config.ts');
    const pkgPath = path.join(tmpDir, 'package.json');
    const appResFolder = path.join(tmpDir, 'App_Resources', 'Android');
    fs.mkdirSync(appResFolder, { recursive: true });
    const gradlePath = path.join(appResFolder, 'app.gradle');

    fs.writeFileSync(configPath, `export default { id: "com.original.app" } as any;`, 'utf8');
    fs.writeFileSync(pkgPath, JSON.stringify({ name: 'my-app', nativescript: { id: 'com.original.app' } }, null, 2), 'utf8');
    fs.writeFileSync(gradlePath, `android { defaultConfig { applicationId "com.original.app" } }`, 'utf8');

    const projectData = { projectDir: tmpDir, projectIdentifiers: {} };
    const platformData = { platformNameLowerCase: 'android' };

    updateAppBundleId(mockLogger, 'com.swapped.app.dev', projectData, platformData, appResFolder);

    // Verify files were updated
    expect(fs.readFileSync(configPath, 'utf8')).toContain('id: "com.swapped.app.dev"');
    expect(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).nativescript.id).toBe('com.swapped.app.dev');
    expect(fs.readFileSync(gradlePath, 'utf8')).toContain('applicationId "com.swapped.app.dev"');

    // Verify backup was created
    const backupFile = path.join(tmpDir, 'node_modules', '.cache', 'neo-env-config-backup.json');
    expect(fs.existsSync(backupFile)).toBe(true);

    // Restore backup
    restoreAppBundleIdBackup(mockLogger, projectData);

    // Verify restored
    expect(fs.readFileSync(configPath, 'utf8')).toContain('id: "com.original.app"');
    expect(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).nativescript.id).toBe('com.original.app');
    expect(fs.existsSync(backupFile)).toBe(false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should support platform-specific bundle id object', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-env-bundle-obj-'));
    const configPath = path.join(tmpDir, 'nativescript.config.ts');
    fs.writeFileSync(configPath, `export default { id: "com.original.app" } as any;`, 'utf8');

    const projectData = { projectDir: tmpDir, projectIdentifiers: {} };
    const platformData = { platformNameLowerCase: 'android' };

    const bundleIdObj = {
      android: 'com.app.android.custom',
      ios: 'com.app.ios.custom'
    };

    updateAppBundleId(mockLogger, bundleIdObj, projectData, platformData, '');
    expect(fs.readFileSync(configPath, 'utf8')).toContain('id: "com.app.android.custom"');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

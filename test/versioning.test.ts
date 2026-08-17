import { describe, it, expect } from 'vitest';
import {
  versionBumped,
  generateVersionCode,
  updateVersioning
} from '../src/utils/versioning';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('versioning.ts', () => {
  describe('versionBumped', () => {
    it('should return true when version1 is greater than version2', () => {
      expect(versionBumped('1.0.1', '1.0.0')).toBe(true);
      expect(versionBumped('1.1.0', '1.0.9')).toBe(true);
      expect(versionBumped('2.0.0', '1.9.9')).toBe(true);
    });

    it('should return false when version1 is not greater than version2', () => {
      expect(versionBumped('1.0.0', '1.0.0')).toBe(false);
      expect(versionBumped('1.0.0', '1.0.1')).toBe(false);
      expect(versionBumped('0.9.9', '1.0.0')).toBe(false);
    });
  });

  describe('generateVersionCode', () => {
    it('should correctly format version code with 2-digit padding', () => {
      // 6.10.1 build 4 -> 06 10 01 04 -> 6100104
      const result = generateVersionCode('6.10.1', '4');
      expect(result.error).toBe(false);
      expect(result.versionCode).toBe('6100104');
    });

    it('should format 1.0.0 build 1 -> 1000001', () => {
      const result = generateVersionCode('1.0.0', '1');
      expect(result.error).toBe(false);
      expect(result.versionCode).toBe('1000001');
    });

    it('should format 12.34.56 build 78 -> 12345678', () => {
      const result = generateVersionCode('12.34.56', '78');
      expect(result.error).toBe(false);
      expect(result.versionCode).toBe('12345678');
    });

    it('should return error when minor > 99', () => {
      const result = generateVersionCode('1.100.0', '1');
      expect(result.error).toBe(true);
      expect(result.errorMessage).toContain('Minor #');
    });

    it('should return error when patch > 99', () => {
      const result = generateVersionCode('1.0.100', '1');
      expect(result.error).toBe(true);
      expect(result.errorMessage).toContain('Patch #');
    });

    it('should return error when buildNumber > 99', () => {
      const result = generateVersionCode('1.0.0', '100');
      expect(result.error).toBe(true);
      expect(result.errorMessage).toContain('Build #');
    });
  });

  describe('updateVersioning', () => {
    const mockLogger = {
      info: () => {},
      debug: () => {},
      warn: () => {},
      error: () => {}
    };

    it('should auto-increment build number and version code in release mode', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-env-test-'));
      const pkgPath = path.join(tmpDir, 'package.json');
      fs.writeFileSync(pkgPath, JSON.stringify({ version: '6.10.1' }), 'utf8');

      const envRules: any = {
        version: '6.10.1',
        buildNumber: { ios: '4', android: '4' },
        versionCode: { ios: '6100104', android: '6100104' },
        autoVersionCode: true,
        environments: []
      };

      const result = updateVersioning(mockLogger, true, envRules, { projectDir: tmpDir }, 'android');
      expect(result.buildNumber.android).toBe('5');
      expect(result.buildNumber.ios).toBe('4');
      expect(result.versionCode.android).toBe('6100105');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should skip auto-bump in non-release (dev) mode', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-env-test-'));
      const pkgPath = path.join(tmpDir, 'package.json');
      fs.writeFileSync(pkgPath, JSON.stringify({ version: '6.10.1' }), 'utf8');

      const envRules: any = {
        version: '6.10.1',
        buildNumber: { ios: '4', android: '4' },
        versionCode: { ios: '6100104', android: '6100104' },
        autoVersionCode: true,
        environments: []
      };

      const result = updateVersioning(mockLogger, false, envRules, { projectDir: tmpDir }, 'android');
      expect(result.buildNumber.android).toBe('4');
      expect(result.versionCode.android).toBe('6100104');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should reset build number to 1 when package.json version is bumped', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-env-test-'));
      const pkgPath = path.join(tmpDir, 'package.json');
      fs.writeFileSync(pkgPath, JSON.stringify({ version: '6.11.0' }), 'utf8');

      const envRules: any = {
        version: '6.10.1',
        buildNumber: { ios: '15', android: '15' },
        versionCode: { ios: '6100115', android: '6100115' },
        autoVersionCode: true,
        environments: []
      };

      const result = updateVersioning(mockLogger, false, envRules, { projectDir: tmpDir }, 'android');
      expect(result.version).toBe('6.11.0');
      expect(result.buildNumber.android).toBe('1');
      expect(result.buildNumber.ios).toBe('1');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});

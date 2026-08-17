import { describe, it, expect } from 'vitest';
import {
  findEnvEntry,
  resolveMatchRules,
  getPlatformValue,
  readEnvRules,
  saveEnvRules,
  getEnvRulesFilePath
} from '../src/utils/env-rules';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('env-rules.ts', () => {
  describe('findEnvEntry', () => {
    const environments = [
      { name: 'development', appBundleId: 'com.app.dev' },
      { name: 'staging', appBundleId: 'com.app.staging' },
      { name: 'release', appBundleId: { android: 'com.app.android', ios: 'com.app.ios' } }
    ];

    it('should find exact name match (case-insensitive)', () => {
      expect(findEnvEntry(environments, 'development')?.name).toBe('development');
      expect(findEnvEntry(environments, 'DEVELOPMENT')?.name).toBe('development');
      expect(findEnvEntry(environments, 'staging')?.name).toBe('staging');
    });

    it('should match common aliases', () => {
      // dev <-> development
      expect(findEnvEntry(environments, 'dev')?.name).toBe('development');
      // prod <-> release
      expect(findEnvEntry(environments, 'prod')?.name).toBe('release');
      expect(findEnvEntry(environments, 'production')?.name).toBe('release');
      // stg <-> staging
      expect(findEnvEntry(environments, 'stg')?.name).toBe('staging');
    });

    it('should return undefined for non-existing environment', () => {
      expect(findEnvEntry(environments, 'nonexistent')).toBeUndefined();
      expect(findEnvEntry([], 'dev')).toBeUndefined();
      expect(findEnvEntry(undefined, 'dev')).toBeUndefined();
    });
  });

  describe('resolveMatchRules', () => {
    it('should return custom matchRules if explicitly specified', () => {
      const entry = { name: 'custom', appBundleId: 'id', matchRules: 'custom-regex' };
      expect(resolveMatchRules(entry)).toBe('custom-regex');
    });

    it('should generate smart defaults for dev/development', () => {
      expect(resolveMatchRules({ name: 'dev', appBundleId: 'id' })).toBe('([\\w?].*)(\\.(?:dev|development))($|\\..*)');
      expect(resolveMatchRules({ name: 'development', appBundleId: 'id' })).toBe('([\\w?].*)(\\.(?:dev|development))($|\\..*)');
    });

    it('should generate smart defaults for release/production/prod', () => {
      expect(resolveMatchRules({ name: 'prod', appBundleId: 'id' })).toBe('([\\w?].*)(\\.(?:release|production|prod))($|\\..*)');
      expect(resolveMatchRules({ name: 'release', appBundleId: 'id' })).toBe('([\\w?].*)(\\.(?:release|production|prod))($|\\..*)');
    });

    it('should generate smart defaults for staging/stg', () => {
      expect(resolveMatchRules({ name: 'staging', appBundleId: 'id' })).toBe('([\\w?].*)(\\.(?:staging|stg))($|\\..*)');
      expect(resolveMatchRules({ name: 'stg', appBundleId: 'id' })).toBe('([\\w?].*)(\\.(?:staging|stg))($|\\..*)');
    });

    it('should generate fallback regex for custom environment names', () => {
      expect(resolveMatchRules({ name: 'alpha', appBundleId: 'id' })).toBe('([\\w?].*)(\\.alpha)($|\\..*)');
    });
  });

  describe('getPlatformValue', () => {
    it('should extract string or number directly', () => {
      expect(getPlatformValue('6100104', 'android')).toBe('6100104');
      expect(getPlatformValue(42, 'ios')).toBe('42');
    });

    it('should extract platform-specific value from object', () => {
      const obj = { android: 'com.android', ios: 'com.ios', default: 'com.default' };
      expect(getPlatformValue(obj, 'android')).toBe('com.android');
      expect(getPlatformValue(obj, 'ios')).toBe('com.ios');
      expect(getPlatformValue(obj, 'web', 'fallback')).toBe('com.default');
    });

    it('should return defaultValue if value is undefined', () => {
      expect(getPlatformValue(undefined, 'android', 'default-val')).toBe('default-val');
    });
  });

  describe('readEnvRules and saveEnvRules', () => {
    it('should round-trip YAML configuration files', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-env-yaml-'));
      const filePath = path.join(tmpDir, 'environment-rules.yaml');

      const config: any = {
        version: '1.2.3',
        buildNumber: '10',
        default: 'development',
        environments: [
          { name: 'development', appBundleId: 'com.dev' }
        ]
      };

      saveEnvRules(filePath, config);
      expect(fs.existsSync(filePath)).toBe(true);

      const loaded = readEnvRules(filePath);
      expect(loaded.version).toBe('1.2.3');
      expect(loaded.default).toBe('development');
      expect(loaded.environments[0].appBundleId).toBe('com.dev');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should round-trip JSON configuration files', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-env-json-'));
      const filePath = path.join(tmpDir, 'environment-rules.json');

      const config: any = {
        version: '2.0.0',
        buildNumber: '1',
        default: 'staging',
        environments: [
          { name: 'staging', appBundleId: 'com.staging' }
        ]
      };

      saveEnvRules(filePath, config);
      expect(fs.existsSync(filePath)).toBe(true);

      const loaded = readEnvRules(filePath);
      expect(loaded.version).toBe('2.0.0');
      expect(loaded.default).toBe('staging');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('getEnvRulesFilePath', () => {
    it('should find environment-rules.yaml in folder', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-env-path-'));
      const yamlPath = path.join(tmpDir, 'environment-rules.yaml');
      fs.writeFileSync(yamlPath, 'default: dev\n', 'utf8');

      const resolved = getEnvRulesFilePath('', tmpDir);
      expect(resolved).toBe(yamlPath);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});

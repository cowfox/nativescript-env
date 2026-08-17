import { describe, it, expect } from 'vitest';
import {
  buildDestinationFileName,
  doesSourceMatchDestination,
  replaceContentInFile,
  detectAndCopyEnvFiles,
  detectAndDeleteEnvFiles
} from '../src/utils/file';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('file.ts', () => {
  const mockLogger = {
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {}
  };

  describe('buildDestinationFileName', () => {
    const devRegex = /([\w?].*)(\.(?:dev|development))($|\..*)/;

    it('should strip .dev variant from TypeScript files', () => {
      expect(buildDestinationFileName(mockLogger, 'environment.dev.ts', devRegex)).toBe('environment.ts');
      expect(buildDestinationFileName(mockLogger, 'config.development.ts', devRegex)).toBe('config.ts');
    });

    it('should strip .dev variant from XML and JSON files', () => {
      expect(buildDestinationFileName(mockLogger, 'AndroidManifest.dev.xml', devRegex)).toBe('AndroidManifest.xml');
      expect(buildDestinationFileName(mockLogger, 'settings.dev.json', devRegex)).toBe('settings.json');
      expect(buildDestinationFileName(mockLogger, 'icon.dev.png', devRegex)).toBe('icon.png');
    });

    it('should handle complex compound names', () => {
      expect(buildDestinationFileName(mockLogger, 'app.component.dev.html', devRegex)).toBe('app.component.html');
    });
  });

  describe('doesSourceMatchDestination', () => {
    it('should return true when file contents match', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-env-file-match-'));
      const src = path.join(tmpDir, 'source.txt');
      const dst = path.join(tmpDir, 'dest.txt');
      fs.writeFileSync(src, 'hello world', 'utf8');
      fs.writeFileSync(dst, 'hello world', 'utf8');

      expect(doesSourceMatchDestination(mockLogger, src, dst)).toBe(true);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should return false when file contents differ', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-env-file-match-'));
      const src = path.join(tmpDir, 'source.txt');
      const dst = path.join(tmpDir, 'dest.txt');
      fs.writeFileSync(src, 'hello world', 'utf8');
      fs.writeFileSync(dst, 'hello different world', 'utf8');

      expect(doesSourceMatchDestination(mockLogger, src, dst)).toBe(false);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('replaceContentInFile', () => {
    it('should safely replace matching regex content in file', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-env-replace-'));
      const file = path.join(tmpDir, 'test.gradle');
      fs.writeFileSync(file, 'versionName "1.0.0"\nversionCode 100', 'utf8');

      replaceContentInFile(mockLogger, /(versionName\s+")[^"]+(")/, '$12.0.0$2', file);

      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('versionName "2.0.0"');
      expect(content).toContain('versionCode 100');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('detectAndCopyEnvFiles', () => {
    it('should copy matching env variant to target base file', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-env-copy-'));
      const devFile = path.join(tmpDir, 'environment.dev.ts');
      fs.writeFileSync(devFile, 'export const env = "dev";', 'utf8');

      detectAndCopyEnvFiles(
        mockLogger,
        tmpDir,
        '([\\w?].*)(\\.(?:dev|development))($|\\..*)',
        {},
        { projectDir: tmpDir }
      );

      const targetFile = path.join(tmpDir, 'environment.ts');
      expect(fs.existsSync(targetFile)).toBe(true);
      expect(fs.readFileSync(targetFile, 'utf8')).toBe('export const env = "dev";');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('detectAndDeleteEnvFiles', () => {
    it('should delete matching env variants from directory', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-env-del-'));
      const devFile = path.join(tmpDir, 'AndroidManifest.dev.xml');
      const prodFile = path.join(tmpDir, 'AndroidManifest.prod.xml');
      const mainFile = path.join(tmpDir, 'AndroidManifest.xml');

      fs.writeFileSync(devFile, '<manifest/>', 'utf8');
      fs.writeFileSync(prodFile, '<manifest/>', 'utf8');
      fs.writeFileSync(mainFile, '<manifest/>', 'utf8');

      detectAndDeleteEnvFiles(mockLogger, tmpDir, /[\w?].*\.(dev|prod)[$|\..*]/);

      expect(fs.existsSync(devFile)).toBe(false);
      expect(fs.existsSync(prodFile)).toBe(false);
      expect(fs.existsSync(mainFile)).toBe(true);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});

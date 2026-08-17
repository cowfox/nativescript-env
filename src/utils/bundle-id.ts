import * as path from 'path';
import * as fs from 'fs';

export function updateAppBundleId(
  logger: any,
  appBundleId: string | Record<string, string>,
  projectData: any,
  platformData: any,
  appResourcesFolder: string
): void {
  const platform = platformData?.platformNameLowerCase || 'android';
  const resolvedId = typeof appBundleId === 'string' ? appBundleId : (appBundleId[platform] || appBundleId.default);

  logger.info(`[NeoEnv] 🆔 App Bundle ID   -> "${resolvedId}"`);

  if (projectData && projectData.projectIdentifiers) {
    projectData.projectIdentifiers.ios = projectData.projectIdentifiers.android = resolvedId;
  }

  const projectDir = projectData?.projectDir || process.cwd();
  const cacheDir = path.join(projectDir, 'node_modules', '.cache');
  if (!fs.existsSync(cacheDir)) {
    try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (e) {}
  }
  const backupFilePath = path.join(cacheDir, 'neo-env-config-backup.json');
  const backupData: Record<string, string> = {};

  // 1. Sync id in nativescript.config.ts or nativescript.config.js
  const configTs = path.join(projectDir, 'nativescript.config.ts');
  const configJs = path.join(projectDir, 'nativescript.config.js');
  [configTs, configJs].forEach((cfgPath) => {
    if (fs.existsSync(cfgPath)) {
      try {
        let content = fs.readFileSync(cfgPath, 'utf8');
        const newContent = content.replace(/(id:\s*['"])[^'"]+(['"])/, `$1${resolvedId}$2`);
        if (newContent !== content) {
          backupData[cfgPath] = content;
          fs.writeFileSync(cfgPath, newContent, 'utf8');
        }
      } catch (e) {}
    }
  });

  // 2. Sync id in package.json "nativescript": { "id": "..." }
  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      let content = fs.readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(content);
      if (pkg.nativescript && pkg.nativescript.id && pkg.nativescript.id !== resolvedId) {
        backupData[pkgPath] = content;
        pkg.nativescript.id = resolvedId;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      }
    } catch (e) {}
  }

  if (Object.keys(backupData).length > 0) {
    try {
      fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');
    } catch (e) {}
  }

  // 3. Sync applicationId in App_Resources/Android/app.gradle
  if (appResourcesFolder && platform === 'android') {
    const gradleFile = path.resolve(appResourcesFolder, 'app.gradle');
    if (fs.existsSync(gradleFile)) {
      try {
        let content = fs.readFileSync(gradleFile, 'utf8');
        if (content.includes('applicationId')) {
          content = content.replace(/(applicationId\s+['"])[^'"]+(['"])/, `$1${resolvedId}$2`);
        } else {
          content = content.replace(/(defaultConfig\s*\{)/, `$1\n    applicationId "${resolvedId}"`);
        }
        fs.writeFileSync(gradleFile, content, 'utf8');
      } catch (e) {}
    }
  }

  // 4. Sync applicationId in platforms/android/app/build.gradle
  const buildGradlePath = path.join(projectDir, 'platforms', 'android', 'app', 'build.gradle');
  if (fs.existsSync(buildGradlePath)) {
    try {
      let gradleContent = fs.readFileSync(buildGradlePath, 'utf8');
      const newGradleContent = gradleContent.replace(/(applicationId\s+['"])[^'"]+(['"])/g, `$1${resolvedId}$2`);
      if (newGradleContent !== gradleContent) {
        fs.writeFileSync(buildGradlePath, newGradleContent, 'utf8');
      }
    } catch (e) {}
  }

  // 5. Clean deprecated package="..." attribute from AndroidManifest.xml for AGP 8+ compatibility
  const targetManifests = [
    path.join(appResourcesFolder, 'src', 'main', 'AndroidManifest.xml'),
    path.join(projectDir, 'platforms', 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
  ];
  targetManifests.forEach((mPath) => {
    if (fs.existsSync(mPath)) {
      try {
        let manifestContent = fs.readFileSync(mPath, 'utf8');
        const cleanedContent = manifestContent.replace(/\s+package=\s*['"][^'"]+['"]/, '');
        if (cleanedContent !== manifestContent) {
          fs.writeFileSync(mPath, cleanedContent, 'utf8');
        }
      } catch (e) {}
    }
  });
}

export function restoreAppBundleIdBackup(logger: any, projectData: any): void {
  const projectDir = projectData?.projectDir || process.cwd();
  const backupFilePath = path.join(projectDir, 'node_modules', '.cache', 'neo-env-config-backup.json');

  if (fs.existsSync(backupFilePath)) {
    try {
      const backupData: Record<string, string> = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
      let restoredCount = 0;
      Object.keys(backupData).forEach((filePath) => {
        if (fs.existsSync(filePath)) {
          const currentContent = fs.readFileSync(filePath, 'utf8');
          if (currentContent !== backupData[filePath]) {
            fs.writeFileSync(filePath, backupData[filePath], 'utf8');
            restoredCount++;
          }
        }
      });
      fs.unlinkSync(backupFilePath);
      if (restoredCount > 0) {
        logger.info(`-o[NeoEnv]o--> Restored original project configuration files (nativescript.config.ts / package.json)`);
      }
    } catch (e) {}
  }
}

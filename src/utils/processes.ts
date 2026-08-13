import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import * as versioningUtils from './versioning';
import * as fileUtils from './file';
import { EnvironmentRulesContent } from './env-rules';

export function updateAppBundleId(
  logger: any,
  appBundleId: string | Record<string, string>,
  projectData: any,
  platformData: any,
  appResourcesFolder: string
): void {
  const platform = platformData?.platformNameLowerCase || 'android';
  const resolvedId = typeof appBundleId === 'string' ? appBundleId : (appBundleId[platform] || appBundleId.default);

  logger.info(`-o[NeoEnv]o--> Updating App Bundle ID to: "${resolvedId}"`);

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
        backupData[cfgPath] = content;
        const newContent = content.replace(/(id:\s*['"])[^'"]+(['"])/, `$1${resolvedId}$2`);
        if (newContent !== content) {
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
      backupData[pkgPath] = content;
      const pkg = JSON.parse(content);
      if (pkg.nativescript && pkg.nativescript.id && pkg.nativescript.id !== resolvedId) {
        pkg.nativescript.id = resolvedId;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      }
    } catch (e) {}
  }

  if (!fs.existsSync(backupFilePath) && Object.keys(backupData).length > 0) {
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

export function updateVersioning(
  logger: any,
  inReleaseMode: boolean,
  envRulesContent: EnvironmentRulesContent,
  projectData: any
): EnvironmentRulesContent {
  const packageJsonFile = path.join(projectData.projectDir, 'package.json');
  if (!fs.existsSync(packageJsonFile)) {
    throw new Error(`-o[NeoEnv]o--x Could not locate "package.json" file under: ${packageJsonFile}`);
  }
  const versionFromPackageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8')).version;

  if (!envRulesContent.version || !envRulesContent.buildNumber || !envRulesContent.versionCode) {
    throw new Error(`-o[NeoEnv]o--x Could not find related "Version Info" from "Env Rules" file! Please ensure "version", "buildNumber", and "versionCode" are defined.`);
  }

  if (versioningUtils.versionBumped(envRulesContent.version, versionFromPackageJson)) {
    throw new Error(`-o[NeoEnv]o--x Previous building version "${envRulesContent.version}" is beyond "package.json" version "${versionFromPackageJson}". Please check.`);
  }

  if (versioningUtils.versionBumped(versionFromPackageJson, envRulesContent.version)) {
    envRulesContent.version = versionFromPackageJson;
    envRulesContent.buildNumber = '1';
    logger.info(`-o[NeoEnv]o--> Updated version # to "${envRulesContent.version}", and reset build # to "${envRulesContent.buildNumber}"`);
  } else {
    if (inReleaseMode) {
      envRulesContent.buildNumber = (+envRulesContent.buildNumber + 1).toString();
      logger.info(`-o[NeoEnv]o--> Kept version # at "${envRulesContent.version}", updated build # to "${envRulesContent.buildNumber}"`);
    } else {
      logger.info(`-o[NeoEnv]o--> Kept version # at "${envRulesContent.version}"`);
    }
  }

  const autoVersionCode = envRulesContent.autoVersionCode === true;
  if (!inReleaseMode) {
    if (autoVersionCode) {
      logger.info(`-o[NeoEnv]o--! Not in "Release" mode, skipping "Version Code" generation.`);
    }
    return envRulesContent;
  }

  if (autoVersionCode) {
    logger.info(`-o[NeoEnv]o--> Auto-generating version code...`);
    const result = versioningUtils.generateVersionCode(envRulesContent.version, envRulesContent.buildNumber);
    if (result.error) {
      throw new Error(`-o[NeoEnv]o--x Could not generate Version Code: ${result.errorMessage}`);
    } else {
      envRulesContent.versionCode = result.versionCode;
    }
    logger.info(`-o[NeoEnv]o--> Generated version code "${envRulesContent.versionCode}" based on version "${envRulesContent.version}" and build "${envRulesContent.buildNumber}"`);
  }

  return envRulesContent;
}

export function saveVersioningToAndroidGradle(
  logger: any,
  appResourcesFolder: string,
  envRulesContent: EnvironmentRulesContent
): void {
  const gradleFile = path.resolve(appResourcesFolder, 'app.gradle');

  fileUtils.replaceContentInFile(
    logger,
    /(versionName)[\s\d."]+"/,
    `versionName "${envRulesContent.version}"`,
    gradleFile
  );

  fileUtils.replaceContentInFile(
    logger,
    /(versionCode)[\s]+[\d.]+/,
    `versionCode ${envRulesContent.versionCode}`,
    gradleFile
  );
}

export function copyAppResources(
  logger: any,
  appResourcesFolder: string,
  matchRulesString: string,
  directCopyRules: Record<string, string>,
  projectData: any
): void {
  fileUtils.detectAndCopyEnvFiles(logger, appResourcesFolder, matchRulesString, directCopyRules, projectData);
}

export function copyExtraFolders(
  logger: any,
  extraPaths: string[] | undefined,
  matchRulesString: string,
  directCopyRules: Record<string, string>,
  projectData: any
): void {
  if (!extraPaths) return;
  extraPaths.forEach((folderPath) => {
    const cachedDir = projectData.$projectHelper?.cachedProjectDir || projectData.projectDir;
    const folderFullPath = folderPath.indexOf(cachedDir) < 0
      ? path.join(cachedDir, folderPath)
      : folderPath;

    fileUtils.detectAndCopyEnvFiles(logger, folderFullPath, matchRulesString, directCopyRules, projectData);
  });
}

export function generateAppIcon(logger: any, appIconPath: string | undefined, projectData: any): void {
  if (appIconPath && fs.existsSync(path.join(projectData.projectDir, appIconPath))) {
    const fullAppIconPath = path.join(projectData.projectDir, appIconPath);
    logger.info(`-o[NeoEnv]o--> Found "App Icon" at "${appIconPath}". Re-generating...`);
    const cmd = `ns resources generate icons ${fullAppIconPath}`;
    try {
      childProcess.execSync(cmd, { stdio: 'ignore' });

      // Sync Android Adaptive Icon layers (ic_launcher_foreground & ic_launcher_monochrome) with generated ic_launcher.png
      const appResDir = projectData.appResourcesDirectoryPath || path.join(projectData.projectDir, 'App_Resources');
      const androidResDir = path.join(appResDir, 'Android', 'src', 'main', 'res');
      if (fs.existsSync(androidResDir)) {
        const mipmapDirs = fs.readdirSync(androidResDir).filter((d) => d.startsWith('mipmap-'));
        mipmapDirs.forEach((mipmapDir) => {
          const dirPath = path.join(androidResDir, mipmapDir);
          const legacyLauncherPath = path.join(dirPath, 'ic_launcher.png');
          const foregroundPath = path.join(dirPath, 'ic_launcher_foreground.png');
          const monochromePath = path.join(dirPath, 'ic_launcher_monochrome.png');

          if (fs.existsSync(legacyLauncherPath)) {
            if (fs.existsSync(foregroundPath)) {
              fs.copyFileSync(legacyLauncherPath, foregroundPath);
            }
            if (fs.existsSync(monochromePath)) {
              fs.copyFileSync(legacyLauncherPath, monochromePath);
            }
          }
        });
      }

      logger.info(`-o[NeoEnv]o--> Done generating app icon`);
    } catch (error) {
      throw new Error(`-o[NeoEnv]o--x Error generating app icon: ${error}`);
    }
  }
}

export function restoreAppBundleIdBackup(logger: any, projectData: any): void {
  const projectDir = projectData?.projectDir || process.cwd();
  const backupFilePath = path.join(projectDir, 'node_modules', '.cache', 'neo-env-config-backup.json');

  if (fs.existsSync(backupFilePath)) {
    try {
      const backupData: Record<string, string> = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
      Object.keys(backupData).forEach((filePath) => {
        if (fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, backupData[filePath], 'utf8');
        }
      });
      fs.unlinkSync(backupFilePath);
      logger.info(`-o[NeoEnv]o--> Restored original project configuration files (nativescript.config.ts / package.json)`);
    } catch (e) {}
  }
}

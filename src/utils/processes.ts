import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import * as versioningUtils from './versioning';
import * as fileUtils from './file';
import { EnvironmentRulesContent, getPlatformValue } from './env-rules';

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

export function updateVersioning(
  logger: any,
  inReleaseMode: boolean,
  envRulesContent: EnvironmentRulesContent,
  projectData: any,
  platform: string = 'android'
): EnvironmentRulesContent {
  const packageJsonFile = path.join(projectData.projectDir, 'package.json');
  if (!fs.existsSync(packageJsonFile)) {
    throw new Error(`-o[NeoEnv]o--x Could not locate "package.json" file under: ${packageJsonFile}`);
  }
  const versionFromPackageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8')).version;

  const currentBuildNum = getPlatformValue(envRulesContent.buildNumber, platform, '1');

  if (!envRulesContent.version || !currentBuildNum) {
    throw new Error(`-o[NeoEnv]o--x Could not find related "Version Info" from "Env Rules" file! Please ensure "version", "buildNumber", and "versionCode" are defined.`);
  }

  if (versioningUtils.versionBumped(envRulesContent.version, versionFromPackageJson)) {
    throw new Error(`-o[NeoEnv]o--x Previous building version "${envRulesContent.version}" is beyond "package.json" version "${versionFromPackageJson}". Please check.`);
  }

  if (versioningUtils.versionBumped(versionFromPackageJson, envRulesContent.version)) {
    envRulesContent.version = versionFromPackageJson;
    envRulesContent.buildNumber = {
      ios: '1',
      android: '1'
    };
    logger.info(`-o[NeoEnv]o--> Updated version # to "${envRulesContent.version}", and reset build # to "1" for all platforms`);
  } else {
    if (inReleaseMode) {
      const nextBuildNum = (+currentBuildNum + 1).toString();
      const prevIos = getPlatformValue(envRulesContent.buildNumber, 'ios', currentBuildNum);
      const prevAndroid = getPlatformValue(envRulesContent.buildNumber, 'android', currentBuildNum);

      envRulesContent.buildNumber = {
        ios: platform === 'ios' ? nextBuildNum : prevIos,
        android: platform === 'android' ? nextBuildNum : prevAndroid
      };
      logger.info(`-o[NeoEnv]o--> Kept version # at "${envRulesContent.version}", updated build # for ${platform} to "${nextBuildNum}"`);
    } else {
      logger.info(`-o[NeoEnv]o--> Kept version # at "${envRulesContent.version}"`);
    }
  }

  const activeBuildNum = getPlatformValue(envRulesContent.buildNumber, platform, '1');
  const autoVersionCode = envRulesContent.autoVersionCode === true;
  if (!inReleaseMode) {
    if (autoVersionCode) {
      logger.info(`-o[NeoEnv]o--! Not in "Release" mode, skipping "Version Code" generation.`);
    }
    return envRulesContent;
  }

  if (autoVersionCode) {
    logger.info(`-o[NeoEnv]o--> Auto-generating version code for platform "${platform}"...`);
    const result = versioningUtils.generateVersionCode(envRulesContent.version, activeBuildNum);
    if (result.error) {
      throw new Error(`-o[NeoEnv]o--x Could not generate Version Code: ${result.errorMessage}`);
    } else {
      const prevIosVerCode = getPlatformValue(envRulesContent.versionCode, 'ios', result.versionCode!);
      const prevAndroidVerCode = getPlatformValue(envRulesContent.versionCode, 'android', result.versionCode!);

      envRulesContent.versionCode = {
        ios: platform === 'ios' ? result.versionCode! : prevIosVerCode,
        android: platform === 'android' ? result.versionCode! : prevAndroidVerCode
      };
    }
    const currentPlatformVerCode = getPlatformValue(envRulesContent.versionCode, platform);
    logger.info(`-o[NeoEnv]o--> Generated version code "${currentPlatformVerCode}" based on version "${envRulesContent.version}" and build "${activeBuildNum}" for ${platform}`);
  }

  return envRulesContent;
}

export function saveVersioningToAndroidGradle(
  logger: any,
  appResourcesFolder: string,
  envRulesContent: EnvironmentRulesContent
): void {
  const gradleFile = path.resolve(appResourcesFolder, 'app.gradle');
  const androidVersionCode = getPlatformValue(envRulesContent.versionCode, 'android');

  fileUtils.replaceContentInFile(
    logger,
    /(versionName)[\s\d."]+"/,
    `versionName "${envRulesContent.version}"`,
    gradleFile
  );

  fileUtils.replaceContentInFile(
    logger,
    /(versionCode)[\s]+[\d.]+/,
    `versionCode ${androidVersionCode}`,
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

import { Jimp } from 'jimp';

async function generateAdaptiveForeground(
  srcImage: any,
  targetWidth: number,
  targetHeight: number,
  cornerColor: number,
  legacyLauncherPath: string,
  foregroundPath: string,
  monochromePath?: string
): Promise<void> {
  try {
    // Calculate Safe Zone dimensions (72dp / 108dp = 66.67%)
    const safeWidth = Math.round(targetWidth * (72 / 108));
    const safeHeight = Math.round(targetHeight * (72 / 108));

    const scaledImage = srcImage.clone().resize({ w: safeWidth, h: safeHeight });

    const canvas = new Jimp({ width: targetWidth, height: targetHeight, color: cornerColor });
    const x = Math.round((targetWidth - safeWidth) / 2);
    const y = Math.round((targetHeight - safeHeight) / 2);
    canvas.composite(scaledImage, x, y);

    // Overwrite legacy ic_launcher.png with clean 100% scaled image directly from source icon
    const legacyCleanImage = srcImage.clone().resize({ w: targetWidth, h: targetHeight });
    await legacyCleanImage.write(legacyLauncherPath as any);

    await canvas.write(foregroundPath as any);
    if (monochromePath) {
      await canvas.write(monochromePath as any);
    }
  } catch (e) {}
}

export async function generateAppIcon(logger: any, appIconPath: string | undefined, projectData: any): Promise<void> {
  if (!appIconPath) return;

  const projectDir = projectData?.projectDir || process.cwd();
  const fullAppIconPath = path.join(projectDir, appIconPath);
  if (!fs.existsSync(fullAppIconPath)) return;

  logger.info(`-o[NeoEnv]o--> Found "App Icon" at "${appIconPath}". Re-generating...`);

  const cmd = `ns resources generate icons ${fullAppIconPath}`;
  try {
    childProcess.execSync(cmd, { stdio: 'ignore' });

    // Load source icon once for high performance
    const srcImage = await Jimp.read(fullAppIconPath);
    const cornerColor = srcImage.getPixelColor(0, 0);
    const hexColor = '#' + (cornerColor >>> 8).toString(16).padStart(6, '0').toUpperCase();

    const androidResDir = path.join(projectDir, 'App_Resources', 'Android', 'src', 'main', 'res');
    if (fs.existsSync(androidResDir)) {
      // Synchronize values/ic_launcher_background.xml color
      const bgXmlPath = path.join(androidResDir, 'values', 'ic_launcher_background.xml');
      if (fs.existsSync(bgXmlPath)) {
        try {
          const xmlContent = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${hexColor}</color>\n</resources>\n`;
          fs.writeFileSync(bgXmlPath, xmlContent, 'utf8');
        } catch (e) {}
      }

      // Generate Android 8+ Adaptive Icons (foreground & monochrome) with 66.7% safe zone padding
      const mipmapDirs = fs.readdirSync(androidResDir).filter((d) => d.startsWith('mipmap-'));
      for (const mipmapDir of mipmapDirs) {
        const dirPath = path.join(androidResDir, mipmapDir);
        const legacyLauncherPath = path.join(dirPath, 'ic_launcher.png');
        const foregroundPath = path.join(dirPath, 'ic_launcher_foreground.png');
        const monochromePath = path.join(dirPath, 'ic_launcher_monochrome.png');

        if (fs.existsSync(legacyLauncherPath)) {
          try {
            const legacyImg = await Jimp.read(legacyLauncherPath);
            await generateAdaptiveForeground(
              srcImage,
              legacyImg.bitmap.width,
              legacyImg.bitmap.height,
              cornerColor,
              legacyLauncherPath,
              foregroundPath,
              fs.existsSync(monochromePath) ? monochromePath : undefined
            );
          } catch (e) {}
        }
      }
    }

    logger.info(`-o[NeoEnv]o--> Done generating app icon (including Android 8+ Adaptive Icons)`);
  } catch (error) {
    throw new Error(`-o[NeoEnv]o--x Error generating app icon: ${error}`);
  }
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

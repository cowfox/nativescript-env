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

  // Keep source project files (nativescript.config.ts / package.json) untouched on disk.
  // We only update Node CLI memory and compiled target platform files under platforms/

  // 3. Sync applicationId in platforms/android/app/build.gradle
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

  // 4. Sync package in platforms/android/app/src/main/AndroidManifest.xml
  const manifestPath = path.join(projectDir, 'platforms', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (fs.existsSync(manifestPath)) {
    try {
      let manifestContent = fs.readFileSync(manifestPath, 'utf8');
      const newManifestContent = manifestContent.replace(/(package=\s*['"])[^'"]+(['"])/, `$1${resolvedId}$2`);
      if (newManifestContent !== manifestContent) {
        fs.writeFileSync(manifestPath, newManifestContent, 'utf8');
      }
    } catch (e) {}
  }
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
      logger.info(`-o[NeoEnv]o--> Done generating app icon`);
    } catch (error) {
      throw new Error(`-o[NeoEnv]o--x Error generating app icon: ${error}`);
    }
  }
}

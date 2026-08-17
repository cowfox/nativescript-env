import * as path from 'path';
import * as fs from 'fs';
import semverGt = require('semver/functions/gt');
import SemVer = require('semver/classes/semver');
import { EnvironmentRulesContent, getPlatformValue } from './env-rules';
import * as fileUtils from './file';

export interface VersionCodeResult {
  error: boolean;
  errorMessage?: string;
  versionCode?: string;
}

/**
 * Check if "version 1" is beyond "version 2".
 */
export function versionBumped(version1: string, version2: string): boolean {
  return semverGt(version1, version2);
}

/**
 * Generate a "Version Code" based on the given "Version #" and "Build #".
 */
export function generateVersionCode(versionString: string, buildNumberString: string): VersionCodeResult {
  const version = new SemVer(versionString);

  if (version.minor > 99) {
    return {
      error: true,
      errorMessage: 'The "Minor #" of the version could not exceed "99"! Consider bumping the "Major #"?',
      versionCode: undefined
    };
  }

  if (version.patch > 99) {
    return {
      error: true,
      errorMessage: 'The "Patch #" of the version could not exceed "99"! Consider bumping the "Minor #"?',
      versionCode: undefined
    };
  }

  if (+buildNumberString > 99) {
    return {
      error: true,
      errorMessage: 'The "Build #" could not exceed "99"! Consider bumping the "Version #"?',
      versionCode: undefined
    };
  }

  const versionCodeString = parseInt(
    [...versionString.split('.'), buildNumberString]
      .map((part) => part.padStart(2, '0'))
      .join('')
  ).toString();

  return {
    error: false,
    errorMessage: undefined,
    versionCode: versionCodeString
  };
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

  if (versionBumped(envRulesContent.version, versionFromPackageJson)) {
    throw new Error(`-o[NeoEnv]o--x Previous building version "${envRulesContent.version}" is beyond "package.json" version "${versionFromPackageJson}". Please check.`);
  }

  if (versionBumped(versionFromPackageJson, envRulesContent.version)) {
    envRulesContent.version = versionFromPackageJson;
    envRulesContent.buildNumber = {
      ios: '1',
      android: '1'
    };
    logger.info(`[NeoEnv] 🏷️  Version Info    -> Updated to "${envRulesContent.version}", reset build # to "1"`);
  } else {
    if (inReleaseMode) {
      const nextBuildNum = (+currentBuildNum + 1).toString();
      const prevIos = getPlatformValue(envRulesContent.buildNumber, 'ios', currentBuildNum);
      const prevAndroid = getPlatformValue(envRulesContent.buildNumber, 'android', currentBuildNum);

      envRulesContent.buildNumber = {
        ios: platform === 'ios' ? nextBuildNum : prevIos,
        android: platform === 'android' ? nextBuildNum : prevAndroid
      };
      logger.info(`[NeoEnv] 🏷️  Version Info    -> "${envRulesContent.version}" (Build: "${nextBuildNum}" for ${platform})`);
    } else {
      logger.info(`[NeoEnv] 🏷️  Version Info    -> "${envRulesContent.version}" (Build: "${currentBuildNum}" [Dev Mode - Skipped Auto-Bump])`);
    }
  }

  const activeBuildNum = getPlatformValue(envRulesContent.buildNumber, platform, '1');
  const autoVersionCode = envRulesContent.autoVersionCode === true;
  if (!inReleaseMode) {
    return envRulesContent;
  }

  if (autoVersionCode) {
    const result = generateVersionCode(envRulesContent.version, activeBuildNum);
    if (result.error) {
      throw new Error(`[NeoEnv] ❌ Could not generate Version Code: ${result.errorMessage}`);
    } else {
      const prevIosVerCode = getPlatformValue(envRulesContent.versionCode, 'ios', result.versionCode!);
      const prevAndroidVerCode = getPlatformValue(envRulesContent.versionCode, 'android', result.versionCode!);

      envRulesContent.versionCode = {
        ios: platform === 'ios' ? result.versionCode! : prevIosVerCode,
        android: platform === 'android' ? result.versionCode! : prevAndroidVerCode
      };
    }
    const currentPlatformVerCode = getPlatformValue(envRulesContent.versionCode, platform);
    logger.info(`[NeoEnv] 🔢 Version Code   -> "${currentPlatformVerCode}" (Version: "${envRulesContent.version}", Build: "${activeBuildNum}")`);
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

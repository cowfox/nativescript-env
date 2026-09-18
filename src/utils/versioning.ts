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

  const currentPlatform = (platform || 'android').toLowerCase();
  const otherPlatform = currentPlatform === 'ios' ? 'android' : 'ios';

  const currentPlatformVersion = getPlatformValue(envRulesContent.version, currentPlatform, '1.0.0');
  const otherPlatformVersion = getPlatformValue(envRulesContent.version, otherPlatform, currentPlatformVersion);

  const currentPlatformBuildNum = getPlatformValue(envRulesContent.buildNumber, currentPlatform, '1');
  const otherPlatformBuildNum = getPlatformValue(envRulesContent.buildNumber, otherPlatform, '1');

  if (!envRulesContent.version || !currentPlatformBuildNum) {
    throw new Error(`-o[NeoEnv]o--x Could not find related "Version Info" from "Env Rules" file! Please ensure "version", "buildNumber", and "versionCode" are defined.`);
  }

  if (versionBumped(currentPlatformVersion, versionFromPackageJson)) {
    throw new Error(`-o[NeoEnv]o--x Previous building version "${currentPlatformVersion}" is beyond "package.json" version "${versionFromPackageJson}". Please check.`);
  }

  const isCurrentPlatformBumped = versionBumped(versionFromPackageJson, currentPlatformVersion);

  if (isCurrentPlatformBumped) {
    const newCurrentPlatformVersion = versionFromPackageJson;
    const newCurrentPlatformBuildNum = '1';

    if (newCurrentPlatformVersion === otherPlatformVersion) {
      envRulesContent.version = newCurrentPlatformVersion;
    } else {
      envRulesContent.version = {
        [currentPlatform]: newCurrentPlatformVersion,
        [otherPlatform]: otherPlatformVersion
      };
    }

    envRulesContent.buildNumber = {
      [currentPlatform]: newCurrentPlatformBuildNum,
      [otherPlatform]: otherPlatformBuildNum
    };
    logger.info(`[NeoEnv] 🏷️  Version Info    -> Updated to "${newCurrentPlatformVersion}" for ${currentPlatform}, reset build # to "1"`);
  } else {
    if (inReleaseMode) {
      const nextBuildNum = (+currentPlatformBuildNum + 1).toString();

      envRulesContent.buildNumber = {
        [currentPlatform]: nextBuildNum,
        [otherPlatform]: otherPlatformBuildNum
      };
      logger.info(`[NeoEnv] 🏷️  Version Info    -> "${currentPlatformVersion}" (Build: "${nextBuildNum}" for ${currentPlatform})`);
    } else {
      logger.info(`[NeoEnv] 🏷️  Version Info    -> "${currentPlatformVersion}" (Build: "${currentPlatformBuildNum}" [Dev Mode - Skipped Auto-Bump])`);
    }
  }

  const activeBuildNum = getPlatformValue(envRulesContent.buildNumber, currentPlatform, '1');
  const activeVersion = getPlatformValue(envRulesContent.version, currentPlatform, '1.0.0');
  const autoVersionCode = envRulesContent.autoVersionCode === true;
  if (!inReleaseMode) {
    return envRulesContent;
  }

  if (autoVersionCode) {
    const result = generateVersionCode(activeVersion, activeBuildNum);
    if (result.error) {
      throw new Error(`[NeoEnv] ❌ Could not generate Version Code: ${result.errorMessage}`);
    } else {
      const prevOtherVerCode = getPlatformValue(envRulesContent.versionCode, otherPlatform, result.versionCode!);

      envRulesContent.versionCode = {
        [currentPlatform]: result.versionCode!,
        [otherPlatform]: prevOtherVerCode
      };
    }
    const currentPlatformVerCode = getPlatformValue(envRulesContent.versionCode, currentPlatform);
    logger.info(`[NeoEnv] 🔢 Version Code   -> "${currentPlatformVerCode}" (Version: "${activeVersion}", Build: "${activeBuildNum}")`);
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
  const androidVersionName = getPlatformValue(envRulesContent.version, 'android');

  fileUtils.replaceContentInFile(
    logger,
    /(versionName)[\s\d."]+"/,
    `versionName "${androidVersionName}"`,
    gradleFile
  );

  fileUtils.replaceContentInFile(
    logger,
    /(versionCode)[\s]+[\d.]+/,
    `versionCode ${androidVersionCode}`,
    gradleFile
  );
}

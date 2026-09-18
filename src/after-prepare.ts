import * as path from 'path';
import * as fs from 'fs';
import * as plist from 'plist';
import * as envRulesUtils from './utils/env-rules';
import * as fileUtils from './utils/file';
import * as processes from './utils/processes';

export = async function ($logger: any, $projectData: any, hookArgs: any) {
  if (process.env.NEO_ENV_AFTER_HOOK_RUNNING === 'true') {
    return;
  }
  process.env.NEO_ENV_AFTER_HOOK_RUNNING = 'true';

  const platformNameFromHookArgs = hookArgs && (hookArgs.platform || (hookArgs.prepareData && hookArgs.prepareData.platform));
  const platformName = (platformNameFromHookArgs || '').toLowerCase();
  const projectName = $projectData.projectName;

  const envRulesFilePath = envRulesUtils.getEnvRulesFilePath(
    'environment-rules.yaml',
    $projectData.projectDir
  );
  const envRulesContent = envRulesUtils.readEnvRules(envRulesFilePath);

  $logger.debug?.(`[NeoEnv] 🧹 After prepare hook running on platform: "${platformName}"`);

  const platformFolderPath = path.join($projectData.platformsDir, platformName);
  const platformVersionCode = envRulesUtils.getPlatformValue(envRulesContent.versionCode, platformName);
  const platformVersionName = envRulesUtils.getPlatformValue(envRulesContent.version, platformName);

  if (platformName === 'ios') {
    const projectInfoPlistPath = path.join(
      platformFolderPath,
      `${projectName}/${projectName}-Info.plist`
    );
    if (fs.existsSync(projectInfoPlistPath)) {
      let infoPlistContent: any = plist.parse(fs.readFileSync(projectInfoPlistPath, 'utf8'));

      infoPlistContent['CFBundleShortVersionString'] = platformVersionName;
      infoPlistContent['CFBundleVersion'] = platformVersionCode;

      fs.writeFileSync(projectInfoPlistPath, plist.build(infoPlistContent));
    }
  } else if (platformName === 'android') {
    const projectAndroidManifestPath = path.join(platformFolderPath, 'app/src/main/AndroidManifest.xml');

    fileUtils.replaceContentInFile(
      $logger,
      /(android:versionName=")[\d.]+(")/,
      `$1${platformVersionName}$2`,
      projectAndroidManifestPath
    );

    fileUtils.replaceContentInFile(
      $logger,
      /(android:versionCode=")[\d.]+(")/,
      `$1${platformVersionCode}$2`,
      projectAndroidManifestPath
    );
  }

  $logger.debug?.(`[NeoEnv] 🧹 Updated native build manifest version to "${platformVersionName}" (${platformVersionCode})`);

  if (platformName === 'android') {
    let matchPatternStr = envRulesContent.envFilesMatchRules;
    if (!matchPatternStr && envRulesContent.environments?.length) {
      matchPatternStr = envRulesContent.environments.map((e) => e.name).join('|');
    }
    const deleteMatchPattern = matchPatternStr
      ? new RegExp(`[\\w?].*\\.(${matchPatternStr})[$|\\..*]`)
      : /[\w?].*\.(development|dev|test|uat|staging|sta|alpha|beta|release|prod|production)[$|\\..*]/;
    const targetFolderPath = path.join(platformFolderPath, 'app');

    $logger.info(`-o[NeoEnv]o--> Deleting unused env files from "${targetFolderPath}"`);
    fileUtils.detectAndDeleteEnvFiles($logger, targetFolderPath, deleteMatchPattern);
  }

  // Restore original project configuration files (nativescript.config.ts / package.json)
  processes.restoreAppBundleIdBackup($logger, $projectData);

  // Reset flag for future hook runs
  delete process.env.NEO_ENV_HOOK_RUNNING;
};

import * as path from 'path';
import * as fs from 'fs';
import * as plist from 'plist';
import * as envRulesUtils from './utils/env-rules';
import * as fileUtils from './utils/file';

export = async function ($logger: any, $projectData: any, hookArgs: any) {
  const platformNameFromHookArgs = hookArgs && (hookArgs.platform || (hookArgs.prepareData && hookArgs.prepareData.platform));
  const platformName = (platformNameFromHookArgs || '').toLowerCase();
  const projectName = $projectData.projectName;

  const envRulesFilePath = envRulesUtils.getEnvRulesFilePath(
    `environment-rules.${platformName}.json`,
    $projectData.projectDir
  );
  const envRulesContent = envRulesUtils.readEnvRules(envRulesFilePath);

  $logger.info(`-o[NeoEnv]o--> After "prepare" hook - updating "version info" on platform: "${platformName}"`);

  const platformFolderPath = path.join($projectData.platformsDir, platformName);
  if (platformName === 'ios') {
    const projectInfoPlistPath = path.join(
      platformFolderPath,
      `${projectName}/${projectName}-Info.plist`
    );
    if (fs.existsSync(projectInfoPlistPath)) {
      let infoPlistContent: any = plist.parse(fs.readFileSync(projectInfoPlistPath, 'utf8'));

      infoPlistContent['CFBundleShortVersionString'] = envRulesContent.version;
      infoPlistContent['CFBundleVersion'] = envRulesContent.versionCode;

      fs.writeFileSync(projectInfoPlistPath, plist.build(infoPlistContent));
    }
  } else if (platformName === 'android') {
    const projectAndroidManifestPath = path.join(platformFolderPath, 'app/src/main/AndroidManifest.xml');

    fileUtils.replaceContentInFile(
      $logger,
      /(android:versionName=")[\d.]+(")/,
      `$1${envRulesContent.version}$2`,
      projectAndroidManifestPath
    );

    fileUtils.replaceContentInFile(
      $logger,
      /(android:versionCode=")[\d.]+(")/,
      `$1${envRulesContent.versionCode}$2`,
      projectAndroidManifestPath
    );
  }

  $logger.info(`-o[NeoEnv]o--> Updated version "${envRulesContent.version}" with version code "${envRulesContent.versionCode}"`);

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
};

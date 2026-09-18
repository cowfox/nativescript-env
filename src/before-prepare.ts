import * as path from 'path';
import * as envRulesUtils from './utils/env-rules';
import { findEnvEntry, resolveMatchRules } from './utils/env-rules';
import * as processes from './utils/processes';

const DEFAULT_ENV_NAME = 'development';

export = async function (
  $logger: any,
  $platformsDataService: any,
  $projectData: any,
  hookArgs: any,
  $androidResourcesMigrationService?: any
) {
  if (process.env.NEO_ENV_HOOK_RUNNING === 'true') {
    return;
  }
  process.env.NEO_ENV_HOOK_RUNNING = 'true';
  delete process.env.NEO_ENV_AFTER_HOOK_RUNNING;
  delete process.env.NEO_ENV_AFTER_BUILD_DONE;

  const platformName = hookArgs?.prepareData?.platform?.toLowerCase() || '';
  const platformData = $platformsDataService.getPlatformData(platformName, $projectData);

  const appResourcesFolder = path.join($projectData.appResourcesDirectoryPath, platformData.normalizedPlatformName);

  const envRulesFilePath = envRulesUtils.getEnvRulesFilePath(
    'environment-rules.yaml',
    $projectData.projectDir
  );
  $logger.debug(`-o[NeoEnv]o--> Target "Env Rules" file path: ${envRulesFilePath}`);
  let envRulesContent = envRulesUtils.readEnvRules(envRulesFilePath);

  const fallbackDefaultEnv = envRulesContent.default || DEFAULT_ENV_NAME;

  const appBuildingInfo = {
    release: false,
    envName: fallbackDefaultEnv
  };

  $logger.debug('hookArgs.prepareData', hookArgs?.prepareData);
  if (hookArgs?.prepareData?.env && typeof hookArgs.prepareData.env === 'object') {
    appBuildingInfo.envName =
      hookArgs.prepareData.env.use && typeof hookArgs.prepareData.env.use === 'object'
        ? Object.keys(hookArgs.prepareData.env.use)[0]
        : fallbackDefaultEnv;
  }
  if (hookArgs?.prepareData) {
    appBuildingInfo.release = hookArgs.prepareData.release === true;
  }

  $logger.info(`[NeoEnv] 🌿 Active Environment -> "${appBuildingInfo.envName}"`);

  const directCopyRules = envRulesContent.directCopyRules || {};
  const envEntry = findEnvEntry(envRulesContent.environments, appBuildingInfo.envName);
  if (!envEntry) {
    throw new Error(`-o[NeoEnv]o--x Unable to find entry for env: ${appBuildingInfo.envName}`);
  }

  // Smart default for matchRules if omitted
  const matchRules = resolveMatchRules(envEntry);

  // Step 1 - App Bundle ID
  processes.updateAppBundleId($logger, envEntry.appBundleId, $projectData, platformData, appResourcesFolder);

  // Step 2 - Versioning
  envRulesContent = processes.updateVersioning($logger, appBuildingInfo.release, envRulesContent, $projectData, platformData.platformNameLowerCase);
  if (platformData.platformNameLowerCase === 'android') {
    processes.saveVersioningToAndroidGradle($logger, appResourcesFolder, envRulesContent);
  }

  // Step 3 - File Copy
  processes.copyAppResources($logger, appResourcesFolder, matchRules, directCopyRules, $projectData);
  processes.copyExtraFolders($logger, envRulesContent.extraPaths, matchRules, directCopyRules, $projectData);

  // Step 4 - App Icon
  await processes.generateAppIcon($logger, envRulesContent.appIconPath, $projectData);

  // Save updated "Env Rules"
  envRulesUtils.saveEnvRules(envRulesFilePath, envRulesContent);
};

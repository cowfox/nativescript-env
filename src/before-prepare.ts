import * as path from 'path';
import * as fs from 'fs';
import * as envRulesUtils from './utils/env-rules';
import * as processes from './utils/processes';

const DEFAULT_ENV_NAME = 'development';

export = async function (
  $logger: any,
  $platformsDataService: any,
  $projectData: any,
  hookArgs: any,
  $androidResourcesMigrationService?: any
) {
  const platformName = hookArgs?.prepareData?.platform?.toLowerCase() || '';
  const platformData = $platformsDataService.getPlatformData(platformName, $projectData);
  const appBuildingInfo = {
    release: false,
    envName: DEFAULT_ENV_NAME
  };

  $logger.debug('hookArgs.prepareData', hookArgs?.prepareData);
  if (hookArgs?.prepareData?.env && typeof hookArgs.prepareData.env === 'object') {
    appBuildingInfo.envName =
      hookArgs.prepareData.env.use && typeof hookArgs.prepareData.env.use === 'object'
        ? Object.keys(hookArgs.prepareData.env.use)[0]
        : DEFAULT_ENV_NAME;
  }
  if (hookArgs?.prepareData) {
    appBuildingInfo.release = hookArgs.prepareData.release === true;
  }

  $logger.info(`-o[NeoEnv]o--> Using env: ${appBuildingInfo.envName}`);

  const appResourcesFolder = path.join($projectData.appResourcesDirectoryPath, platformData.normalizedPlatformName);

  const envRulesFilePath = envRulesUtils.getEnvRulesFilePath(
    `environment-rules.${platformData.platformNameLowerCase}.json`,
    $projectData.projectDir
  );
  $logger.debug(`-o[NeoEnv]o--> Target "Env Rules" file path: ${envRulesFilePath}`);
  let envRulesContent = envRulesUtils.readEnvRules(envRulesFilePath);

  const directCopyRules = envRulesContent.directCopyRules || {};
  const envEntry = envRulesContent.environments.find((env) => env.name === appBuildingInfo.envName);
  if (!envEntry) {
    throw new Error(`-o[NeoEnv]o--x Unable to find entry for env: ${appBuildingInfo.envName}`);
  }

  // Smart default for matchRules if omitted
  const matchRules = envEntry.matchRules || `([\\w?].*)(\\.${envEntry.name})($|\\..*)`;

  // Step 1 - App Bundle ID
  processes.updateAppBundleId($logger, envEntry.appBundleId, $projectData, platformData, appResourcesFolder);

  // Step 2 - Versioning
  envRulesContent = processes.updateVersioning($logger, appBuildingInfo.release, envRulesContent, $projectData);
  if (platformData.platformNameLowerCase === 'android') {
    processes.saveVersioningToAndroidGradle($logger, appResourcesFolder, envRulesContent);
  }

  // Step 3 - File Copy
  processes.copyAppResources($logger, appResourcesFolder, matchRules, directCopyRules, $projectData);
  processes.copyExtraFolders($logger, envRulesContent.extraPaths, matchRules, directCopyRules, $projectData);

  // Step 4 - App Icon
  processes.generateAppIcon($logger, envRulesContent.appIconPath, $projectData);

  // Save updated "Env Rules"
  fs.writeFileSync(envRulesFilePath, JSON.stringify(envRulesContent, null, 4));
};

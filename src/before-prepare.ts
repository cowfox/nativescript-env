import * as path from 'path';
import * as fs from 'fs';
import * as envRulesUtils from './utils/env-rules';
import * as processes from './utils/processes';

const DEFAULT_ENV_NAME = 'development';

function resolveMatchRules(envEntry: any): string {
  if (envEntry.matchRules) {
    return envEntry.matchRules;
  }
  const name = (envEntry.name || '').toLowerCase();
  if (name === 'development' || name === 'dev') {
    return `([\\w?].*)(\\.(?:dev|development))($|\\..*)`;
  }
  if (name === 'release' || name === 'production' || name === 'prod') {
    return `([\\w?].*)(\\.(?:release|production|prod))($|\\..*)`;
  }
  if (name === 'staging' || name === 'stg') {
    return `([\\w?].*)(\\.(?:staging|stg))($|\\..*)`;
  }
  return `([\\w?].*)(\\.${envEntry.name})($|\\..*)`;
}

function findEnvEntry(environments: any[], envName: string): any {
  if (!environments || !Array.isArray(environments)) return null;
  const target = (envName || '').toLowerCase();
  return environments.find((env) => {
    const name = (env.name || '').toLowerCase();
    if (name === target) return true;
    if (target === 'dev' && name === 'development') return true;
    if (target === 'development' && name === 'dev') return true;
    if (target === 'prod' && (name === 'production' || name === 'release')) return true;
    if (target === 'release' && (name === 'production' || name === 'prod')) return true;
    if (target === 'stg' && name === 'staging') return true;
    if (target === 'staging' && name === 'stg') return true;
    return false;
  });
}

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

  const platformName = hookArgs?.prepareData?.platform?.toLowerCase() || '';
  const platformData = $platformsDataService.getPlatformData(platformName, $projectData);

  const appResourcesFolder = path.join($projectData.appResourcesDirectoryPath, platformData.normalizedPlatformName);

  const envRulesFilePath = envRulesUtils.getEnvRulesFilePath(
    `environment-rules.${platformData.platformNameLowerCase}.json`,
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

  $logger.info(`-o[NeoEnv]o--> Using env: ${appBuildingInfo.envName}`);

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

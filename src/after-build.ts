import * as path from 'path';
import * as envRulesUtils from './utils/env-rules';
import {
  collectAndroidArtifacts,
  collectIosArtifacts,
  printArtifactsSummary,
  isReleaseBuild
} from './utils/artifacts';

let lastRunTimestamp = 0;

export = async function ($logger: any, $projectData: any, hookArgs?: any) {
  // Prevent duplicate execution within the same CLI run (debounce within 2 seconds)
  const now = Date.now();
  if (now - lastRunTimestamp < 2000) {
    return;
  }
  lastRunTimestamp = now;

  try {
    const projectDir = $projectData?.projectDir || process.cwd();
    const projectName = $projectData?.projectName;

    const envRulesFilePath = envRulesUtils.getEnvRulesFilePath(
      'environment-rules.yaml',
      projectDir
    );
    const envRulesContent = envRulesUtils.readEnvRules(envRulesFilePath);

    // 1. Detect platform
    const argv = process.argv.map((a) => a.toLowerCase());
    const buildData = hookArgs?.buildData || hookArgs?.prepareData;
    let platform = (
      hookArgs?.platform ||
      buildData?.platform ||
      (argv.includes('ios') ? 'ios' : argv.includes('android') ? 'android' : '')
    ).toLowerCase();

    // 2. Detect active environment
    const fallbackDefaultEnv = envRulesContent.default || 'development';
    let envName = fallbackDefaultEnv;

    if (buildData?.env && typeof buildData.env === 'object') {
      if (buildData.env.use && typeof buildData.env.use === 'object') {
        envName = Object.keys(buildData.env.use)[0];
      } else if (buildData.env.use && typeof buildData.env.use === 'string') {
        envName = buildData.env.use;
      }
    } else {
      for (const arg of process.argv) {
        if (arg.startsWith('--env.use.')) {
          envName = arg.replace('--env.use.', '');
          break;
        } else if (arg.startsWith('--env.use=')) {
          envName = arg.replace('--env.use=', '');
          break;
        }
      }
    }

    const isRelease = isReleaseBuild(hookArgs, process.argv);
    if (!isRelease) {
      $logger.debug?.('[NeoEnv] ℹ️ Skipping artifact collection: not a release build (debug or device run mode).');
      return;
    }

    $logger.info?.(`[NeoEnv] 📦 Processing release build artifacts (platform: "${platform}", env: "${envName}")...`);

    if (platform === 'android' || !platform) {
      const androidRes = collectAndroidArtifacts(
        $logger,
        projectDir,
        envRulesContent,
        envName,
        projectName
      );
      if (androidRes && androidRes.items.length > 0) {
        printArtifactsSummary($logger, androidRes);
      }
    }

    if (platform === 'ios' || !platform) {
      const iosRes = collectIosArtifacts(
        $logger,
        projectDir,
        envRulesContent,
        envName,
        projectName
      );
      if (iosRes && iosRes.items.length > 0) {
        printArtifactsSummary($logger, iosRes);
      }
    }
  } catch (err: any) {
    $logger.warn?.(`[NeoEnv] ⚠️ Failed to collect release artifacts: ${err?.message || err}`);
  }
};

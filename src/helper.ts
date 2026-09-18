import { findEnvEntry, getEnvRulesFilePath, readEnvRules } from './utils/env-rules';

export interface GetAppIdOptions {
  projectDir?: string;
  defaultId?: string;
  platform?: 'android' | 'ios';
  envName?: string;
}

/**
 * Resolves the App Bundle ID for the current build environment from environment-rules.<platform>.json or environment-rules.json
 *
 * @param projectDir Optional project root directory (defaults to process.cwd())
 * @param defaultId Optional fallback App ID if matching environment rule is not found
 */
export function getAppId(projectDir?: string, defaultId?: string): string;
export function getAppId(options?: GetAppIdOptions): string;
export function getAppId(projectDirOrOptions?: string | GetAppIdOptions, fallbackId?: string): string {
  let projectDir = process.cwd();
  let defaultId = fallbackId;
  let explicitPlatform: 'android' | 'ios' | undefined;
  let explicitEnvName: string | undefined;

  if (typeof projectDirOrOptions === 'string') {
    projectDir = projectDirOrOptions;
  } else if (typeof projectDirOrOptions === 'object' && projectDirOrOptions !== null) {
    if (projectDirOrOptions.projectDir) projectDir = projectDirOrOptions.projectDir;
    if (projectDirOrOptions.defaultId) defaultId = projectDirOrOptions.defaultId;
    if (projectDirOrOptions.platform) explicitPlatform = projectDirOrOptions.platform;
    if (projectDirOrOptions.envName) explicitEnvName = projectDirOrOptions.envName;
  }

  // 1. Detect platform from CLI args (android or ios)
  const args = process.argv.map(arg => arg.toLowerCase());
  let platform: 'android' | 'ios' = explicitPlatform || 'android';
  if (args.includes('ios')) {
    platform = 'ios';
  } else if (args.includes('android')) {
    platform = 'android';
  }

  // 2. Detect envName from CLI args
  let envName = explicitEnvName;

  if (!envName) {
    for (const arg of process.argv) {
      if (arg.startsWith('--env.use.')) {
        envName = arg.replace('--env.use.', '');
        break;
      } else if (arg.startsWith('--env.use=')) {
        envName = arg.replace('--env.use=', '');
        break;
      } else if (arg.startsWith('--env.') && !arg.startsWith('--env.use')) {
        envName = arg.replace('--env.', '');
        break;
      }
    }
  }

  // 3. Read environment rules file
  try {
    const envRulesFilePath = getEnvRulesFilePath('environment-rules.yaml', projectDir);
    const envRulesContent = readEnvRules(envRulesFilePath);

    if (!envName) {
      envName = envRulesContent.default || 'development';
    }

    const envEntry = findEnvEntry(envRulesContent.environments, envName);
    if (envEntry && envEntry.appBundleId) {
      if (typeof envEntry.appBundleId === 'string') {
        return envEntry.appBundleId;
      } else if (typeof envEntry.appBundleId === 'object' && envEntry.appBundleId !== null) {
        const platformId = envEntry.appBundleId[platform] || envEntry.appBundleId.default;
        if (platformId) return platformId;
      }
    }
  } catch (_err) {}

  return defaultId || '';
}

/**
 * Alias for getAppId
 */
export const getEnvAppId = getAppId;

import * as path from 'path';
import * as fs from 'fs';

export interface EnvironmentEntry {
  name: string;
  appBundleId: string | { android?: string; ios?: string; default?: string; [key: string]: any };
  matchRules?: string;
  [key: string]: any;
}

export interface EnvironmentRulesContent {
  version?: string;
  buildNumber?: string;
  versionCode?: string;
  autoVersionCode?: boolean;
  default?: string;
  extraPaths?: string[];
  envFilesMatchRules?: string;
  directCopyRules?: Record<string, string>;
  appIconPath?: string;
  environments: EnvironmentEntry[];
  [key: string]: any;
}

/**
 * Get the full path to the "Env Rules" file.
 * In v1.0.0+, it enforces a unified `environment-rules.json` file.
 */
export function getEnvRulesFilePath(envRulesFilename: string, projectFolderPath: string): string {
  const unifiedPath = path.join(projectFolderPath, 'environment-rules.json');
  if (fs.existsSync(unifiedPath)) {
    return unifiedPath;
  }

  const androidRules = path.join(projectFolderPath, 'environment-rules.android.json');
  const iosRules = path.join(projectFolderPath, 'environment-rules.ios.json');
  if (fs.existsSync(androidRules) || fs.existsSync(iosRules)) {
    throw new Error(
      `-o[NeoEnv]o--x DEPRECATION NOTICE: Separate 'environment-rules.android.json' and 'environment-rules.ios.json' files are deprecated in v1.0.0+. Please merge your configuration into a single 'environment-rules.json' file. See README for details.`
    );
  }

  return unifiedPath;
}

/**
 * Load contents from the "Env Rules" file.
 */
export function readEnvRules(envRulesFileFullPath: string): EnvironmentRulesContent {
  if (fs.existsSync(envRulesFileFullPath)) {
    return JSON.parse(fs.readFileSync(envRulesFileFullPath, 'utf8'));
  } else {
    throw new Error(`-o[NeoEnv]o--x "environment-rules.json" file does not exist at "${envRulesFileFullPath}"! Please check...`);
  }
}

import * as path from 'path';
import * as fs from 'fs';

export interface EnvironmentEntry {
  name: string;
  appBundleId: string | { android?: string; ios?: string; default?: string; [key: string]: any };
  matchRules: string;
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
 * The file is under the "root folder" of the app project.
 *
 * If the target file does not exist, fall back to default - `environment-rules.json`.
 */
export function getEnvRulesFilePath(envRulesFilename: string, projectFolderPath: string): string {
  const envRulesFileFullPath = path.join(projectFolderPath, envRulesFilename);
  if (fs.existsSync(envRulesFileFullPath)) {
    return envRulesFileFullPath;
  } else {
    return path.join(projectFolderPath, 'environment-rules.json');
  }
}

/**
 * Load contents from the "Env Rules" file.
 */
export function readEnvRules(envRulesFileFullPath: string): EnvironmentRulesContent {
  if (fs.existsSync(envRulesFileFullPath)) {
    return JSON.parse(fs.readFileSync(envRulesFileFullPath, 'utf8'));
  } else {
    throw new Error(`-o[NeoEnv]o--x "Environment Rules" file does not exist at "${envRulesFileFullPath}"! Please check...`);
  }
}

import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

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
 * Supports environment-rules.yaml, environment-rules.yml, or environment-rules.json.
 */
export function getEnvRulesFilePath(envRulesFilename: string, projectFolderPath: string): string {
  const possibleNames = ['environment-rules.yaml', 'environment-rules.yml', 'environment-rules.json'];

  for (const name of possibleNames) {
    const fullPath = path.join(projectFolderPath, name);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  const androidRules = path.join(projectFolderPath, 'environment-rules.android.json');
  const iosRules = path.join(projectFolderPath, 'environment-rules.ios.json');
  if (fs.existsSync(androidRules) || fs.existsSync(iosRules)) {
    throw new Error(
      `-o[NeoEnv]o--x DEPRECATION NOTICE: Separate 'environment-rules.android.json' and 'environment-rules.ios.json' files are deprecated in v1.0.0+. Please merge your configuration into 'environment-rules.yaml' or 'environment-rules.json'.`
    );
  }

  return path.join(projectFolderPath, 'environment-rules.yaml');
}

/**
 * Load contents from the "Env Rules" file (supports YAML and JSON).
 */
export function readEnvRules(envRulesFileFullPath: string): EnvironmentRulesContent {
  if (!fs.existsSync(envRulesFileFullPath)) {
    throw new Error(
      `-o[NeoEnv]o--x Environment rules file does not exist at "${envRulesFileFullPath}"! Please check or run 'npx wuneo-env init' to generate a template configuration.`
    );
  }

  const fileContent = fs.readFileSync(envRulesFileFullPath, 'utf8');
  if (envRulesFileFullPath.endsWith('.yaml') || envRulesFileFullPath.endsWith('.yml')) {
    return yaml.load(fileContent) as EnvironmentRulesContent;
  } else {
    return JSON.parse(fileContent);
  }
}

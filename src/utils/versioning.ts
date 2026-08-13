import semverGt = require('semver/functions/gt');
import SemVer = require('semver/classes/semver');

export interface VersionCodeResult {
  error: boolean;
  errorMessage?: string;
  versionCode?: string;
}

/**
 * Check if "version 1" is beyond "version 2".
 */
export function versionBumped(version1: string, version2: string): boolean {
  return semverGt(version1, version2);
}

/**
 * Generate a "Version Code" based on the given "Version #" and "Build #".
 */
export function generateVersionCode(versionString: string, buildNumberString: string): VersionCodeResult {
  const version = new SemVer(versionString);

  if (version.minor > 99) {
    return {
      error: true,
      errorMessage: 'The "Minor #" of the version could not exceed "99"! Consider bumping the "Major #"?',
      versionCode: undefined
    };
  }

  if (version.patch > 99) {
    return {
      error: true,
      errorMessage: 'The "Patch #" of the version could not exceed "99"! Consider bumping the "Minor #"?',
      versionCode: undefined
    };
  }

  if (+buildNumberString > 99) {
    return {
      error: true,
      errorMessage: 'The "Build #" could not exceed "99"! Consider bumping the "Version #"?',
      versionCode: undefined
    };
  }

  const versionCodeString = parseInt(
    [...versionString.split('.'), buildNumberString]
      .map((part) => part.padStart(2, '0'))
      .join('')
  ).toString();

  return {
    error: false,
    errorMessage: undefined,
    versionCode: versionCodeString
  };
}

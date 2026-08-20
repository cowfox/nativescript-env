/**
 * Facade Module: processes.ts
 *
 * Re-exports modularized processes for backward compatibility:
 * - Bundle ID management: ./bundle-id
 * - App Icon & Splash generation: ./icon
 * - Versioning management: ./versioning
 * - File copying helpers: ./file
 */

export {
  updateAppBundleId,
  restoreAppBundleIdBackup
} from './bundle-id';

export {
  generateAppIcon,
  generateAdaptiveForeground,
  adjustSplashLogoSafeZone
} from './icon';

export {
  updateVersioning,
  saveVersioningToAndroidGradle
} from './versioning';

export {
  copyAppResources,
  copyExtraFolders
} from './file';

export {
  collectAndroidArtifacts,
  collectIosArtifacts,
  printArtifactsSummary,
  resolveArtifactsConfig
} from './artifacts';

import * as path from 'path';
import * as fs from 'fs';

export function detectAndCopyEnvFiles(
  logger: any,
  folderFullPath: string,
  matchRulesString: string,
  directCopyRules: Record<string, string>,
  projectData: any
): void {
  if (!fs.existsSync(folderFullPath)) return;

  const matchRules = new RegExp(matchRulesString);
  const dirContents = fs.readdirSync(folderFullPath);

  const testEnvFileToCopy = (parentPath: string, item: string) => {
    const itemPath = path.join(parentPath, item);

    try {
      if (fs.statSync(itemPath) && fs.statSync(itemPath).isDirectory()) {
        fs.readdirSync(itemPath).forEach((deeperItem) =>
          testEnvFileToCopy(path.join(parentPath, item), deeperItem)
        );
      } else {
        logger.debug?.('[NeoEnv] 🔍 Checking file:', item);
        if (matchRules.test(item)) {
          const destinationFileName = buildDestinationFileName(logger, item, matchRules);
          const destinationFilePath = path.join(parentPath, destinationFileName);

          if (!doesSourceMatchDestination(logger, itemPath, destinationFilePath)) {
            fs.writeFileSync(destinationFilePath, fs.readFileSync(itemPath));
          } else {
            logger.debug?.('[NeoEnv] ℹ️ Destination matches source, skipping write.');
          }

          if (directCopyRules && Object.keys(directCopyRules).includes(destinationFileName)) {
            const relTarget = directCopyRules[destinationFileName];
            const destinationTargetFilePath = path.join(projectData.projectDir, relTarget);
            fs.writeFileSync(destinationTargetFilePath, fs.readFileSync(itemPath));
            logger.info(`[NeoEnv] ⚡ Swapped & Deployed -> "${item}" => "${relTarget}"`);
          } else {
            logger.info(`[NeoEnv] 📄 Swapped         -> "${item}" => "${destinationFileName}"`);
          }
        }
      }
    } catch (_error) {}
  };

  dirContents.forEach((item) => testEnvFileToCopy(folderFullPath, item));
}

export function detectAndDeleteEnvFiles(logger: any, folderFullPath: string, matchRulesString: RegExp | string): void {
  if (!fs.existsSync(folderFullPath)) return;

  const matchRules = typeof matchRulesString === 'string' ? new RegExp(matchRulesString) : matchRulesString;
  const dirContents = fs.readdirSync(folderFullPath);

  const testForFileToDelete = (parentPath: string, item: string) => {
    const itemPath = path.join(parentPath, item);

    try {
      if (fs.statSync(itemPath) && fs.statSync(itemPath).isDirectory()) {
        fs.readdirSync(itemPath).forEach((deeperItem) =>
          testForFileToDelete(path.join(parentPath, item), deeperItem)
        );
      } else {
        if (matchRules.test(item)) {
          logger.info?.('[NeoEnv] 🧹 Deleted env variant:', itemPath);
          fs.unlinkSync(itemPath);
        }
      }
    } catch (_error) {}
  };

  dirContents.forEach((item) => testForFileToDelete(folderFullPath, item));
}

export function replaceContentInFile(logger: any, pattern: RegExp, replacement: string, filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      let fileContent = fs.readFileSync(filePath, 'utf8');
      if (pattern.test(fileContent)) {
        fileContent = fileContent.replace(pattern, replacement);
        fs.writeFileSync(filePath, fileContent);
      }
    } else {
      throw new Error(`-o[NeoEnv]o--x Could not find the file to update: "${filePath}"`);
    }
  } catch (error: any) {
    throw new Error(`-o[NeoEnv]o--x Error when updating the file: "${filePath}" with ERROR: ${JSON.stringify(error)}`);
  }
}

export function buildDestinationFileName(logger: any, file: string, regex: RegExp): string {
  const matches = file.match(regex);
  if (Array.isArray(matches) && matches.length >= 4) {
    const base = matches[1];
    const ext = matches[matches.length - 1];
    return `${base}${ext}`;
  } else {
    const rawPattern = regex.source || String(regex);
    const cleanPattern = rawPattern.replace(/^\/|\/$/g, '');
    const suffixRegex = new RegExp(`\\.(${cleanPattern})(?=\\.|$)`, 'i');
    if (suffixRegex.test(file)) {
      return file.replace(suffixRegex, '');
    }

    const fileNameParts = file.split('.');
    if (fileNameParts.length <= 2) {
      return fileNameParts[0];
    }
    const ext = fileNameParts[fileNameParts.length - 1];
    const fileName = fileNameParts.slice(0, fileNameParts.length - 2).join('.');
    return `${fileName}.${ext}`;
  }
}

export function doesSourceMatchDestination(logger: any, sourcePath: string, destinationPath: string): boolean {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`-o[NeoEnv]o--x Source file "${sourcePath}" does not exist!`);
  }

  if (!fs.existsSync(destinationPath)) {
    logger.debug?.(`-o[NeoEnv]o--x Destination file "${destinationPath}" does not exist!`);
    return false;
  }

  const sourceFileContents = fs.readFileSync(sourcePath);
  const destinationFileContents = fs.readFileSync(destinationPath);

  return sourceFileContents.equals(destinationFileContents);
}

export function copyAppResources(
  logger: any,
  appResourcesFolder: string,
  matchRulesString: string,
  directCopyRules: Record<string, string>,
  projectData: any
): void {
  detectAndCopyEnvFiles(logger, appResourcesFolder, matchRulesString, directCopyRules, projectData);
}

export function copyExtraFolders(
  logger: any,
  extraPaths: string[] | undefined,
  matchRulesString: string,
  directCopyRules: Record<string, string>,
  projectData: any
): void {
  if (!extraPaths) return;
  extraPaths.forEach((folderPath) => {
    const cachedDir = projectData.$projectHelper?.cachedProjectDir || projectData.projectDir;
    const folderFullPath = folderPath.indexOf(cachedDir) < 0
      ? path.join(cachedDir, folderPath)
      : folderPath;

    detectAndCopyEnvFiles(logger, folderFullPath, matchRulesString, directCopyRules, projectData);
  });
}

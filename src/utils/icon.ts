import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import { Jimp } from 'jimp';

export async function generateAdaptiveForeground(
  srcImage: any,
  targetWidth: number,
  targetHeight: number,
  cornerColor: number,
  legacyLauncherPath: string,
  foregroundPath: string,
  monochromePath?: string,
  backgroundPath?: string,
  legacySize?: number
): Promise<void> {
  try {
    // Calculate Safe Zone dimensions (72dp / 108dp = 66.67%)
    const safeWidth = Math.round(targetWidth * (72 / 108));
    const safeHeight = Math.round(targetHeight * (72 / 108));

    const scaledImage = srcImage.clone().resize({ w: safeWidth, h: safeHeight });

    // Android Adaptive Icon foreground layer must have a transparent background (background is in ic_launcher_background.xml or ic_launcher_background.png)
    const canvas = new Jimp({ width: targetWidth, height: targetHeight, color: 0x00000000 });
    const x = Math.round((targetWidth - safeWidth) / 2);
    const y = Math.round((targetHeight - safeHeight) / 2);
    canvas.composite(scaledImage, x, y);

    // Overwrite legacy ic_launcher.png with clean 100% scaled image directly from source icon
    const legacyWidth = legacySize || Math.round(targetWidth * (48 / 108));
    const legacyHeight = legacySize || Math.round(targetHeight * (48 / 108));
    const legacyCleanImage = srcImage.clone().resize({ w: legacyWidth, h: legacyHeight });
    await legacyCleanImage.write(legacyLauncherPath as any);

    await canvas.write(foregroundPath as any);
    if (monochromePath) {
      await canvas.write(monochromePath as any);
    }
    if (backgroundPath) {
      const bgCanvas = new Jimp({ width: targetWidth, height: targetHeight, color: cornerColor });
      await bgCanvas.write(backgroundPath as any);
    }
  } catch (e) {}
}

/**
 * Adjusts the Android 12+ Splash logo to fit completely inside the circular viewport.
 *
 * Android 12+ (API 31+) SplashScreen uses a 160dp circular mask with an inner safe area of 115dp.
 * For any square master icon to fit fully inside the circular safe zone:
 * Target Size: size * sqrt(2) <= safeDiameter => size <= (canvasWidth * 115 / 160) / sqrt(2) ~= 0.50 * canvasWidth.
 */
export async function adjustSplashLogoSafeZone(
  splashLogoPath: string,
  srcImage?: any,
  defaultSize: number = 840
): Promise<void> {
  try {
    let w = defaultSize;
    let h = defaultSize;

    if (fs.existsSync(splashLogoPath)) {
      const img = await Jimp.read(splashLogoPath);
      w = img.bitmap.width;
      h = img.bitmap.height;
    }

    // Scale master icon to ~48% (fits comfortably inside the 115dp/160dp circular viewport with margin)
    const safeRatio = (115 / (160 * Math.SQRT2)) * 0.95; // ~0.482
    const targetW = Math.round(w * safeRatio);
    const targetH = Math.round(h * safeRatio);

    const baseImage = srcImage ? srcImage.clone() : (await Jimp.read(splashLogoPath));
    const scaled = baseImage.resize({ w: targetW, h: targetH });

    const canvas = new Jimp({ width: w, height: h, color: 0x00000000 });
    const offX = Math.round((w - targetW) / 2);
    const offY = Math.round((h - targetH) / 2);
    canvas.composite(scaled, offX, offY);

    await canvas.write(splashLogoPath as any);
  } catch (e) {}
}

export async function generateAppIcon(logger: any, appIconPath: string | undefined, projectData: any): Promise<void> {
  if (!appIconPath) return;

  const projectDir = projectData?.projectDir || process.cwd();
  const fullAppIconPath = path.join(projectDir, appIconPath);
  if (!fs.existsSync(fullAppIconPath)) return;

  const cmd = `ns resources generate icons ${fullAppIconPath}`;
  try {
    childProcess.execSync(cmd, { stdio: 'ignore' });

    // Load source icon once for high performance
    const srcImage = await Jimp.read(fullAppIconPath);
    const cornerColor = srcImage.getPixelColor(0, 0);
    const hexColor = '#' + (cornerColor >>> 8).toString(16).padStart(6, '0').toUpperCase();

    const androidResDir = path.join(projectDir, 'App_Resources', 'Android', 'src', 'main', 'res');
    if (fs.existsSync(androidResDir)) {
      // 1. Synchronize values/ic_launcher_background.xml color
      const valuesDir = path.join(androidResDir, 'values');
      if (!fs.existsSync(valuesDir)) {
        fs.mkdirSync(valuesDir, { recursive: true });
      }
      const bgXmlPath = path.join(valuesDir, 'ic_launcher_background.xml');
      try {
        const xmlContent = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${hexColor}</color>\n</resources>\n`;
        fs.writeFileSync(bgXmlPath, xmlContent, 'utf8');
      } catch (e) {}

      // 2. Generate Android 8+ Adaptive Icons (foreground, background, monochrome, legacy)
      const mipmapDensities: Record<string, number> = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192
      };

      for (const [mipmapDir, legacySize] of Object.entries(mipmapDensities)) {
        const dirPath = path.join(androidResDir, mipmapDir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        const adaptiveSize = Math.round(legacySize * (108 / 48));
        const legacyLauncherPath = path.join(dirPath, 'ic_launcher.png');
        const foregroundPath = path.join(dirPath, 'ic_launcher_foreground.png');
        const monochromePath = path.join(dirPath, 'ic_launcher_monochrome.png');
        const backgroundPath = path.join(dirPath, 'ic_launcher_background.png');

        await generateAdaptiveForeground(
          srcImage,
          adaptiveSize,
          adaptiveSize,
          cornerColor,
          legacyLauncherPath,
          foregroundPath,
          monochromePath,
          backgroundPath,
          legacySize
        );
      }

      // 3. Process splash logos in drawable-* folders to ensure safe circular viewport padding for Android 12+
      const drawableDensities: Record<string, number> = {
        'drawable-mdpi': 210,
        'drawable-hdpi': 315,
        'drawable-xhdpi': 420,
        'drawable-xxhdpi': 630,
        'drawable-xxxhdpi': 840
      };

      for (const [drawableDir, size] of Object.entries(drawableDensities)) {
        const dirPath = path.join(androidResDir, drawableDir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        const splashLogoPath = path.join(dirPath, 'splash_screen_logo.png');
        await adjustSplashLogoSafeZone(splashLogoPath, srcImage, size);
      }
    }

    logger.info(`[NeoEnv] 🖼️  App Icon        -> Generated for "${appIconPath}" (including Android 8+ Adaptive Layers & Android 12+ Splash)`);
  } catch (error) {
    throw new Error(`[NeoEnv] ❌ Error generating app icon: ${error}`);
  }
}

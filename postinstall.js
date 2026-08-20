const path = require('path');
const fs = require('fs');

try {
  require('@nativescript/hook')(__dirname).postinstall();
} catch (_e) {}

try {
  const pkg = require('./package.json');
  const projectDir = process.env.INIT_CWD || process.cwd();

  if (projectDir && pkg.nativescript && pkg.nativescript.hooks) {
    pkg.nativescript.hooks.forEach((h) => {
      const hookDir = path.join(projectDir, 'hooks', h.type);
      if (!fs.existsSync(hookDir)) {
        fs.mkdirSync(hookDir, { recursive: true });
      }
      const hookBaseName = pkg.name.replace(/@/g, '').replace(/\//g, '-');
      const jsFile = path.join(hookDir, `${hookBaseName}.js`);
      const jsContent = `module.exports = require("${pkg.name}/${h.script}");\n`;
      fs.writeFileSync(jsFile, jsContent, 'utf8');
    });
  }
} catch (_err) {}

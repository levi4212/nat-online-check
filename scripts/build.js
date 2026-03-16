const fs = require("fs");
const path = require("path");

const root = process.cwd();
const dist = path.join(root, "dist");

const excludeDirs = new Set([".git", "node_modules", "dist", "scripts"]);
const excludeFiles = new Set([".DS_Store", "config.js", "package.json", "package-lock.json"]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    const name = path.basename(src);
    if (excludeDirs.has(name)) return;
    ensureDir(dest);
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }

  const name = path.basename(src);
  if (excludeFiles.has(name)) return;
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function writeConfig() {
  const email = process.env.CONTACT_EMAIL || "support@example.com";
  const note = process.env.CONTACT_NOTE || "可填写你的实际联系方式";
  const content = `// Auto-generated during build. Do not commit.\nwindow.NATLAB_CONFIG = {\n  contactEmail: "${email}",\n  contactNote: "${note}",\n};\n`;
  fs.writeFileSync(path.join(dist, "config.js"), content, "utf8");
}

function build() {
  fs.rmSync(dist, { recursive: true, force: true });
  ensureDir(dist);
  copyRecursive(root, dist);
  writeConfig();
  console.log(`Built to ${dist}`);
}

build();

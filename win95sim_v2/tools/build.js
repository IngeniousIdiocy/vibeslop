#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');
const crypto = require('crypto');
const esbuild = require('esbuild');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const assetsDir = path.join(distDir, 'assets');

async function clean() {
  await fs.rm(distDir, { recursive: true, force: true });
  console.log('dist/ cleaned');
}

const aliasMap = {
  '@core': path.join(rootDir, 'src/core'),
  '@services': path.join(rootDir, 'src/services'),
  '@ui': path.join(rootDir, 'src/ui'),
  '@apps': path.join(rootDir, 'src/apps'),
  '@shell': path.join(rootDir, 'src/shell'),
  '@features': path.join(rootDir, 'src/features'),
};

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyStaticAssets() {
  const sourceDir = path.join(rootDir, 'src/assets');
  if (!existsSync(sourceDir)) {
    return [];
  }

  const entries = await fs.readdir(sourceDir);
  const copied = [];
  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = path.join(sourceDir, entry);
      const targetPath = path.join(assetsDir, entry);
      const stat = await fs.stat(sourcePath);
      if (stat.isDirectory()) {
        await copyDirectory(sourcePath, targetPath);
      } else {
        await fs.copyFile(sourcePath, targetPath);
      }
      copied.push(`assets/${entry}`);
    }),
  );

  return copied;
}

async function copyIconAssets() {
  const sourceDir = path.join(rootDir, 'icons');
  if (!existsSync(sourceDir)) {
    return [];
  }

  await copyDirectory(sourceDir, path.join(assetsDir, 'icons'));
  const entries = await fs.readdir(sourceDir);
  return entries.map((entry) => `assets/icons/${entry}`);
}

async function copyDirectory(source, target) {
  await ensureDir(target);
  const entries = await fs.readdir(source);
  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = path.join(source, entry);
      const targetPath = path.join(target, entry);
      const stat = await fs.stat(sourcePath);
      if (stat.isDirectory()) {
        await copyDirectory(sourcePath, targetPath);
      } else {
        await fs.copyFile(sourcePath, targetPath);
      }
    }),
  );
}

function createIntegrityHash(fileBuffer) {
  return crypto.createHash('sha256').update(fileBuffer).digest('hex').slice(0, 16);
}

async function writeHtml({ scriptPath, stylePaths }) {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Win95Sim V2</title>
    ${stylePaths
      .map((style) => `    <link rel="stylesheet" href="${style}" />`)
      .join('\n')}
  </head>
  <body>
    <script src="${scriptPath}" defer></script>
  </body>
</html>`;

  await fs.writeFile(path.join(distDir, 'index.html'), html, 'utf8');
}

async function build() {
  await clean();
  await ensureDir(assetsDir);

  const result = await esbuild.build({
    entryPoints: [path.join(rootDir, 'src/main.ts')],
    bundle: true,
    sourcemap: true,
    format: 'iife',
    globalName: 'Win95Sim',
    minify: false,
    outdir: assetsDir,
    entryNames: 'app-[hash]',
    assetNames: 'asset-[hash]',
    loader: { '.css': 'css' },
    alias: aliasMap,
    metafile: true,
  });

  const outputs = Object.entries(result.metafile.outputs);
  const scriptOutput = outputs.find(([, info]) => info.entryPoint);
  if (!scriptOutput) {
    throw new Error('Unable to determine entry script from build outputs');
  }

  const scriptFile = `assets/${path.basename(scriptOutput[0])}`;
  const styleOutputs = outputs
    .filter(([file]) => file.endsWith('.css'))
    .map(([file]) => `assets/${path.basename(file)}`);

  const copiedAssets = [
    ...(await copyStaticAssets()),
    ...(await copyIconAssets()),
  ];

  await writeHtml({ scriptPath: scriptFile, stylePaths: styleOutputs });

  const manifest = {
    script: scriptFile,
    styles: styleOutputs,
    assets: copiedAssets,
  };

  await fs.writeFile(path.join(assetsDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  await Promise.all(
    [scriptFile, ...styleOutputs].map(async (relativePath) => {
      const absolutePath = path.join(distDir, relativePath);
      const fileBuffer = await fs.readFile(absolutePath);
      const hash = createIntegrityHash(fileBuffer);
      const integrityPath = `${absolutePath}.${hash}.sha256`;
      await fs.writeFile(integrityPath, hash, 'utf8');
    }),
  );

  console.log('Build complete');
}

async function main() {
  if (process.argv.includes('--clean')) {
    await clean();
    return;
  }

  await build();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

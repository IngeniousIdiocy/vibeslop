#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');

function resolveRoot(rootDir) {
  if (rootDir) {
    return path.resolve(rootDir);
  }

  return path.resolve(__dirname, '..', '..');
}

function resolveDist(rootDir, distDir) {
  if (!distDir) {
    return path.join(rootDir, 'dist');
  }

  if (path.isAbsolute(distDir)) {
    return distDir;
  }

  return path.join(rootDir, distDir);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readJson(filePath) {
  const contents = await fs.readFile(filePath, 'utf8');
  return JSON.parse(contents);
}

async function readJsonSafe(filePath, fallback) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback;
    }

    throw error;
  }
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function createLicenseBanner({ version, generatedAt, licenseData }) {
  const project = licenseData?.project ?? {};
  const dependencies = Array.isArray(licenseData?.dependencies) ? licenseData.dependencies : [];
  const lines = [
    'Win95Sim V2 release bundle',
    `Version: ${version}`,
    `Generated: ${generatedAt}`,
  ];

  if (project.name || project.license) {
    lines.push('', `${project.name ?? 'Win95Sim V2'} — ${project.license ?? 'UNLICENSED'}`);
  }

  if (dependencies.length) {
    lines.push('', 'Included dependencies:');
    dependencies.forEach((dependency) => {
      const label = dependency.name ?? 'unknown';
      const license = dependency.license ?? 'UNLICENSED';
      const homepage = dependency.homepage ? ` <${dependency.homepage}>` : '';
      lines.push(`- ${label} (${license})${homepage}`);
    });
  }

  return `<!--\n${lines.map((line) => ` ${line}`).join('\n')}\n-->`;
}

async function gatherAssetPayload(distDir, manifest) {
  const styles = await Promise.all(
    (manifest.styles ?? []).map(async (relativePath) => {
      const absolutePath = path.join(distDir, relativePath);
      const content = await fs.readFile(absolutePath, 'utf8');
      return { path: toPosix(relativePath), content };
    }),
  );

  let script;
  if (manifest.script) {
    const scriptPath = path.join(distDir, manifest.script);
    const content = await fs.readFile(scriptPath, 'utf8');
    script = { path: toPosix(manifest.script), content };
  }

  return { styles, script };
}

function renderReleaseHtml({ banner, styles, script }) {
  const styleTags = styles
    .map((style) => `    <style data-source="${style.path}">\n${style.content}\n    </style>`)
    .join('\n');
  const scriptTag = script ? `    <script data-source="${script.path}">\n${script.content}\n    </script>` : '';

  return `${banner}\n<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <meta name="generator" content="win95sim-v2 packager" />\n${styleTags}\n  </head>\n  <body>\n${scriptTag}\n  </body>\n</html>\n`;
}

async function computeFileMetadata(filePath, { relativeTo }) {
  const buffer = await fs.readFile(filePath);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const gzipSize = zlib.gzipSync(buffer).length;
  const brotliSize = zlib.brotliCompressSync(buffer).length;
  const relativePath = toPosix(path.relative(relativeTo, filePath));

  return {
    path: relativePath,
    size: buffer.length,
    sha256,
    gzipSize,
    brotliSize,
  };
}

async function writeAboutData({ aboutPath, version, generatedAt, licenseData, manifest }) {
  const licenses = [];
  if (licenseData?.project) {
    licenses.push({
      name: licenseData.project.name ?? 'Win95Sim V2',
      license: licenseData.project.license ?? 'UNLICENSED',
      homepage: licenseData.project.homepage ?? null,
    });
  }

  if (Array.isArray(licenseData?.dependencies)) {
    licenseData.dependencies.forEach((dependency) => {
      licenses.push({
        name: dependency.name ?? 'unknown',
        license: dependency.license ?? 'UNLICENSED',
        homepage: dependency.homepage ?? null,
      });
    });
  }

  const aboutData = {
    name: licenseData?.project?.name ?? 'Win95Sim V2',
    version,
    generatedAt,
    manifest,
    licenses,
  };

  await ensureDir(path.dirname(aboutPath));
  await fs.writeFile(aboutPath, JSON.stringify(aboutData, null, 2));
  return aboutData;
}

async function packageRelease(options = {}) {
  const rootDir = resolveRoot(options.rootDir);
  const distDir = resolveDist(rootDir, options.distDir);
  const outputName = options.outputName ?? 'win95sim.html';
  const manifestName = options.manifestName ?? 'manifest.json';
  const licensePath = options.licensePath ?? path.join(rootDir, 'docs', 'licenses.json');
  const packageJsonPath = options.packageJsonPath ?? path.join(rootDir, 'package.json');
  const aboutDataPath = options.aboutDataPath ?? path.join(rootDir, 'src/apps/system/about/about.data.json');

  if (!existsSync(distDir)) {
    throw new Error(`Distribution directory not found: ${distDir}`);
  }

  const [licenseData, packageJson] = await Promise.all([
    readJsonSafe(licensePath, {}),
    readJsonSafe(packageJsonPath, {}),
  ]);
  const version = packageJson.version ?? '0.0.0';
  const generatedAt = new Date().toISOString();

  const sourceManifestPath = path.join(distDir, 'assets', 'manifest.json');
  const sourceManifest = await readJsonSafe(sourceManifestPath, null);
  if (!sourceManifest) {
    throw new Error(`Expected build manifest at ${sourceManifestPath}`);
  }

  const assets = await gatherAssetPayload(distDir, sourceManifest);
  const banner = createLicenseBanner({ version, generatedAt, licenseData });
  const releaseHtml = renderReleaseHtml({ banner, styles: assets.styles, script: assets.script });
  const releasePath = path.join(distDir, outputName);
  await fs.writeFile(releasePath, releaseHtml, 'utf8');

  const files = [await computeFileMetadata(releasePath, { relativeTo: distDir })];
  const assetMetadata = [];
  if (assets.script) {
    assetMetadata.push(await computeFileMetadata(path.join(distDir, assets.script.path), { relativeTo: distDir }));
  }
  for (const style of assets.styles) {
    assetMetadata.push(await computeFileMetadata(path.join(distDir, style.path), { relativeTo: distDir }));
  }

  const manifest = {
    version,
    generatedAt,
    files,
    assets: assetMetadata,
    source: sourceManifest,
  };

  await fs.writeFile(path.join(distDir, manifestName), JSON.stringify(manifest, null, 2));
  const aboutData = await writeAboutData({ aboutPath: aboutDataPath, version, generatedAt, licenseData, manifest });

  return { manifest, aboutData, releasePath };
}

async function main() {
  await packageRelease();
  console.log('Release bundle generated.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  packageRelease,
  createLicenseBanner,
  computeFileMetadata,
};

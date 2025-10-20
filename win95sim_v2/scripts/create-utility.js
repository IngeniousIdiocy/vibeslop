#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

function usage() {
  console.error('Usage: node scripts/create-utility.js <Utility Name>');
}

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createFiles(rootDir, slug, title) {
  const targetDir = path.join(rootDir, 'src', 'apps', 'utilities', slug);
  if (fs.existsSync(targetDir)) {
    throw new Error(`Utility folder already exists: ${slug}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const manifestPath = path.join(targetDir, 'manifest.json');
  const manifest = {
    id: slug,
    title,
    entry: `@apps/utilities/${slug}`,
    featureFlag: `utilities.${slug}`,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const indexPath = path.join(targetDir, 'index.ts');
  const typeName = `${title.replace(/\s+/g, '')}AppManifest`;
  const source = `export interface ${typeName} {\n  id: string;\n}\n\nexport function register() {\n  return { id: '${slug}' };\n}\n`;
  fs.writeFileSync(indexPath, source);

  const testPath = path.join(rootDir, 'tests', 'apps', 'utilities', `${slug}.test.ts`);
  if (!fs.existsSync(path.dirname(testPath))) {
    fs.mkdirSync(path.dirname(testPath), { recursive: true });
  }
  const relativeImport = path.relative(path.dirname(testPath), indexPath).replace(/\\/g, '/');
  const testSource = `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { register } from '${relativeImport.replace(/\.ts$/, '')}';\n\ntest('utility ${slug} registers manifest', () => {\n  const manifest = register();\n  assert.equal(manifest.id, '${slug}');\n});\n`;
  fs.writeFileSync(testPath, testSource);
}

function main() {
  const rootDir = path.resolve(__dirname, '..');
  const title = process.argv.slice(2).join(' ').trim();

  if (!title) {
    usage();
    process.exitCode = 1;
    return;
  }

  const slug = slugify(title);
  if (!slug) {
    throw new Error('Unable to derive a slug from the provided utility name');
  }

  createFiles(rootDir, slug, title);
  console.log(`Created utility scaffold at src/apps/utilities/${slug}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

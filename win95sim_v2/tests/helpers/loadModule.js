const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const Module = require('node:module');

const projectRoot = path.resolve(__dirname, '..', '..');
const cacheDir = path.resolve(projectRoot, 'tests', '.cache');
const tsconfig = path.resolve(projectRoot, 'tsconfig.tests.json');

const aliasMap = new Map([
  ['@core', 'core'],
  ['@services', 'services'],
  ['@ui', 'ui'],
  ['@apps', 'apps'],
  ['@shell', 'shell'],
  ['@features', 'features'],
]);

let compiled = false;
let resolverPatched = false;
const overrideModules = new Map();
const overrideDir = path.join(cacheDir, '__overrides');

function ensureCompiled() {
  if (compiled) {
    return;
  }

  const result = spawnSync('npx', ['tsc', '--project', tsconfig], {
    cwd: projectRoot,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const stderr = result.stderr || '';
    if (/error TS\d+/.test(stderr) || result.status === null) {
      throw new Error(`TypeScript compilation failed:\n${stderr}`);
    }
  }

  compiled = true;
  patchModuleResolver();
}

function patchModuleResolver() {
  if (resolverPatched) {
    return;
  }

  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function patchedResolve(request, parent, isMain, options) {
    for (const [alias, target] of aliasMap) {
      if (request === alias || request.startsWith(`${alias}/`)) {
        const suffix = request === alias ? '' : request.slice(alias.length + 1);
        const candidate = path.join(cacheDir, target, suffix);
        const resolved = tryResolve(candidate);
        if (resolved) {
          return resolved;
        }
      }
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (overrideModules.has(request)) {
      return overrideModules.get(request).exports;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  resolverPatched = true;
}

function tryResolve(candidatePath) {
  const withJs = candidatePath.endsWith('.js') ? candidatePath : `${candidatePath}.js`;
  if (isFile(withJs)) {
    return withJs;
  }

  if (isFile(candidatePath)) {
    return candidatePath;
  }

  const indexPath = path.join(candidatePath, 'index.js');
  if (isFile(indexPath)) {
    return indexPath;
  }

  return undefined;
}

function isFile(targetPath) {
  try {
    return fs.statSync(targetPath).isFile();
  } catch (error) {
    return false;
  }
}

function slugify(request) {
  return request.replace(/[^a-zA-Z0-9]+/g, '_');
}

function applyOverrides(overrides) {
  const previous = new Map();
  if (!overrides || Object.keys(overrides).length === 0) {
    return previous;
  }

  fs.mkdirSync(overrideDir, { recursive: true });

  for (const [request, source] of Object.entries(overrides)) {
    previous.set(request, overrideModules.get(request));
    const filePath = path.join(overrideDir, `${slugify(request)}.js`);
    const overrideModule = new Module.Module(filePath, module);
    overrideModule.filename = filePath;
    overrideModule.paths = Module.Module._nodeModulePaths(path.dirname(filePath));
    overrideModule._compile(source, filePath);
    overrideModule.loaded = true;
    overrideModules.set(request, overrideModule);
    require.cache[filePath] = overrideModule;
  }

  return previous;
}

function restoreOverrides(previous) {
  for (const [request, priorModule] of previous.entries()) {
    const current = overrideModules.get(request);
    if (current) {
      delete require.cache[current.filename];
    }

    if (priorModule === undefined) {
      overrideModules.delete(request);
    } else {
      overrideModules.set(request, priorModule);
      require.cache[priorModule.filename] = priorModule;
    }
  }
}

function loadModule(relativePath, options = {}) {
  ensureCompiled();

  const overrides = options.overrides;
  const previousOverrides = applyOverrides(overrides);

  try {
    const compiledPath = path
      .resolve(cacheDir, relativePath.replace(/^src\//, ''))
      .replace(/\.ts$/, '.js');

    if (!fs.existsSync(compiledPath)) {
      throw new Error(`Compiled module not found: ${compiledPath}`);
    }

    delete require.cache[compiledPath];
    return require(compiledPath);
  } finally {
    restoreOverrides(previousOverrides);
  }
}

module.exports = { loadModule };

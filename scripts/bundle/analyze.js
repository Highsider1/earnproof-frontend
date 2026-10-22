#!/usr/bin/env node

/**
 * CI entry point for the client bundle composition gate (issue #82).
 *
 * Usage:
 *   node scripts/bundle/analyze.js                 # analyze an existing build
 *   node scripts/bundle/analyze.js --build         # run the analysis build first
 *   node scripts/bundle/analyze.js --update-baseline
 *
 * A route can sit comfortably inside a total-size budget while quietly
 * accumulating a duplicate copy of a library, pulling in a package nobody
 * approved, or dragging server-only code into the browser. This script makes
 * all three visible and failable:
 *
 *   - per-route client JS budgets, with the owning package named in the
 *     failure message;
 *   - a hard "no two versions of the same package in client chunks" rule;
 *   - an allowlist of packages permitted to reach the browser at all;
 *   - a server-only rule covering Node builtins, non-public `process.env`
 *     reads and secret-shaped literals.
 *
 * Attribution comes from the client source maps Turbopack emits when
 * `ANALYZE_BUNDLE=1` is set (see next.config.ts). A normal `next build`
 * never emits them, so this is analysis-only machinery and nothing about
 * the shipped bundle changes.
 *
 * The machine-readable report is written to
 * `.next/analyze/bundle-report.json`. It contains no file hashes, no
 * timestamps and no absolute paths, and every collection is sorted, so two
 * builds of the same source produce byte-identical output.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const {
  listMeasurableBuildRoutes,
  listSkippedBuildRoutes,
  extractRouteAssetPaths,
} = require("../performance/budget-check");

const {
  attributeChunkBytes,
  compareToBaseline,
  evaluate,
  findDuplicatePackages,
  findServerOnlyLeaks,
  findUnexpectedClientPackages,
  formatReport,
  hashBudgets,
  mergeOwnerBytes,
  resolveOwner,
  sortOwnerBytes,
} = require("./bundle-analysis");

const repoRoot = path.join(__dirname, "..", "..");
const buildDir = path.join(repoRoot, ".next");
const budgetsPath = path.join(__dirname, "budgets.json");
const baselinePath = path.join(__dirname, "baseline.json");
const reportPath = path.join(buildDir, "analyze", "bundle-report.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Run the production build with client source maps enabled. Spawned through
 * Node rather than a shell `ENV=1 next build` prefix so the command works
 * identically on Windows, macOS and Linux.
 */
function runAnalysisBuild() {
  console.log("Running `next build` with ANALYZE_BUNDLE=1 ...");
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "node_modules", "next", "dist", "bin", "next"), "build"],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, ANALYZE_BUNDLE: "1" },
    },
  );
  if (result.status !== 0) {
    console.error("Analysis build failed; cannot analyze bundle composition.");
    process.exit(result.status === null ? 1 : result.status);
  }
}

/** Every emitted client JS file, including chunks only reachable by dynamic import. */
function listClientChunks(dir) {
  const staticDir = path.join(dir, "static");
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) files.push(full);
    }
  };
  walk(staticDir);
  return files;
}

/**
 * Locate a chunk's source map. Turbopack content-hashes the map file
 * independently of the chunk it belongs to, so the `<chunk>.js.map` sibling
 * convention does not hold; the authoritative link is the
 * `sourceMappingURL` comment the chunk itself ends with.
 */
function resolveSourceMapFile(chunkFile, code) {
  const matches = [...code.matchAll(/\/\/#\s*sourceMappingURL=(\S+)/g)];
  if (matches.length === 0) return null;
  const url = matches[matches.length - 1][1];
  if (url.startsWith("data:")) return null;
  return path.resolve(path.dirname(chunkFile), url);
}

/**
 * Read one chunk plus its source map into the shape the pure analysis
 * functions consume. A chunk without a map is still measured (its bytes
 * land under `[unmapped]`) so sizes never silently under-report.
 */
function readChunk(chunkFile, fallbackOwner) {
  const code = fs.readFileSync(chunkFile, "utf8");
  const bytes = fs.statSync(chunkFile).size;
  const mapFile = resolveSourceMapFile(chunkFile, code);
  if (!mapFile || !fs.existsSync(mapFile)) {
    return {
      file: chunkFile,
      bytes,
      fallbackOwner: fallbackOwner || "[unmapped]",
      sources: [],
      sourceLengths: [],
      sourcesContent: [],
    };
  }
  const map = readJson(mapFile);
  const sources = map.sources || [];
  const sourcesContent = map.sourcesContent || [];
  return {
    file: chunkFile,
    bytes,
    sources,
    sourcesContent,
    sourceLengths: sources.map((_, index) => (sourcesContent[index] || "").length),
  };
}

const versionCache = new Map();

/**
 * Resolve the installed version of a package from the `node_modules` path
 * the source map pointed at. Nested installs resolve to their own
 * package.json, which is exactly what makes duplicate detection real rather
 * than a guess from the lockfile.
 */
function resolveInstalledVersion(installDir) {
  if (versionCache.has(installDir)) return versionCache.get(installDir);
  const manifest = path.join(repoRoot, installDir, "package.json");
  let version = null;
  if (fs.existsSync(manifest)) {
    try {
      version = readJson(manifest).version || null;
    } catch {
      version = null;
    }
  }
  versionCache.set(installDir, version);
  return version;
}

function buildClientModuleIndex(chunks, ownerAliases) {
  const modules = [];
  const packageInstances = new Map();
  const packageNames = new Set();
  const unresolvedOwners = new Set();

  for (const chunk of chunks) {
    const chunkName = path.basename(chunk.file);
    for (let i = 0; i < chunk.sources.length; i += 1) {
      const source = chunk.sources[i];
      const resolved = resolveOwner(source, ownerAliases);
      modules.push({
        chunk: chunkName,
        source,
        owner: resolved.owner,
        kind: resolved.kind,
        content: chunk.sourcesContent[i] || "",
      });

      if (resolved.kind === "package") {
        packageNames.add(resolved.owner);
        // A dependency that ships its own bundled source map (resolved
        // through `ownerAliases`) carries no node_modules path, so its
        // version is read from the hoisted install. Such a package can
        // therefore only ever contribute one instance to the duplicate
        // check - noted in scripts/bundle/README.md as a known limit.
        const installDir = resolved.installDir || "node_modules/" + resolved.owner;
        packageInstances.set(resolved.owner + "|" + installDir, {
          name: resolved.owner,
          installDir,
        });
      } else if (resolved.kind === "unknown") {
        unresolvedOwners.add(resolved.owner);
      }
    }
  }

  const instances = [...packageInstances.values()]
    .map((instance) => ({ ...instance, version: resolveInstalledVersion(instance.installDir) }))
    .sort((a, b) => (a.name + a.installDir < b.name + b.installDir ? -1 : 1));

  return {
    modules,
    instances,
    packageNames: [...packageNames].sort(),
    unresolvedOwners: [...unresolvedOwners].sort(),
  };
}

/**
 * Per-route client bundle: the JS a browser actually downloads on a cold
 * visit, read from the prerendered HTML Next.js emits for the route (the
 * same source of truth `scripts/performance` uses, so the two gates can
 * never disagree about what a route loads).
 */
function measureRouteComposition(route, chunkIndexByAsset, ownerAliases) {
  const assetPaths = extractRouteAssetPaths(buildDir, route).filter((assetPath) =>
    assetPath.split("?")[0].endsWith(".js"),
  );

  let clientJsBytes = 0;
  const owners = {};
  let chunkCount = 0;

  for (const assetPath of assetPaths) {
    const relative = assetPath.split("?")[0].replace(/^\/_next\//, "");
    const chunk = chunkIndexByAsset.get(relative);
    if (!chunk) continue;
    chunkCount += 1;
    clientJsBytes += chunk.bytes;
    mergeOwnerBytes(
      owners,
      chunk.sources.length === 0
        ? { [chunk.fallbackOwner]: chunk.bytes }
        : attributeChunkBytes(chunk.bytes, chunk.sources, chunk.sourceLengths, ownerAliases),
    );
  }

  return { clientJsBytes, chunkCount, owners: sortOwnerBytes(owners) };
}

/**
 * Next.js emits its legacy-browser polyfill chunk without a source map, so
 * it can never be attributed from map data. It is named explicitly in
 * `build-manifest.json`, which is a precise, version-stable way to give it
 * an owner instead of leaving 100+ KB of every route unattributed.
 */
function polyfillAssetPaths() {
  const manifestPath = path.join(buildDir, "build-manifest.json");
  if (!fs.existsSync(manifestPath)) return new Set();
  return new Set(readJson(manifestPath).polyfillFiles || []);
}

function buildReport(budgets) {
  const polyfills = polyfillAssetPaths();
  const toAssetPath = (file) => path.relative(buildDir, file).split(path.sep).join("/");
  const chunkFiles = listClientChunks(buildDir);
  const chunks = chunkFiles.map((file) =>
    readChunk(file, polyfills.has(toAssetPath(file)) ? "next (polyfills)" : undefined),
  );
  const chunkIndexByAsset = new Map(chunks.map((chunk) => [toAssetPath(chunk.file), chunk]));

  const ownerAliases = budgets.ownerAliases || {};
  const index = buildClientModuleIndex(chunks, ownerAliases);

  const routes = {};
  for (const route of listMeasurableBuildRoutes(buildDir)) {
    routes[route] = measureRouteComposition(route, chunkIndexByAsset, ownerAliases);
  }
  const skippedRoutes = listSkippedBuildRoutes(buildDir);

  return {
    routes: Object.fromEntries(Object.entries(routes).sort((a, b) => (a[0] < b[0] ? -1 : 1))),
    skippedRoutes,
    packages: index.instances.map((instance) => ({
      name: instance.name,
      version: instance.version,
      installDir: instance.installDir,
    })),
    duplicatePackages: findDuplicatePackages(index.instances),
    unexpectedPackages: findUnexpectedClientPackages(
      index.packageNames,
      budgets.allowedClientPackages,
    ),
    serverOnlyLeaks: findServerOnlyLeaks(index.modules, budgets.serverOnlyPolicy),
    unresolvedOwners: index.unresolvedOwners,
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function main() {
  const args = new Set(process.argv.slice(2));
  const updateBaseline = args.has("--update-baseline");

  if (args.has("--build") || updateBaseline) {
    runAnalysisBuild();
  }

  if (!fs.existsSync(path.join(buildDir, "app-path-routes-manifest.json"))) {
    console.error(
      "No production build found at " +
        buildDir +
        ". Run `node scripts/bundle/analyze.js --build` (or `next build` with " +
        "ANALYZE_BUNDLE=1) before analyzing bundle composition.",
    );
    process.exit(1);
  }

  const budgets = readJson(budgetsPath);
  const report = buildReport(budgets);

  if (report.skippedRoutes.length > 0) {
    console.warn(
      "Skipped routes without prerendered HTML: " + report.skippedRoutes.join(", "),
    );
  }

  const mappedChunks = Object.values(report.routes).reduce(
    (sum, route) => sum + (route.owners["[unmapped]"] ? 1 : 0),
    0,
  );
  if (mappedChunks > 0) {
    console.warn(
      "Warning: some client chunks have no source map, so their bytes are reported " +
        "as [unmapped]. Re-run with `--build` (which sets ANALYZE_BUNDLE=1) for full " +
        "package attribution.",
    );
  }

  if (updateBaseline) {
    const baseline = {
      // Recorded so a reviewer can see which budget revision this baseline
      // was approved against; a budgets.json edit invalidates it.
      budgetsHash: hashBudgets(budgets),
      routes: Object.fromEntries(
        Object.entries(report.routes).map(([route, measurement]) => [
          route,
          { clientJsBytes: measurement.clientJsBytes, owners: measurement.owners },
        ]),
      ),
      packages: report.packages.map((entry) => ({
        name: entry.name,
        version: entry.version,
      })),
    };
    writeJson(baselinePath, baseline);
    console.log("Wrote reviewed baseline to " + path.relative(repoRoot, baselinePath));
    console.log(
      "Commit it together with the budgets.json change it was reviewed against, " +
        "and state the reason in the PR description.",
    );
    return;
  }

  const baseline = fs.existsSync(baselinePath) ? readJson(baselinePath) : null;
  const changes = compareToBaseline(report.routes, baseline, budgets.significantChange);
  const evaluation = evaluate(report, budgets, baseline);

  writeJson(reportPath, {
    ...report,
    significantChanges: changes,
    pass: evaluation.pass,
    failures: evaluation.failures,
  });

  console.log(formatReport(report, evaluation, changes));
  console.log("");
  console.log("Machine-readable report: " + path.relative(repoRoot, reportPath));

  if (!evaluation.pass) {
    process.exit(1);
  }
}

main();

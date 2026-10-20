/**
 * Core, pure logic for the client bundle composition gate.
 *
 * Like `scripts/performance/budget-check.js`, everything in this module is
 * plain CommonJS with no Next.js/DOM dependency and no file system access,
 * so the whole decision surface can be unit tested against synthetic
 * fixtures without running a production build.
 *
 * The analyzer answers four questions a total-size budget cannot:
 *
 *   1. Which packages actually ship in each route's client bundle, and how
 *      many bytes does each own?
 *   2. Is any package present at more than one version (a duplicate)?
 *   3. Did an unexpected package enter the browser bundle at all?
 *   4. Did server-only material — Node builtins, server env references,
 *      secret-shaped literals — leak into a client chunk?
 */

"use strict";

const crypto = require("crypto");

/**
 * Node builtins that must never appear in a browser chunk. Anything
 * prefixed `node:` is caught separately by scheme, so this list only needs
 * the bare specifiers.
 */
const NODE_BUILTINS = new Set([
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "worker_threads",
  "zlib",
]);

/**
 * Environment variables a client bundle is allowed to read. Next.js only
 * inlines `NEXT_PUBLIC_*` and `NODE_ENV` into browser code; a reference to
 * anything else from a module that reached the client graph is a
 * server/client boundary mistake, even when the value happens to be
 * undefined at build time.
 */
const CLIENT_ENV_ALLOWLIST = new Set(["NODE_ENV"]);
const PUBLIC_ENV_PREFIX = "NEXT_PUBLIC_";

const ENV_REFERENCE_PATTERN =
  "process\\s*\\.\\s*env\\s*(?:\\.\\s*([A-Za-z_$][\\w$]*)|\\[\\s*[\"'`]([^\"'`]+)[\"'`]\\s*\\])";

/**
 * Strip the sourcemap URL scheme Turbopack emits (`turbopack:///[project]/...`)
 * so the rest of the module can reason about plain paths. Sources that use a
 * different scheme (a dependency shipping its own bundled sourcemap, e.g.
 * `webpack://freighterApi/...`) are returned untouched and resolved through
 * the explicit `ownerAliases` map instead of being guessed at.
 */
function stripScheme(source) {
  const schemeMatch = /^[a-z0-9.+-]+:\/\/\/?/i.exec(source);
  return schemeMatch ? source.slice(schemeMatch[0].length) : source;
}

function packageNameFromSegments(segments) {
  if (segments.length === 0) return null;
  if (segments[0].startsWith("@")) {
    return segments.length > 1 ? segments[0] + "/" + segments[1] : segments[0];
  }
  return segments[0];
}

/**
 * Attribute one sourcemap source to the thing that owns it.
 *
 * `kind` is what the budget rules key off:
 *   - `package`     - a third-party dependency (`owner` is the npm name)
 *   - `first-party` - this repo's own code (`owner` is the top-level dir)
 *   - `runtime`     - the bundler's own browser runtime
 *   - `unknown`     - anything the rules above could not classify; treated
 *                     as a hard failure rather than silently ignored
 *
 * `installDir` is set for packages resolved out of a real `node_modules`
 * path and is what the duplicate-version check resolves a version from; it
 * accounts for nesting (`node_modules/a/node_modules/b`) by always taking
 * the *last* `node_modules` segment.
 */
function resolveOwner(source, ownerAliases = {}) {
  for (const [prefix, owner] of Object.entries(ownerAliases)) {
    if (source.startsWith(prefix)) {
      return { owner, kind: "package", installDir: null, source };
    }
  }

  const stripped = stripScheme(source);

  if (stripped.startsWith("[turbopack]")) {
    return { owner: "[turbopack-runtime]", kind: "runtime", installDir: null, source };
  }

  const marker = "node_modules/";
  const lastNodeModules = stripped.lastIndexOf(marker);
  if (lastNodeModules !== -1) {
    const after = stripped.slice(lastNodeModules + marker.length);
    const name = packageNameFromSegments(after.split("/").filter(Boolean));
    if (name) {
      const projectRelative = stripped.replace(/^\[project\]\//, "");
      const prefixEnd = projectRelative.lastIndexOf(marker) + marker.length;
      return {
        owner: name,
        kind: "package",
        installDir: projectRelative.slice(0, prefixEnd) + name,
        source,
      };
    }
  }

  if (stripped.startsWith("[project]/")) {
    const rest = stripped.slice("[project]/".length);
    const top = rest.split("/")[0] || rest;
    return { owner: top, kind: "first-party", installDir: null, source };
  }

  return {
    owner: "unresolved:" + source.split("/")[0],
    kind: "unknown",
    installDir: null,
    source,
  };
}

/**
 * Split a chunk's real on-disk byte size across its owners, weighted by how
 * many bytes of original source each owner contributed.
 *
 * Minified output cannot be attributed exactly (one identifier can come from
 * several modules), so this is a proportional estimate - but it is a
 * *deterministic* one: the same build always produces the same numbers,
 * which is what makes the report diffable and the baseline meaningful. The
 * rounding remainder is folded into the largest owner so per-chunk shares
 * always sum to exactly `chunkBytes`.
 */
function attributeChunkBytes(chunkBytes, sources, sourceLengths, ownerAliases = {}) {
  if (sources.length === 0) {
    return { "[unmapped]": chunkBytes };
  }

  const weights = new Map();
  let total = 0;
  for (let i = 0; i < sources.length; i += 1) {
    const { owner } = resolveOwner(sources[i], ownerAliases);
    // A zero-length source still represents a real module; give it a weight
    // of 1 so it never disappears from the composition entirely.
    const weight = Math.max(1, sourceLengths[i] || 0);
    weights.set(owner, (weights.get(owner) || 0) + weight);
    total += weight;
  }

  const owners = {};
  let assigned = 0;
  let largestOwner = null;
  let largestWeight = -1;
  const sortedOwners = [...weights.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (const [owner, weight] of sortedOwners) {
    const bytes = Math.round((chunkBytes * weight) / total);
    owners[owner] = bytes;
    assigned += bytes;
    if (weight > largestWeight) {
      largestWeight = weight;
      largestOwner = owner;
    }
  }

  if (largestOwner !== null && assigned !== chunkBytes) {
    owners[largestOwner] += chunkBytes - assigned;
  }

  return owners;
}

function mergeOwnerBytes(target, addition) {
  for (const [owner, bytes] of Object.entries(addition)) {
    target[owner] = (target[owner] || 0) + bytes;
  }
  return target;
}

/** Sort an owner->bytes map into a stable, largest-first plain object. */
function sortOwnerBytes(owners) {
  return Object.fromEntries(
    Object.entries(owners).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)),
  );
}

/**
 * A package is a duplicate when the client graph contains more than one
 * distinct installed version of it. Instances are compared by resolved
 * version, not by install path, so a hoisted copy and a nested copy of the
 * *same* version are correctly treated as one.
 */
function findDuplicatePackages(instances) {
  const byName = new Map();
  for (const instance of instances) {
    if (!instance.version) continue;
    if (!byName.has(instance.name)) byName.set(instance.name, new Map());
    const versions = byName.get(instance.name);
    if (!versions.has(instance.version)) versions.set(instance.version, new Set());
    versions.get(instance.version).add(instance.installDir);
  }

  const duplicates = [];
  const names = [...byName.keys()].sort();
  for (const name of names) {
    const versions = byName.get(name);
    if (versions.size < 2) continue;
    duplicates.push({
      package: name,
      versions: [...versions.keys()].sort().map((version) => ({
        version,
        installDirs: [...versions.get(version)].sort(),
      })),
    });
  }
  return duplicates;
}

/**
 * Every third-party package that reaches the browser must be named in
 * `allowedClientPackages`. This is dependency *ownership*, not size: a new
 * package showing up in a client chunk is a reviewable event even when it
 * is small.
 */
function findUnexpectedClientPackages(packageNames, allowedClientPackages) {
  const allowed = new Set(allowedClientPackages || []);
  return [...packageNames].filter((name) => !allowed.has(name)).sort();
}

function isNodeBuiltinSpecifier(specifier) {
  if (specifier.startsWith("node:")) return true;
  return NODE_BUILTINS.has(specifier.split("/")[0]);
}

/**
 * Detect server-only material that reached a client chunk.
 *
 * Two independent signals are used, because either one alone has a blind
 * spot: module *paths* catch a server-only file or package being pulled
 * into the graph, and module *contents* catch a server-only environment
 * read or secret-shaped literal inside an otherwise legitimate shared file.
 */
function findServerOnlyLeaks(modules, policy = {}) {
  const serverOnlyPackages = new Set(policy.serverOnlyPackages || []);
  const pathPatterns = (policy.serverOnlyPathPatterns || []).map((p) => new RegExp(p));
  const secretPatterns = (policy.secretPatterns || []).map((p) => new RegExp(p));
  const extraEnvAllowlist = new Set(policy.allowedClientEnv || []);
  // The `process.env` scan is deliberately scoped to first-party modules.
  // Framework internals legitimately read build-time flags Next inlines
  // (`__NEXT_*`, `NEXT_RUNTIME`); those are the bundler's own compile-time
  // switches, not this app's server/client boundary. The boundary this gate
  // owns - and the one that leaks secrets - is our own code.
  const envScanKinds = new Set(policy.envScanKinds || ["first-party"]);
  const envReference = new RegExp(ENV_REFERENCE_PATTERN, "g");

  const leaks = [];
  const seen = new Set();
  const record = (leak) => {
    const key = leak.type + "|" + leak.source + "|" + leak.detail;
    if (seen.has(key)) return;
    seen.add(key);
    leaks.push(leak);
  };

  for (const mod of modules) {
    const stripped = stripScheme(mod.source);

    if (stripped.startsWith("node:")) {
      record({
        type: "node-builtin",
        source: mod.source,
        detail: stripped.split("/")[0],
        chunk: mod.chunk,
      });
    } else if (mod.kind === "package" && isNodeBuiltinSpecifier(mod.owner)) {
      record({ type: "node-builtin", source: mod.source, detail: mod.owner, chunk: mod.chunk });
    }

    if (serverOnlyPackages.has(mod.owner)) {
      record({
        type: "server-only-package",
        source: mod.source,
        detail: mod.owner,
        chunk: mod.chunk,
      });
    }

    for (const pattern of pathPatterns) {
      if (pattern.test(stripped)) {
        record({
          type: "server-only-module",
          source: mod.source,
          detail: pattern.source,
          chunk: mod.chunk,
        });
      }
    }

    const content = mod.content || "";
    if (!content) continue;

    if (envScanKinds.has(mod.kind)) {
      envReference.lastIndex = 0;
      let envMatch = envReference.exec(content);
      while (envMatch !== null) {
        const name = envMatch[1] || envMatch[2];
        if (
          name &&
          !name.startsWith(PUBLIC_ENV_PREFIX) &&
          !CLIENT_ENV_ALLOWLIST.has(name) &&
          !extraEnvAllowlist.has(name)
        ) {
          record({
            type: "server-env-reference",
            source: mod.source,
            detail: "process.env." + name,
            chunk: mod.chunk,
          });
        }
        envMatch = envReference.exec(content);
      }
    }

    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        record({
          type: "secret-material",
          source: mod.source,
          // Only the matching *rule* is reported, never the matched text -
          // echoing a suspected secret into CI logs would be the very leak
          // this check exists to prevent.
          detail: pattern.source,
          chunk: mod.chunk,
        });
      }
    }
  }

  return leaks;
}

/** Deterministic JSON: object keys sorted recursively, so hashes are stable. */
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortValue(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(sortValue(value));
}

/** Stable hash of the budget document, used to tie a baseline to a budget revision. */
function hashBudgets(budgets) {
  return crypto.createHash("sha256").update(canonicalJson(budgets)).digest("hex");
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Governance gate: a budget number is only meaningful if changing it is a
 * reviewed act.
 *
 * Two rules, both mechanical:
 *   1. Every explicit route budget carries a non-empty `reason` and an ISO
 *      `reviewedOn` date, so the diff that raises a budget also states why.
 *   2. `baseline.json` records the hash of the budgets it was reviewed
 *      against. Editing `budgets.json` without regenerating the baseline
 *      (`npm run bundle:baseline`) breaks the hash and fails the check, so a
 *      budget change can never land without the reviewed baseline change
 *      that goes with it.
 */
function validateGovernance(budgets, baseline) {
  const problems = [];

  for (const [route, budget] of Object.entries(budgets.routes || {})) {
    if (!budget.reason || String(budget.reason).trim().length === 0) {
      problems.push({
        type: "missing-reason",
        detail:
          'Route budget "' +
          route +
          '" has no "reason". Every budget must state why it is set where it is.',
      });
    }
    if (!budget.reviewedOn || !ISO_DATE_PATTERN.test(String(budget.reviewedOn))) {
      problems.push({
        type: "missing-review-date",
        detail: 'Route budget "' + route + '" needs a "reviewedOn" date in YYYY-MM-DD form.',
      });
    }
  }

  if (!baseline || typeof baseline !== "object") {
    problems.push({
      type: "missing-baseline",
      detail: "No reviewed baseline found. Run `npm run bundle:baseline` and commit the result.",
    });
    return problems;
  }

  const expected = hashBudgets(budgets);
  if (baseline.budgetsHash !== expected) {
    problems.push({
      type: "stale-baseline",
      detail:
        "budgets.json changed without a matching reviewed baseline. Re-run " +
        "`npm run bundle:baseline` so the budget change and the baseline it was " +
        "reviewed against land in the same diff (expected budgetsHash " +
        expected +
        ").",
    });
  }

  return problems;
}

function resolveRouteBudget(budgets, route) {
  const override = (budgets.routes && budgets.routes[route]) || {};
  return { ...budgets.defaults, ...override };
}

/**
 * Compare this build's route sizes against the reviewed baseline and report
 * every change large enough to be worth a human look. Drift is reported,
 * not failed, on purpose: the hard gates are the budgets, the duplicate
 * rule, the allowlist and the server-only rule. Drift is the signal that
 * says "look at this PR's bundle", which is what the issue asks CI to
 * surface.
 */
function compareToBaseline(routes, baseline, thresholds = {}) {
  const minBytes = typeof thresholds.minBytes === "number" ? thresholds.minBytes : 5120;
  const minPercent = typeof thresholds.minPercent === "number" ? thresholds.minPercent : 2;
  const baseRoutes = (baseline && baseline.routes) || {};

  const changes = [];
  const allRoutes = new Set([...Object.keys(routes), ...Object.keys(baseRoutes)]);
  for (const route of [...allRoutes].sort()) {
    const current = routes[route];
    const previous = baseRoutes[route];

    if (!current) {
      changes.push({
        route,
        type: "removed",
        baselineBytes: previous.clientJsBytes,
        currentBytes: 0,
      });
      continue;
    }
    if (!previous) {
      changes.push({
        route,
        type: "added",
        baselineBytes: 0,
        currentBytes: current.clientJsBytes,
      });
      continue;
    }

    const delta = current.clientJsBytes - previous.clientJsBytes;
    if (delta === 0) continue;
    const percent =
      previous.clientJsBytes === 0 ? 100 : (delta / previous.clientJsBytes) * 100;
    if (Math.abs(delta) < minBytes && Math.abs(percent) < minPercent) continue;

    changes.push({
      route,
      type: delta > 0 ? "grew" : "shrank",
      baselineBytes: previous.clientJsBytes,
      currentBytes: current.clientJsBytes,
      deltaBytes: delta,
      deltaPercent: Math.round(percent * 100) / 100,
    });
  }
  return changes;
}

/**
 * Turn a composition report plus budgets/baseline into the final pass/fail
 * decision. Pure data in, pure data out - this is the function the unit
 * tests drive directly, including every failure path.
 */
function evaluate(report, budgets, baseline) {
  const failures = [];

  for (const problem of validateGovernance(budgets, baseline)) {
    failures.push({ category: "governance", ...problem });
  }

  const routeEntries = Object.entries(report.routes).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (const [route, measurement] of routeEntries) {
    const budget = resolveRouteBudget(budgets, route);
    if (
      typeof budget.clientJsBytes === "number" &&
      measurement.clientJsBytes > budget.clientJsBytes
    ) {
      const top = Object.entries(measurement.owners).sort((a, b) => b[1] - a[1])[0] || [
        "(none)",
        0,
      ];
      failures.push({
        category: "route-budget",
        route,
        detail:
          "client JS " +
          measurement.clientJsBytes +
          " B exceeds budget " +
          budget.clientJsBytes +
          " B by " +
          (measurement.clientJsBytes - budget.clientJsBytes) +
          " B - largest owner: " +
          top[0] +
          " (" +
          top[1] +
          " B)",
      });
    }
  }

  for (const duplicate of report.duplicatePackages || []) {
    failures.push({
      category: "duplicate-dependency",
      detail:
        duplicate.package +
        " ships " +
        duplicate.versions.length +
        " versions in client chunks: " +
        duplicate.versions.map((entry) => entry.version).join(", "),
    });
  }

  for (const name of report.unexpectedPackages || []) {
    failures.push({
      category: "unexpected-client-package",
      detail: name + " is in a client chunk but is not in allowedClientPackages",
    });
  }

  for (const leak of report.serverOnlyLeaks || []) {
    failures.push({
      category: "server-only-leak",
      detail: leak.type + ": " + leak.detail + " (from " + leak.source + ")",
    });
  }

  for (const owner of report.unresolvedOwners || []) {
    failures.push({
      category: "unattributed-module",
      detail:
        owner +
        " could not be attributed to a package or to first-party code. " +
        "Add an ownerAliases entry so this module has a named owner.",
    });
  }

  return { pass: failures.length === 0, failures };
}

function formatBytes(bytes) {
  return (bytes / 1024).toFixed(1) + " KB";
}

function formatReport(report, evaluation, changes) {
  const lines = [];

  lines.push("Route client bundle composition");
  const routeEntries = Object.entries(report.routes).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (const [route, measurement] of routeEntries) {
    lines.push(
      "  " +
        route +
        "  " +
        formatBytes(measurement.clientJsBytes) +
        " client JS across " +
        measurement.chunkCount +
        " chunk(s)",
    );
    for (const [owner, bytes] of Object.entries(measurement.owners).slice(0, 5)) {
      lines.push("      " + owner.padEnd(28) + " " + formatBytes(bytes));
    }
  }

  lines.push("");
  lines.push("Client dependency ownership");
  for (const instance of report.packages || []) {
    lines.push("  " + instance.name + "@" + (instance.version || "unknown"));
  }

  lines.push("");
  if (!changes || changes.length === 0) {
    lines.push("No significant change vs the reviewed baseline.");
  } else {
    lines.push("Significant changes vs the reviewed baseline:");
    for (const change of changes) {
      const delta =
        typeof change.deltaBytes === "number"
          ? (change.deltaBytes > 0 ? "+" : "") +
            formatBytes(change.deltaBytes) +
            " (" +
            change.deltaPercent +
            "%)"
          : "";
      lines.push("  " + change.route + ": " + change.type + " " + delta);
    }
  }

  lines.push("");
  if (evaluation.pass) {
    lines.push("Bundle composition budgets: PASS");
  } else {
    lines.push(
      "Bundle composition budgets: FAIL (" + evaluation.failures.length + " violation(s))",
    );
    for (const failure of evaluation.failures) {
      lines.push(
        "  [" +
          failure.category +
          "] " +
          (failure.route ? failure.route + ": " : "") +
          failure.detail,
      );
    }
  }

  return lines.join("\n");
}

module.exports = {
  NODE_BUILTINS,
  attributeChunkBytes,
  canonicalJson,
  compareToBaseline,
  evaluate,
  findDuplicatePackages,
  findServerOnlyLeaks,
  findUnexpectedClientPackages,
  formatBytes,
  formatReport,
  hashBudgets,
  isNodeBuiltinSpecifier,
  mergeOwnerBytes,
  resolveOwner,
  resolveRouteBudget,
  sortOwnerBytes,
  stripScheme,
  validateGovernance,
};

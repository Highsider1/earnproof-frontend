/**
 * Unit tests for the bundle composition gate.
 *
 * Every rule the gate enforces is exercised here against synthetic
 * measurements, including the failure path for each one — a budget check
 * that has never been proven to fail is not a gate. Driving the pure
 * functions directly (rather than running `next build` inside a test) keeps
 * these deterministic and fast; the real build is exercised by the CI step
 * that runs `npm run bundle:analyze`.
 */

const fs = require("fs");
const path = require("path");

const {
  attributeChunkBytes,
  compareToBaseline,
  evaluate,
  findDuplicatePackages,
  findServerOnlyLeaks,
  findUnexpectedClientPackages,
  formatReport,
  hashBudgets,
  resolveOwner,
  resolveRouteBudget,
  sortOwnerBytes,
  validateGovernance,
} = require("./bundle-analysis");

const budgetsFixture = {
  defaults: { clientJsBytes: 500000 },
  allowedClientPackages: ["next"],
  routes: {
    "/verify": {
      clientJsBytes: 400000,
      reason: "Verification form and QR validation on top of the shared shell.",
      reviewedOn: "2026-08-28",
    },
  },
};

const baselineFixture = {
  budgetsHash: hashBudgets(budgetsFixture),
  routes: { "/verify": { clientJsBytes: 390000, owners: { next: 390000 } } },
};

function reportFixture(overrides = {}) {
  return {
    routes: { "/verify": { clientJsBytes: 390000, chunkCount: 3, owners: { next: 390000 } } },
    packages: [{ name: "next", version: "16.3.0", installDir: "node_modules/next" }],
    duplicatePackages: [],
    unexpectedPackages: [],
    serverOnlyLeaks: [],
    unresolvedOwners: [],
    ...overrides,
  };
}

describe("owner attribution", () => {
  it("attributes first-party sources to their top-level directory", () => {
    expect(resolveOwner("turbopack:///[project]/components/verification/verify-scan.tsx")).toEqual({
      owner: "components",
      kind: "first-party",
      installDir: null,
      source: "turbopack:///[project]/components/verification/verify-scan.tsx",
    });
  });

  it("attributes a dependency to its npm name, including scoped packages", () => {
    const resolved = resolveOwner("turbopack:///[project]/node_modules/@swc/helpers/esm/x.js");
    expect(resolved.owner).toBe("@swc/helpers");
    expect(resolved.kind).toBe("package");
    expect(resolved.installDir).toBe("node_modules/@swc/helpers");
  });

  it("resolves a nested install to its own directory so duplicates stay distinguishable", () => {
    const resolved = resolveOwner(
      "turbopack:///[project]/node_modules/outer/node_modules/inner/index.js",
    );
    expect(resolved.owner).toBe("inner");
    expect(resolved.installDir).toBe("node_modules/outer/node_modules/inner");
  });

  it("recognises the bundler runtime as its own owner", () => {
    expect(resolveOwner("turbopack:///[turbopack]/browser/runtime/base/runtime-base.ts").kind).toBe(
      "runtime",
    );
  });

  it("maps a dependency's own bundled sourcemap through the explicit alias list", () => {
    const resolved = resolveOwner("webpack://freighterApi/./src/getAddress.ts", {
      "webpack://freighterApi/": "@stellar/freighter-api",
    });
    expect(resolved).toMatchObject({ owner: "@stellar/freighter-api", kind: "package" });
  });

  it("marks anything it cannot classify as unknown rather than guessing", () => {
    expect(resolveOwner("mystery://someone-elses-bundle/x.js").kind).toBe("unknown");
  });
});

describe("byte attribution", () => {
  it("splits chunk bytes proportionally and sums to exactly the chunk size", () => {
    const owners = attributeChunkBytes(
      1000,
      [
        "turbopack:///[project]/node_modules/next/client.js",
        "turbopack:///[project]/lib/api/client.ts",
        "turbopack:///[project]/components/x.tsx",
      ],
      [700, 200, 101],
    );
    expect(Object.values(owners).reduce((a, b) => a + b, 0)).toBe(1000);
    expect(owners.next).toBeGreaterThan(owners.lib);
    expect(owners.lib).toBeGreaterThan(owners.components);
  });

  it("is deterministic for the same inputs", () => {
    const args = [
      777,
      ["turbopack:///[project]/lib/a.ts", "turbopack:///[project]/app/b.tsx"],
      [13, 29],
    ];
    expect(attributeChunkBytes(...args)).toEqual(attributeChunkBytes(...args));
  });

  it("reports a chunk with no source map as unmapped rather than dropping its bytes", () => {
    expect(attributeChunkBytes(4096, [], [])).toEqual({ "[unmapped]": 4096 });
  });

  it("sorts owners largest-first for a stable report", () => {
    expect(Object.keys(sortOwnerBytes({ a: 1, b: 30, c: 20 }))).toEqual(["b", "c", "a"]);
  });
});

describe("duplicate dependency detection", () => {
  it("fails a package that ships at two versions in client chunks", () => {
    const duplicates = findDuplicatePackages([
      { name: "zod", version: "3.24.1", installDir: "node_modules/zod" },
      { name: "zod", version: "4.4.3", installDir: "node_modules/pkg/node_modules/zod" },
    ]);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].package).toBe("zod");
    expect(duplicates[0].versions.map((entry) => entry.version)).toEqual(["3.24.1", "4.4.3"]);
  });

  it("treats a hoisted and a nested copy of the same version as one dependency", () => {
    expect(
      findDuplicatePackages([
        { name: "zod", version: "4.4.3", installDir: "node_modules/zod" },
        { name: "zod", version: "4.4.3", installDir: "node_modules/pkg/node_modules/zod" },
      ]),
    ).toEqual([]);
  });
});

describe("client dependency ownership", () => {
  it("flags a package that is not on the allowlist", () => {
    expect(findUnexpectedClientPackages(["next", "lodash"], ["next"])).toEqual(["lodash"]);
  });

  it("accepts an allowlisted package", () => {
    expect(findUnexpectedClientPackages(["next"], ["next", "@swc/helpers"])).toEqual([]);
  });
});

describe("server-only leak detection", () => {
  const policy = {
    serverOnlyPackages: ["jsonwebtoken"],
    serverOnlyPathPatterns: ["(^|/)server-only(/|$)"],
    secretPatterns: ["-----BEGIN [A-Z ]*PRIVATE KEY-----"],
    envScanKinds: ["first-party"],
  };

  const leakTypes = (modules) => findServerOnlyLeaks(modules, policy).map((leak) => leak.type);

  it("flags a Node builtin reaching a client chunk", () => {
    expect(
      leakTypes([{ source: "node:crypto", owner: "unresolved:node:crypto", kind: "unknown" }]),
    ).toContain("node-builtin");
    expect(
      leakTypes([
        {
          source: "turbopack:///[project]/node_modules/crypto/index.js",
          owner: "crypto",
          kind: "package",
        },
      ]),
    ).toContain("node-builtin");
  });

  it("flags a server-only package and a server-only module path", () => {
    expect(
      leakTypes([
        {
          source: "turbopack:///[project]/node_modules/jsonwebtoken/index.js",
          owner: "jsonwebtoken",
          kind: "package",
        },
      ]),
    ).toContain("server-only-package");
    expect(
      leakTypes([
        { source: "turbopack:///[project]/lib/server-only/signing.ts", owner: "lib", kind: "first-party" },
      ]),
    ).toContain("server-only-module");
  });

  it("flags a non-public process.env read from first-party client code", () => {
    expect(
      leakTypes([
        {
          source: "turbopack:///[project]/lib/api/client.ts",
          owner: "lib",
          kind: "first-party",
          content: "const key = process.env.EARNPROOF_API_SECRET;",
        },
      ]),
    ).toContain("server-env-reference");
  });

  it("allows NEXT_PUBLIC_ and NODE_ENV reads, which Next inlines for the browser", () => {
    expect(
      findServerOnlyLeaks(
        [
          {
            source: "turbopack:///[project]/config/app.ts",
            owner: "config",
            kind: "first-party",
            content:
              'const url = process.env.NEXT_PUBLIC_API_URL; const dev = process.env["NODE_ENV"];',
          },
        ],
        policy,
      ),
    ).toEqual([]);
  });

  it("does not scan framework internals for env reads, which use build-time flags", () => {
    expect(
      leakTypes([
        {
          source: "turbopack:///[project]/node_modules/next/src/client/app-index.tsx",
          owner: "next",
          kind: "package",
          content: "if (process.env.__NEXT_CACHE_COMPONENTS) {}",
        },
      ]),
    ).toEqual([]);
  });

  it("flags secret-shaped material without echoing the secret into the report", () => {
    const leaks = findServerOnlyLeaks(
      [
        {
          source: "turbopack:///[project]/lib/keys.ts",
          owner: "lib",
          kind: "first-party",
          content: "-----BEGIN RSA PRIVATE KEY-----\nMIIEabcdefg\n",
        },
      ],
      policy,
    );
    expect(leaks.map((leak) => leak.type)).toContain("secret-material");
    expect(JSON.stringify(leaks)).not.toContain("MIIEabcdefg");
  });

  it("passes a clean client module graph", () => {
    expect(
      findServerOnlyLeaks(
        [
          {
            source: "turbopack:///[project]/components/layout/public-shell.tsx",
            owner: "components",
            kind: "first-party",
            content: "export function PublicShell() { return null; }",
          },
        ],
        policy,
      ),
    ).toEqual([]);
  });
});

describe("budget governance", () => {
  it("accepts budgets with a reason, a review date and a matching baseline", () => {
    expect(validateGovernance(budgetsFixture, baselineFixture)).toEqual([]);
  });

  it("rejects a route budget with no documented reason", () => {
    const budgets = { ...budgetsFixture, routes: { "/verify": { clientJsBytes: 1, reviewedOn: "2026-08-28" } } };
    expect(validateGovernance(budgets, { budgetsHash: hashBudgets(budgets) })).toEqual([
      expect.objectContaining({ type: "missing-reason" }),
    ]);
  });

  it("rejects a route budget with no review date", () => {
    const budgets = { ...budgetsFixture, routes: { "/verify": { clientJsBytes: 1, reason: "because" } } };
    expect(validateGovernance(budgets, { budgetsHash: hashBudgets(budgets) })).toEqual([
      expect.objectContaining({ type: "missing-review-date" }),
    ]);
  });

  it("rejects a budget change that did not come with a re-reviewed baseline", () => {
    const raised = {
      ...budgetsFixture,
      routes: {
        "/verify": { ...budgetsFixture.routes["/verify"], clientJsBytes: 999999 },
      },
    };
    expect(validateGovernance(raised, baselineFixture)).toEqual([
      expect.objectContaining({ type: "stale-baseline" }),
    ]);
  });

  it("rejects a missing baseline entirely", () => {
    expect(validateGovernance(budgetsFixture, null)).toEqual([
      expect.objectContaining({ type: "missing-baseline" }),
    ]);
  });
});

describe("baseline comparison", () => {
  const baseline = { routes: { "/verify": { clientJsBytes: 400000 }, "/gone": { clientJsBytes: 10 } } };

  it("ignores changes below both the byte and percentage thresholds", () => {
    expect(
      compareToBaseline({ "/verify": { clientJsBytes: 400500 }, "/gone": { clientJsBytes: 10 } }, baseline),
    ).toEqual([]);
  });

  it("reports growth past the threshold with the delta and percentage", () => {
    const changes = compareToBaseline(
      { "/verify": { clientJsBytes: 460000 }, "/gone": { clientJsBytes: 10 } },
      baseline,
    );
    expect(changes).toEqual([
      expect.objectContaining({ route: "/verify", type: "grew", deltaBytes: 60000, deltaPercent: 15 }),
    ]);
  });

  it("reports routes that appeared or disappeared", () => {
    const changes = compareToBaseline({ "/new": { clientJsBytes: 100 } }, baseline);
    expect(changes.map((change) => [change.route, change.type]).sort()).toEqual([
      ["/gone", "removed"],
      ["/new", "added"],
      ["/verify", "removed"],
    ]);
  });
});

describe("evaluate", () => {
  it("passes a clean report", () => {
    expect(evaluate(reportFixture(), budgetsFixture, baselineFixture)).toEqual({
      pass: true,
      failures: [],
    });
  });

  it("fails a route over its explicit budget and names the largest owner", () => {
    const result = evaluate(
      reportFixture({
        routes: {
          "/verify": { clientJsBytes: 450000, chunkCount: 3, owners: { next: 400000, lib: 50000 } },
        },
      }),
      budgetsFixture,
      baselineFixture,
    );
    expect(result.pass).toBe(false);
    expect(result.failures[0]).toMatchObject({ category: "route-budget", route: "/verify" });
    expect(result.failures[0].detail).toContain("next");
    expect(result.failures[0].detail).toContain("50000 B");
  });

  it("falls back to the default budget for a route with no explicit entry", () => {
    expect(resolveRouteBudget(budgetsFixture, "/unlisted").clientJsBytes).toBe(500000);
    const result = evaluate(
      reportFixture({
        routes: { "/unlisted": { clientJsBytes: 500001, chunkCount: 1, owners: { next: 500001 } } },
      }),
      budgetsFixture,
      baselineFixture,
    );
    expect(result.failures.map((failure) => failure.category)).toContain("route-budget");
  });

  it("fails a duplicate dependency, an unexpected package and a server-only leak", () => {
    const result = evaluate(
      reportFixture({
        duplicatePackages: [
          { package: "zod", versions: [{ version: "3.24.1" }, { version: "4.4.3" }] },
        ],
        unexpectedPackages: ["lodash"],
        serverOnlyLeaks: [{ type: "node-builtin", source: "node:crypto", detail: "node:crypto" }],
        unresolvedOwners: ["unresolved:mystery:"],
      }),
      budgetsFixture,
      baselineFixture,
    );
    expect(result.failures.map((failure) => failure.category)).toEqual([
      "duplicate-dependency",
      "unexpected-client-package",
      "server-only-leak",
      "unattributed-module",
    ]);
  });

  it("renders a report that names every violation", () => {
    const report = reportFixture({ unexpectedPackages: ["lodash"] });
    const evaluation = evaluate(report, budgetsFixture, baselineFixture);
    const text = formatReport(report, evaluation, []);
    expect(text).toContain("Bundle composition budgets: FAIL");
    expect(text).toContain("lodash");
    expect(formatReport(reportFixture(), evaluate(reportFixture(), budgetsFixture, baselineFixture), [])).toContain(
      "Bundle composition budgets: PASS",
    );
  });
});

describe("committed budgets and baseline", () => {
  const readJson = (file) => JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf8"));

  it("keeps the committed baseline in sync with the committed budgets", () => {
    expect(validateGovernance(readJson("budgets.json"), readJson("baseline.json"))).toEqual([]);
  });

  it("only allowlists packages the baseline actually recorded in client chunks", () => {
    const budgets = readJson("budgets.json");
    const baselinePackages = readJson("baseline.json").packages.map((entry) => entry.name);
    for (const name of baselinePackages) {
      expect(budgets.allowedClientPackages).toContain(name);
    }
  });
});

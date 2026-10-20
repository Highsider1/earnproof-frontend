const {
  routeToHtmlFile,
  listMeasurableBuildRoutes,
  extractStaticAssetPaths,
  extractRouteAssetPaths,
  resolveBudget,
  evaluateBudgets,
  formatReport,
} = require("./budget-check");
const fs = require("fs");
const os = require("os");
const path = require("path");

describe("routeToHtmlFile", () => {
  it("maps the root route to index.html", () => {
    expect(routeToHtmlFile("/")).toBe("index.html");
  });

  it("maps nested routes to their nested html file", () => {
    expect(routeToHtmlFile("/verify/credential")).toBe("verify/credential.html");
    expect(routeToHtmlFile("/proofs")).toBe("proofs.html");
  });
});

describe("listMeasurableBuildRoutes", () => {
  it("includes dynamic routes that expose client-reference manifests", () => {
    const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), "earnproof-build-"));
    try {
      fs.mkdirSync(path.join(buildDir, "server", "app", "proofs"), { recursive: true });
      fs.mkdirSync(path.join(buildDir, "server", "app", "verify", "[proofId]", "page"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(buildDir, "app-path-routes-manifest.json"),
        JSON.stringify({
          "/proofs/page": "/proofs",
          "/verify/[proofId]/page": "/verify/[proofId]",
          "/favicon.ico/route": "/favicon.ico",
          "/_not-found/page": "/_not-found",
        }),
      );
      fs.writeFileSync(
        path.join(buildDir, "server", "app", "proofs.html"),
        '<html><script src="/_next/static/chunks/proofs.js"></script></html>',
      );
      fs.writeFileSync(
        path.join(
          buildDir,
          "server",
          "app",
          "verify",
          "[proofId]",
          "page",
          "build-manifest.json",
        ),
        JSON.stringify({
          polyfillFiles: ["static/chunks/polyfill.js"],
          rootMainFiles: ["static/chunks/runtime.js"],
        }),
      );
      fs.writeFileSync(
        path.join(
          buildDir,
          "server",
          "app",
          "verify",
          "[proofId]",
          "page_client-reference-manifest.js",
        ),
        [
          "globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};",
          'globalThis.__RSC_MANIFEST["/verify/[proofId]/page"] = {"clientModules":{"[project]/components/x.tsx":{"chunks":["/_next/static/chunks/route.js"],"async":false}},"entryJSFiles":{"[project]/app/layout":["static/chunks/layout.js"]},"entryCSSFiles":{"[project]/app/layout":[{"path":"static/chunks/app.css","inlined":false}]}};',
        ].join("\n"),
      );

      expect(listMeasurableBuildRoutes(buildDir)).toEqual(["/proofs", "/verify/[proofId]"]);
      expect(extractRouteAssetPaths(buildDir, "/verify/[proofId]").sort()).toEqual(
        [
          "/_next/static/chunks/app.css",
          "/_next/static/chunks/layout.js",
          "/_next/static/chunks/polyfill.js",
          "/_next/static/chunks/route.js",
          "/_next/static/chunks/runtime.js",
        ].sort(),
      );
    } finally {
      fs.rmSync(buildDir, { recursive: true, force: true });
    }
  });
});

describe("extractStaticAssetPaths", () => {
  it("collects script and stylesheet /_next/static asset paths, de-duplicated", () => {
    const html = `
      <html><head>
        <link rel="stylesheet" href="/_next/static/chunks/app.css">
        <link rel="preconnect" href="https://fonts.example.com">
      </head><body>
        <script src="/_next/static/chunks/main.js"></script>
        <script src="/_next/static/chunks/main.js"></script>
        <script src="/_next/static/chunks/route.js"></script>
      </body></html>
    `;

    expect(extractStaticAssetPaths(html).sort()).toEqual(
      [
        "/_next/static/chunks/app.css",
        "/_next/static/chunks/main.js",
        "/_next/static/chunks/route.js",
      ].sort(),
    );
  });

  it("ignores non-Next-static asset URLs", () => {
    const html = `<script src="https://example.com/tracker.js"></script>`;
    expect(extractStaticAssetPaths(html)).toEqual([]);
  });
});

describe("resolveBudget", () => {
  const budgets = {
    defaults: { firstLoadJsBytes: 100, largestAssetBytes: 50 },
    routes: {
      "/heavy": { firstLoadJsBytes: 200 },
    },
  };

  it("falls back to defaults for routes without an override", () => {
    expect(resolveBudget(budgets, "/plain")).toEqual({
      firstLoadJsBytes: 100,
      largestAssetBytes: 50,
    });
  });

  it("merges a route override onto the defaults", () => {
    expect(resolveBudget(budgets, "/heavy")).toEqual({
      firstLoadJsBytes: 200,
      largestAssetBytes: 50,
    });
  });
});

describe("evaluateBudgets", () => {
  const budgets = {
    defaults: { firstLoadJsBytes: 600_000, largestAssetBytes: 260_000 },
    routes: {},
  };

  it("passes a route that stays within budget", () => {
    const measurements = [
      {
        route: "/verify",
        firstLoadJsBytes: 500_000,
        largestAsset: { chunk: "main.js", bytes: 200_000 },
        largestJsChunk: { chunk: "main.js", bytes: 200_000 },
      },
    ];

    const [result] = evaluateBudgets(measurements, budgets);
    expect(result.pass).toBe(true);
    expect(result.failures).toEqual([]);
  });

  // --- Negative fixture -----------------------------------------------
  // This is the required proof that the gate actually fails: a synthetic
  // measurement engineered to exceed an artificially low budget for one
  // route, asserting the comparison reports failure with route + chunk
  // context (the chunk name and the overage amount), not just a boolean.
  it("fails a route that exceeds its First Load JS budget and names the responsible chunk", () => {
    const lowBudgets = {
      defaults: { firstLoadJsBytes: 600_000, largestAssetBytes: 260_000 },
      routes: {
        "/proofs": { firstLoadJsBytes: 10_000 }, // artificially low
      },
    };

    const measurements = [
      {
        route: "/proofs",
        firstLoadJsBytes: 609_487, // real measured baseline for this route
        largestAsset: { chunk: "4561u0v7ysn3r.js", bytes: 228_844 },
        largestJsChunk: { chunk: "3jq6h0_m4yl2-.js", bytes: 19_705 },
      },
    ];

    const [result] = evaluateBudgets(measurements, lowBudgets);

    expect(result.pass).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      type: "firstLoadJs",
      budgetBytes: 10_000,
      actualBytes: 609_487,
      chunk: "3jq6h0_m4yl2-.js",
    });
    expect(result.failures[0].overBy).toBe(609_487 - 10_000);

    // The rendered report must surface the route and the chunk, not just
    // "failed" — this is what makes the CI output actionable.
    const report = formatReport(result ? [result] : []);
    expect(report).toContain("/proofs");
    expect(report).toContain("3jq6h0_m4yl2-.js");
    expect(report).toContain("FAIL");
  });

  it("fails a route that exceeds its largest-asset budget and names the asset", () => {
    const lowBudgets = {
      defaults: { firstLoadJsBytes: 600_000, largestAssetBytes: 1_000 }, // artificially low
      routes: {},
    };

    const measurements = [
      {
        route: "/",
        firstLoadJsBytes: 400_000,
        largestAsset: { chunk: "hero-image.png", bytes: 50_000 },
        largestJsChunk: { chunk: "main.js", bytes: 30_000 },
      },
    ];

    const [result] = evaluateBudgets(measurements, lowBudgets);

    expect(result.pass).toBe(false);
    expect(result.failures[0]).toMatchObject({
      type: "largestAsset",
      chunk: "hero-image.png",
      actualBytes: 50_000,
      budgetBytes: 1_000,
    });
  });

  it("reports multiple failing routes independently", () => {
    const lowBudgets = {
      defaults: { firstLoadJsBytes: 1_000, largestAssetBytes: 1_000 },
      routes: {},
    };

    const measurements = [
      {
        route: "/a",
        firstLoadJsBytes: 5_000,
        largestAsset: { chunk: "a.js", bytes: 500 },
        largestJsChunk: { chunk: "a.js", bytes: 5_000 },
      },
      {
        route: "/b",
        firstLoadJsBytes: 500,
        largestAsset: { chunk: "b.js", bytes: 500 },
        largestJsChunk: { chunk: "b.js", bytes: 500 },
      },
    ];

    const results = evaluateBudgets(measurements, lowBudgets);
    expect(results.find((r) => r.route === "/a").pass).toBe(false);
    expect(results.find((r) => r.route === "/b").pass).toBe(true);
  });
});

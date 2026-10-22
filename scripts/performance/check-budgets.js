#!/usr/bin/env node

/**
 * CI entry point for the route performance budget gate.
 *
 * Usage: node scripts/performance/check-budgets.js
 *
 * Requires a production build to already exist (`next build`). Reads
 * per-route First Load JS and largest-asset sizes straight from the build
 * output, compares them against scripts/performance/budgets.json, prints a
 * report naming the offending route and chunk, and exits non-zero on any
 * regression.
 */

const fs = require("fs");
const path = require("path");
const { measureAllRoutes, evaluateBudgets, formatReport } = require("./budget-check");

const buildDir = path.join(__dirname, "..", "..", ".next");
const budgetsPath = path.join(__dirname, "budgets.json");

function main() {
  if (!fs.existsSync(path.join(buildDir, "app-path-routes-manifest.json"))) {
    console.error(
      `No production build found at ${buildDir}. Run "next build" before running the performance budget check.`,
    );
    process.exit(1);
  }

  const budgets = JSON.parse(fs.readFileSync(budgetsPath, "utf8"));
  const measurements = measureAllRoutes(buildDir);
  const results = evaluateBudgets(measurements, budgets);

  console.log(formatReport(results));

  const failed = results.filter((result) => !result.pass);
  if (failed.length > 0) {
    console.error(
      `\nRoute performance budget check failed for ${failed.length} route(s): ${failed
        .map((result) => result.route)
        .join(", ")}`,
    );
    process.exit(1);
  }

  console.log(`\nAll ${results.length} routes are within their performance budgets.`);
}

main();

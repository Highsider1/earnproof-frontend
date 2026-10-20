import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";
import type { Result } from "axe-core";

/**
 * Impact levels that fail the build. "minor" and "moderate" violations are
 * still collected in the HTML report (via axe's own artifact) but do not
 * fail CI, matching the acceptance criteria: "critical axe violations fail
 * CI with route and rule context".
 */
const BLOCKING_IMPACTS = new Set(["critical", "serious"]);

/**
 * Runs an axe scan against WCAG 2.0/2.1 A + AA rules, attaches the full
 * result set to the test report, and throws a legible error naming the
 * route, the rule ID(s), and the affected DOM nodes for every
 * critical/serious violation found.
 */
export async function runAxeScan(
  page: Page,
  testInfo: TestInfo,
  options?: { routeName?: string; include?: string[]; exclude?: string[] },
) {
  const routeLabel = options?.routeName ?? page.url();

  let builder = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
  ]);

  if (options?.include) {
    builder = builder.include(options.include);
  }
  if (options?.exclude) {
    for (const selector of options.exclude) {
      builder = builder.exclude(selector);
    }
  }

  const results = await builder.analyze();

  await testInfo.attach(`axe-results-${routeLabel}`, {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });

  const blocking = results.violations.filter((violation) =>
    BLOCKING_IMPACTS.has(violation.impact ?? ""),
  );

  if (blocking.length > 0) {
    throw new Error(formatViolations(routeLabel, blocking));
  }

  return results;
}

function formatViolations(routeLabel: string, violations: Result[]) {
  const lines = [
    `Accessibility violations on route "${routeLabel}" (${violations.length} rule(s), critical/serious impact):`,
  ];

  for (const violation of violations) {
    lines.push("");
    lines.push(`  Rule: ${violation.id} [${violation.impact}]`);
    lines.push(`  Help: ${violation.help}`);
    lines.push(`  More info: ${violation.helpUrl}`);
    lines.push(`  Nodes (${violation.nodes.length}):`);
    for (const node of violation.nodes.slice(0, 5)) {
      lines.push(`    - ${node.target.join(" ")}`);
      lines.push(`      ${node.failureSummary?.replace(/\n/g, " ") ?? ""}`);
    }
    if (violation.nodes.length > 5) {
      lines.push(`    ...and ${violation.nodes.length - 5} more node(s)`);
    }
  }

  return lines.join("\n");
}

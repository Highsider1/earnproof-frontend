/**
 * Localization-readiness conventions, enforced over the real source tree.
 *
 * These are the assumptions that are cheap to avoid now and expensive to
 * unpick once translations exist:
 *
 * - a bare `toLocaleString()` renders differently on a developer's machine,
 *   a CI runner and a user's browser;
 * - a hard-coded locale tag looks locale-aware and is not;
 * - a sentence assembled from fragments cannot be reordered by a translator.
 *
 * Each rule below reports the file, the line and the offending text, so a
 * failure points straight at the fix.
 */

import fs from "fs";
import path from "path";

const REPO_ROOT = path.join(__dirname, "..", "..");
const SCANNED_DIRECTORIES = ["app", "components"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const sourceFiles = SCANNED_DIRECTORIES.flatMap((dir) => walk(path.join(REPO_ROOT, dir))).sort();

/**
 * Blank out comments so a rule's own documentation — which necessarily
 * quotes the pattern it forbids — is never itself a finding. Only `//` at
 * the start of a line is treated as a comment, so a `https://` inside a
 * string survives.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => (/^\s*\/\//.test(line) ? "" : line))
    .join("\n");
}

type Finding = { file: string; line: number; text: string };

function scan(matcher: (line: string) => string | null): Finding[] {
  const findings: Finding[] = [];
  for (const file of sourceFiles) {
    const lines = withoutComments(fs.readFileSync(file, "utf8")).split("\n");
    lines.forEach((line, index) => {
      const hit = matcher(line);
      if (hit !== null) {
        findings.push({
          file: path.relative(REPO_ROOT, file).split(path.sep).join("/"),
          line: index + 1,
          text: hit.trim().slice(0, 120),
        });
      }
    });
  }
  return findings;
}

function describeFindings(findings: Finding[]): string[] {
  return findings.map((finding) => `${finding.file}:${finding.line}  ${finding.text}`);
}

describe("dates, numbers and plural-sensitive text use explicit locale-aware helpers", () => {
  it("has no bare toLocale* call, which depends on the runtime's ambient locale", () => {
    const findings = scan((line) => {
      const match = /\.toLocale(?:Date|Time)?String\s*\(\s*\)/.exec(line);
      return match ? line : null;
    });

    expect(describeFindings(findings)).toEqual([]);
  });

  it("has no hard-coded locale tag outside lib/i18n", () => {
    const findings = scan((line) => {
      const match = /new\s+Intl\.\w+\s*\(\s*["'][a-z]{2}(?:-[A-Za-z0-9]+)*["']/.exec(line);
      return match ? line : null;
    });

    expect(describeFindings(findings)).toEqual([]);
  });

  it("routes all Intl usage in app code through lib/i18n", () => {
    const findings = scan((line) => (/new\s+Intl\./.test(line) ? line : null));
    expect(describeFindings(findings)).toEqual([]);
  });
});

describe("user-facing strings are not assembled from sentence fragments", () => {
  // A template literal whose static parts contain real words around an
  // interpolation is a sentence split across code. Class-name templates are
  // excluded: they are not user-facing text, and Tailwind class composition
  // is exactly the legitimate use of a template literal in JSX.
  const wordAroundInterpolation = /[A-Za-z]{2,}\s|\s[A-Za-z]{2,}/;
  const templateLiteral = /`[^`]*\$\{[^`]*`/g;
  const interpolation = /\$\{[^}]*\}/g;

  it("has no template literal that splits a sentence around a value", () => {
    const findings = scan((line) => {
      if (line.includes("className")) return null;
      const literals = line.match(templateLiteral);
      if (!literals) return null;
      for (const literal of literals) {
        const statics = literal.split(interpolation).join("|");
        if (wordAroundInterpolation.test(statics)) return literal;
      }
      return null;
    });

    expect(describeFindings(findings)).toEqual([]);
  });

  it("provides a supported alternative: whole messages with placeholders", async () => {
    const { formatMessage } = await import("@/lib/i18n");

    expect(formatMessage("Income {operator} {amount} {asset}", {
      operator: ">=",
      amount: "4200",
      asset: "USDC",
    })).toBe("Income >= 4200 USDC");

    // A missing value stays visible instead of rendering as "undefined".
    expect(formatMessage("Income {operator} {amount}", { operator: ">=" })).toBe(
      "Income >= {amount}",
    );
  });
});

describe("the representative route owns its user-facing strings", () => {
  // app/status/page.tsx is the migrated reference for the convention: every
  // string a user can read comes from a `defineMessages` catalog with a
  // stable, namespaced key. Other routes are not yet migrated; this test
  // guards the reference so the convention cannot silently regress.
  const referenceRoute = path.join(REPO_ROOT, "app", "status", "page.tsx");

  it("declares a message catalog with a stable namespace", () => {
    const source = fs.readFileSync(referenceRoute, "utf8");
    expect(source).toContain('defineMessages("status", {');
  });

  it("has no literal JSX text left inline", () => {
    const source = withoutComments(fs.readFileSync(referenceRoute, "utf8"));
    // Raw text between two tags, e.g. `<button>Retry</button>`.
    const inlineText = [...source.matchAll(/>\s*([A-Za-z][A-Za-z ,.'-]{2,})\s*</g)].map(
      (match) => match[1],
    );

    expect(inlineText).toEqual([]);
  });
});

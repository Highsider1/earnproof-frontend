/**
 * Central registry of routes scanned by the accessibility test suite.
 *
 * Add a new route here to have it picked up automatically by
 * `scans.spec.ts`. This keeps the harness ready to grow as new pages
 * (payments, proof history/detail, dashboard, etc.) land.
 */
export type ScannedRoute = {
  /** Human readable name used in test titles and failure output. */
  name: string;
  /** App path to visit, relative to the base URL. */
  path: string;
  /** Short note on what this route represents in the product. */
  description: string;
};

export const scannedRoutes: ScannedRoute[] = [
  { name: "home", path: "/", description: "Public marketing landing page" },
  {
    name: "how-it-works",
    path: "/how-it-works",
    description: "Public navigation / product explainer",
  },
  { name: "faq", path: "/faq", description: "Public navigation, search + accordion disclosures" },
  { name: "developers", path: "/developers", description: "Developer tools / API reference" },
  { name: "issuers", path: "/issuers", description: "Issuer-facing marketing page" },
  { name: "privacy", path: "/privacy", description: "Legal / privacy policy" },
  { name: "terms", path: "/terms", description: "Legal / terms of service" },
  { name: "status", path: "/status", description: "System status page" },
  {
    name: "proofs",
    path: "/proofs",
    description:
      "Wallet authentication + proof creation flow (closest current analog to auth/payments)",
  },
  { name: "verify", path: "/verify", description: "Public proof verification by ID" },
  {
    name: "verify-credential",
    path: "/verify/credential",
    description: "Public proof verification by uploaded credential JSON",
  },
  {
    name: "not-found",
    path: "/this-route-does-not-exist",
    description: "404 / error page",
  },
];

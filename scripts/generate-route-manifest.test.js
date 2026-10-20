const {
  generateRouteManifest,
  validateManifest,
  ROUTE_TYPES,
} = require("./generate-route-manifest");

describe("generateRouteManifest", () => {
  it("emits normalized route paths, classifications, and canonical URLs", () => {
    const manifest = generateRouteManifest();
    const developersApiKeys = manifest.find(
      (route) => route.route === "/developers/api-keys",
    );

    expect(developersApiKeys).toBeDefined();
    expect(developersApiKeys.type).toBe(ROUTE_TYPES.PRIVATE);
    expect(developersApiKeys.canonicalUrl).toBe(
      "http://localhost:3000/developers/api-keys",
    );
    expect(manifest.every((route) => route.route === "/" || route.route.startsWith("/"))).toBe(
      true,
    );
    expect(manifest.some((route) => route.canonicalUrl.includes("localhost:3000developers"))).toBe(
      false,
    );
    expect(validateManifest(manifest)).toEqual([]);
  });
});

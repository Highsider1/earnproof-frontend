import { test as base, expect } from "@playwright/test";
import { installFreighterMock, type FreighterMockOptions } from "./freighter-mock";
import { ApiMock, type ApiMockOptions } from "./api-mock";
import { SYNTHETIC_WORKER_ADDRESS } from "./synthetic-data";

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4010/api/v1";

type Fixtures = {
  apiMock: ApiMock;
  freighter: (options?: Partial<FreighterMockOptions>) => Promise<void>;
};

/**
 * Extends Playwright's base test with the two building blocks every worker
 * lifecycle spec needs: a network-level API double and a Freighter wallet
 * double. Both are wired up before navigation so app code never touches a
 * real extension or a live backend.
 */
export const test = base.extend<Fixtures>({
  // `auto: true` so every test gets network interception installed even if
  // it doesn't need to assert on the mock directly (e.g. a test that only
  // exercises wallet connect still triggers `/auth/challenge` and
  // `/auth/verify` calls under the hood). Without this, a spec that forgets
  // to destructure `apiMock` would silently fall through to a real fetch
  // against an unreachable loopback address.
  apiMock: [
    async ({ page }, use, testInfo) => {
      const overrides = (testInfo.project.metadata as { apiUrl?: string } | undefined)?.apiUrl;
      const options: ApiMockOptions = { apiUrl: overrides ?? DEFAULT_API_URL };
      const mock = new ApiMock(options);
      await mock.install(page);
      await use(mock);
    },
    { auto: true },
  ],

  freighter: async ({ page }, use) => {
    await use(async (options) => {
      await installFreighterMock(page, {
        address: SYNTHETIC_WORKER_ADDRESS,
        ...options,
      });
    });
  },
});

export { expect };
export { DEFAULT_API_URL };

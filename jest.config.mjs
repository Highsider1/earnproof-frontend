import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  // Playwright specs under e2e/ have their own runner (`npm run
  // test:e2e:a11y`) and must not be picked up by jest.
  // Playwright's visual regression suite lives under e2e/visual and uses
  // @playwright/test, not jest — keep jest from trying to run it.
  testPathIgnorePatterns: ["[\\\\/]node_modules[\\\\/]", "[\\\\/]e2e[\\\\/]"],
};

export default createJestConfig(config);

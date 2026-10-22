import contracts from "./client-contracts.json";

export type ClientContract = {
  module: string;
  schema: string;
  required: string[];
  enums?: Record<string, string[]>;
  routes: string[];
};

/**
 * Hand-authored client assumptions. Generated OpenAPI types live in
 * `lib/api/generated/` and must not overwrite these mappings.
 */
export const CLIENT_CONTRACTS = contracts as ClientContract[];

"use strict";

const fs = require("node:fs");
const path = require("node:path");

function repoRoot() {
  return path.resolve(__dirname, "..");
}

function loadSpec(specPath) {
  return JSON.parse(fs.readFileSync(specPath, "utf8"));
}

function schemaOf(spec, name) {
  return spec.components?.schemas?.[name];
}

function propertyNames(schema) {
  return Object.keys(schema?.properties ?? {});
}

function resolveEnum(spec, schema, field) {
  const property = schema?.properties?.[field];
  if (!property) return null;
  if (property.enum) return property.enum;
  if (property.$ref) {
    const refName = property.$ref.split("/").pop();
    return schemaOf(spec, refName)?.enum ?? null;
  }
  return null;
}

function pathExists(spec, route) {
  const [method, pathname] = route.split(" ");
  const item = spec.paths?.[pathname];
  return Boolean(item?.[method.toLowerCase()]);
}

function checkContracts(spec, contracts) {
  const failures = [];

  for (const contract of contracts) {
    if (!schemaOf(spec, contract.schema)) {
      failures.push({
        module: contract.module,
        schema: contract.schema,
        message: `Schema ${contract.schema} is missing from the OpenAPI fixture. Owning client module: ${contract.module}.`,
      });
      continue;
    }

    const schema = schemaOf(spec, contract.schema);
    const fields = new Set([...propertyNames(schema), ...(schema.required ?? [])]);
    for (const field of contract.required) {
      const present = fields.has(field);
      if (!present) {
        failures.push({
          module: contract.module,
          schema: contract.schema,
          field,
          message: `Required client field ${contract.schema}.${field} was removed. Owning client module: ${contract.module}. Additive optional fields are allowed; removing a required field is not.`,
        });
      }
    }

    for (const [field, values] of Object.entries(contract.enums ?? {})) {
      const specEnum = resolveEnum(spec, schema, field);
      if (!specEnum) continue;
      for (const value of values) {
        if (!specEnum.includes(value)) {
          failures.push({
            module: contract.module,
            schema: contract.schema,
            field,
            message: `Enum value ${contract.schema}.${field}=${value} drifted. Owning client module: ${contract.module}.`,
          });
        }
      }
    }

    for (const route of contract.routes) {
      if (!pathExists(spec, route)) {
        failures.push({
          module: contract.module,
          schema: contract.schema,
          route,
          message: `Route ${route} is missing. Owning client module: ${contract.module}.`,
        });
      }
    }
  }

  return failures;
}

function formatFailures(failures) {
  return failures.map((failure) => `- ${failure.message}`).join("\n");
}

function main() {
  const root = repoRoot();
  const specPath = path.join(root, "lib/api/openapi/earnproof-api.v1.json");
  const spec = loadSpec(specPath);
  // Load contracts without TS by reading the compiled-like JSON companion if
  // present; otherwise parse the exported array from the TS source via a
  // tiny eval-free regex is brittle, so we keep a JSON snapshot next to it.
  const contractsPath = path.join(root, "lib/api/client-contracts.json");
  const contracts = JSON.parse(fs.readFileSync(contractsPath, "utf8"));
  const failures = checkContracts(spec, contracts);
  if (failures.length > 0) {
    console.error("API schema drift detected:\n" + formatFailures(failures));
    process.exit(1);
  }
  console.log(`API schema drift check passed (${contracts.length} client contracts, spec v${spec.info.version}).`);
}

if (require.main === module) {
  main();
}

module.exports = {
  checkContracts,
  formatFailures,
  loadSpec,
  pathExists,
};

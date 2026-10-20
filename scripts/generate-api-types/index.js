"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SPEC_RELATIVE = "lib/api/openapi/earnproof-api.v1.json";
const OUTPUT_RELATIVE = "lib/api/generated/v1.ts";
const HAND_AUTHORED_GUARD = "lib/api/client-contracts.ts";

function repoRoot() {
  return path.resolve(__dirname, "../..");
}

function tsType(schema, spec) {
  if (!schema) return "unknown";
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop();
    return name;
  }
  if (schema.enum) {
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  }
  if (schema.type === "array") {
    return `Array<${tsType(schema.items, spec)}>`;
  }
  if (schema.type === "object" || schema.properties) {
    return objectType(schema, spec);
  }
  if (schema.type === "integer" || schema.type === "number") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "string") return "string";
  if (schema.nullable) return "unknown";
  return "unknown";
}

function objectType(schema, spec) {
  const required = new Set(schema.required ?? []);
  const lines = Object.entries(schema.properties ?? {}).map(([key, value]) => {
    const optional = required.has(key) ? "" : "?";
    const nullable = value.nullable ? " | null" : "";
    return `  ${key}${optional}: ${tsType(value, spec)}${nullable};`;
  });
  return `{\n${lines.join("\n")}\n}`;
}

function schemaDeclaration(name, schema, spec) {
  if (schema.type === "object" || schema.properties) {
    return `export interface ${name} ${objectType(schema, spec)}`;
  }

  return `export type ${name} = ${tsType(schema, spec)};`;
}

function generate(spec) {
  const header = [
    "/**",
    " * AUTO-GENERATED. Do not edit.",
    ` * Source: ${SPEC_RELATIVE}`,
    ` * Spec version: ${spec.info.version}`,
    " * These types must not overwrite hand-authored UI models in",
    ` * ${HAND_AUTHORED_GUARD} or components/.`,
    " */",
    "",
    `export const API_SPEC_SOURCE = ${JSON.stringify(SPEC_RELATIVE)} as const;`,
    `export const API_SPEC_VERSION = ${JSON.stringify(spec.info.version)} as const;`,
    "",
  ];

  const schemas = spec.components.schemas ?? {};
  const body = Object.entries(schemas).map(([name, schema]) => {
    return schemaDeclaration(name, schema, spec);
  });

  return `${header.join("\n")}${body.join("\n\n")}\n`;
}

function main() {
  const root = repoRoot();
  const specPath = path.join(root, SPEC_RELATIVE);
  const outputPath = path.join(root, OUTPUT_RELATIVE);
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const next = generate(spec);
  const check = process.argv.includes("--check");

  if (check) {
    const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
    if (current !== next) {
      console.error(
        `Generated types are stale. Run npm run generate:api-types (source ${SPEC_RELATIVE} v${spec.info.version}).`,
      );
      process.exit(1);
    }
    console.log(`API types match ${SPEC_RELATIVE} v${spec.info.version}`);
    return;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, next);
  console.log(`Wrote ${OUTPUT_RELATIVE} from ${SPEC_RELATIVE} v${spec.info.version}`);
}

if (require.main === module) {
  main();
}

module.exports = { generate, SPEC_RELATIVE, OUTPUT_RELATIVE };

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const inputFile = process.argv[2] ?? "examples/context-pack.example.json";
const absolutePath = path.resolve(process.cwd(), inputFile);
const schemaPath = path.resolve(process.cwd(), "schemas/context-pack.schema.json");

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const run = async () => {
  const ajv = new Ajv2020.default({ allErrors: true, strict: true });
  addFormats.default(ajv);

  const schemaRaw = await readFile(schemaPath, "utf-8");
  const schema = JSON.parse(schemaRaw) as object;
  const validate = ajv.compile(schema);

  const raw = await readFile(absolutePath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  const ok = validate(parsed);

  if (ok) {
    process.stdout.write(`Context Pack is valid: ${absolutePath}\n`);
    return;
  }

  process.stderr.write(`Context Pack is invalid: ${absolutePath}\n`);
  for (const error of validate.errors ?? []) {
    process.stderr.write(
      `- ${error.instancePath || "/"} ${error.message ?? "validation error"}\n`
    );
  }

  process.exitCode = 1;
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Validation failed: ${message}\n`);
  process.exitCode = 1;
});


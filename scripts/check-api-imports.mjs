/**
 * Fail if any file under api/ uses an extensionless relative import.
 *
 * package.json sets "type": "module", so the serverless functions are native
 * ESM on Vercel. Native ESM does not do the extensionless resolution that
 * TypeScript, bundlers and most local runners do, so "./clip-seed" throws while
 * the module is loading -- before the handler is called. The endpoint then answers
 * 500 with an empty body in well under a second, having attempted no fetch, which
 * means neither the LastGood snapshot nor a retry can rescue it.
 *
 * This went unnoticed because every local check passed:
 *   - `tsc -b` accepts it. moduleResolution "bundler" treats the bare specifier
 *     as resolvable, and allowImportingTsExtensions makes the .ts form legal too.
 *   - eslint has no rule for it without the import plugin, which is not installed.
 *   - a local runner that appends .ts to relative specifiers -- which is exactly
 *     what the first version of the harness for this bug did -- resolves it
 *     happily and reports a working endpoint.
 *
 * So the check that would have caught it is a check that does not exist yet.
 * This is it. Run with `npm run check:api`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API_DIR = join(ROOT, "api");

// A relative specifier with no extension: "./x" but not "./x.ts" or "./x.js".
const BARE_RELATIVE = /(?:^|\s)(?:import|export)[^'"]*from\s*["'](\.[^"']*)["']/g;
const HAS_EXTENSION = /\.(m?[jt]sx?|json|css|node)$/;

const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;

    const source = readFileSync(full, "utf8");
    source.split("\n").forEach((line, i) => {
      // Skip comment lines so prose about an import is not read as one.
      const trimmed = line.trim();
      if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) return;

      for (const m of line.matchAll(BARE_RELATIVE)) {
        const spec = m[1];
        if (HAS_EXTENSION.test(spec)) continue;
        offenders.push({
          file: full.slice(ROOT.length + 1).replace(/\\/g, "/"),
          line: i + 1,
          spec,
          text: trimmed,
        });
      }
    });
  }
}

walk(API_DIR);

if (offenders.length > 0) {
  console.error("Extensionless relative import(s) in api/ -- native ESM cannot resolve these:\n");
  for (const o of offenders) {
    console.error(`  ${o.file}:${o.line}  "${o.spec}"`);
    console.error(`      ${o.text.slice(0, 100)}`);
  }
  console.error(`\n  package.json has "type": "module", so these run as ESM on Vercel.`);
  console.error(`  Write the extension: "./x.ts". tsc and eslint will not catch this.`);
  process.exit(1);
}

console.log(`api/ imports: all relative specifiers carry an extension (${API_DIR.slice(ROOT.length + 1)})`);
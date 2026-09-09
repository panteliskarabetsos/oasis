#!/usr/bin/env node
/**
 * Fail if a native Expo module in package.json is missing from ios/Podfile.lock.
 *
 * Adding an Expo package that ships native code requires `npx pod-install`
 * before the next build. Skipping it produces an app that builds and bundles
 * cleanly, then hard-crashes the moment the JS touches the missing module —
 * exactly how expo-audio took down the check-in screen.
 *
 *   node scripts/check-native-modules.mjs
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lockPath = "ios/Podfile.lock";

if (!existsSync(lockPath)) {
  console.log("No ios/Podfile.lock — managed workflow, nothing to check.");
  process.exit(0);
}
const lock = readFileSync(lockPath, "utf8");

/**
 * The podspec filename in node_modules/<dep>/ios is the authoritative pod name.
 * Guessing from the package name gets it wrong: expo-constants ships
 * EXConstants, expo-updates ships EXUpdates.
 */
function podNames(dep) {
  // A podspec can sit in the package root or in ios/ — check both, and accept
  // any dependency (not just expo-*): @stripe/stripe-react-native ships one too.
  for (const dir of [`node_modules/${dep}/ios`, `node_modules/${dep}`]) {
    if (!existsSync(dir)) continue;
    const specs = readdirSync(dir)
      .filter((f) => f.endsWith(".podspec"))
      .map((f) => f.replace(/\.podspec$/, ""));
    if (specs.length) return specs;
  }
  return [];
}

const missing = [];
for (const dep of Object.keys(pkg.dependencies ?? {})) {
  const pods = podNames(dep);
  if (!pods.length) continue; // JS-only package, nothing to link
  if (!pods.some((p) => lock.includes(`${p} (`) || lock.includes(`${p}:`)))
    missing.push({ dep, pod: pods.join(" / ") });
}

if (missing.length) {
  console.error("Native modules missing from ios/Podfile.lock:\n");
  for (const m of missing) console.error(`  ${m.dep}  (expected pod ${m.pod})`);
  console.error("\nRun:  npx pod-install\n");
  process.exit(1);
}
console.log(
  `All native modules are in Podfile.lock (${Object.keys(pkg.dependencies ?? {}).length} dependencies checked).`,
);

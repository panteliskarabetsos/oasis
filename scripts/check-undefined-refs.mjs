#!/usr/bin/env node
/**
 * Catch identifiers a file uses but never declares or imports.
 *
 * `next build` does not flag these — a component that reads a variable it was
 * never passed compiles cleanly and then throws a ReferenceError in the
 * browser. This walks real scopes so it catches, for example, a helper
 * component that uses `permissions` when only its parent received that prop.
 *
 *   node scripts/check-undefined-refs.mjs [paths...]     (default: src/app/admin)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import * as acorn from "acorn";
import * as walk from "acorn-walk";

/** esbuild strips the JSX so acorn can parse. Resolve it from wherever it lives. */
function loadTransform() {
  const require_ = createRequire(import.meta.url);
  const candidates = ["esbuild"];
  try {
    const npxRoot = execSync(
      "ls -d ~/.npm/_npx/*/node_modules/esbuild 2>/dev/null | head -1",
      { shell: "/bin/sh", encoding: "utf8" },
    ).trim();
    if (npxRoot) candidates.push(npxRoot);
  } catch {}
  for (const c of candidates) {
    try {
      return require_(c).transformSync;
    } catch {}
  }
  return null;
}

const transformSync = loadTransform();
if (!transformSync) {
  console.log(
    "esbuild is not installed, so JSX cannot be parsed.\n" +
      "Install it to enable this check:  npm i -D esbuild",
  );
  process.exit(0);
}

const GLOBALS = new Set([
  "window","document","console","fetch","navigator","localStorage","sessionStorage",
  "setTimeout","clearTimeout","setInterval","clearInterval","requestAnimationFrame",
  "cancelAnimationFrame","Math","JSON","Object","Array","String","Number","Boolean",
  "Date","RegExp","Error","TypeError","Promise","Set","Map","WeakMap","WeakSet",
  "Symbol","Intl","URL","URLSearchParams","AbortController","Blob","File","FormData",
  "Headers","Request","Response","TextEncoder","TextDecoder","Buffer","process",
  "globalThis","structuredClone","queueMicrotask","alert","confirm","prompt","atob",
  "btoa","crypto","performance","location","history","screen","Image","Audio",
  "IntersectionObserver","ResizeObserver","MutationObserver","CustomEvent","Event",
  "HTMLElement","Node","NaN","Infinity","undefined","isNaN","isFinite","parseInt",
  "parseFloat","encodeURIComponent","decodeURIComponent","encodeURI","decodeURI",
  "React","BigInt","Proxy","Reflect","WebSocket","EventSource","BarcodeDetector",
  "MediaStream","ImageCapture","exports","module","require","__dirname","__filename",
  "Uint8Array","Uint16Array","Uint32Array","Int8Array","Int16Array","Int32Array",
  "Float32Array","Float64Array","ArrayBuffer","DataView","AbortSignal","Notification",
]);

function collectFiles(p, out = []) {
  if (statSync(p).isDirectory()) {
    for (const e of readdirSync(p)) {
      if (e === "node_modules" || e.startsWith(".")) continue;
      collectFiles(join(p, e), out);
    }
  } else if ([".js", ".jsx", ".mjs"].includes(extname(p))) out.push(p);
  return out;
}

/** Names a declaration pattern binds. */
function patternNames(node, out = []) {
  if (!node) return out;
  switch (node.type) {
    case "Identifier": out.push(node.name); break;
    case "ObjectPattern":
      for (const p of node.properties)
        patternNames(p.type === "RestElement" ? p.argument : p.value, out);
      break;
    case "ArrayPattern":
      for (const e of node.elements) if (e) patternNames(e, out);
      break;
    case "AssignmentPattern": patternNames(node.left, out); break;
    case "RestElement": patternNames(node.argument, out); break;
  }
  return out;
}

const FN = new Set(["FunctionDeclaration","FunctionExpression","ArrowFunctionExpression"]);

function check(file) {
  const src = readFileSync(file, "utf8");
  let code;
  try {
    code = transformSync(src, { loader: "jsx", format: "esm", jsx: "transform" }).code;
  } catch { return []; }

  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: "module" });
  } catch { return []; }

  // Every binding introduced anywhere, plus the scope node that owns it.
  const scopes = new Map();
  const scopeOf = new Map();
  const stack = [];

  const declare = (name) => {
    const s = stack[stack.length - 1];
    if (s) scopes.get(s).add(name);
  };

  function enter(node) {
    stack.push(node);
    scopes.set(node, new Set());
  }
  function leave() { stack.pop(); }

  enter(ast);

  (function visit(node, parent) {
    if (!node || typeof node.type !== "string") return;
    const opensScope = FN.has(node.type) || node.type === "Program";
    if (opensScope && node.type !== "Program") {
      if (node.id?.name) declare(node.id.name);
      enter(node);
      for (const p of node.params) for (const n of patternNames(p)) declare(n);
    }
    switch (node.type) {
      case "VariableDeclarator": for (const n of patternNames(node.id)) declare(n); break;
      case "ClassDeclaration": if (node.id) declare(node.id.name); break;
      case "ImportDefaultSpecifier":
      case "ImportNamespaceSpecifier":
      case "ImportSpecifier": declare(node.local.name); break;
      case "CatchClause": if (node.param) for (const n of patternNames(node.param)) declare(n); break;
    }
    scopeOf.set(node, stack[stack.length - 1]);
    for (const key of Object.keys(node)) {
      if (key === "type" || key === "start" || key === "end") continue;
      const v = node[key];
      if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === "string" && visit(c, node));
      else if (v && typeof v.type === "string") visit(v, node);
    }
    if (opensScope && node.type !== "Program") leave();
  })(ast, null);

  // Resolve every read.
  const problems = [];
  const chain = (node) => {
    const out = [];
    let s = scopeOf.get(node);
    while (s) { out.push(s); s = scopeOf.get(s); }
    return out;
  };

  walk.ancestor(ast, {
    Identifier(node, _st, ancestors) {
      const parent = ancestors[ancestors.length - 2];
      if (!parent) return;
      // skip non-reads
      if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) return;
      if (parent.type === "Property" && parent.key === node && !parent.computed) return;
      if (parent.type === "MethodDefinition" && parent.key === node) return;
      if (["VariableDeclarator","FunctionDeclaration","ClassDeclaration"].includes(parent.type) && parent.id === node) return;
      if (FN.has(parent.type) && parent.params?.includes(node)) return;
      if (["ImportSpecifier","ImportDefaultSpecifier","ImportNamespaceSpecifier","ExportSpecifier"].includes(parent.type)) return;
      if (parent.type === "LabeledStatement" || parent.type === "BreakStatement" || parent.type === "ContinueStatement") return;
      if (["ObjectPattern","ArrayPattern","AssignmentPattern","RestElement"].includes(parent.type)) return;
      if (GLOBALS.has(node.name)) return;

      for (let i = ancestors.length - 1; i >= 0; i--) {
        const a = ancestors[i];
        if ((FN.has(a.type) || a.type === "Program") && scopes.get(a)?.has(node.name)) return;
      }
      problems.push(node.name);
    },
  });

  return [...new Set(problems)];
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ["src/app/admin"];
let bad = 0;
for (const t of targets) {
  for (const f of collectFiles(t)) {
    const undef = check(f);
    if (undef.length) { bad++; console.log(`${f}\n  undefined: ${undef.join(", ")}`); }
  }
}
console.log(bad ? `\n${bad} file(s) reference undefined identifiers` : "\nno undefined identifiers found");
process.exit(bad ? 1 : 0);

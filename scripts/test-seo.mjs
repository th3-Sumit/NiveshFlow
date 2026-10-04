import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");
const source = (filename) => readFile(path.join(root, filename), "utf8");

async function load(filename, environment = {}, dependencies = {}) {
  const exports = {};
  const compiled = ts.transpileModule(await source(filename), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("exports", "process", "require", compiled)(exports, { env: environment }, (name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
    return dependencies[name];
  });
  return exports;
}

test("canonical origin has a stable production fallback", async () => {
  const seo = await load("app/lib/seo.ts");
  assert.equal(seo.siteUrl.href, "https://niveshflow.netlify.app/");
  assert.equal(seo.homeMetadata.alternates.canonical, seo.siteUrl.href);
  assert.equal(seo.homeMetadata.openGraph.url, seo.siteUrl.href);
  assert.equal(seo.defaultMetadata.alternates, undefined);
});

test("public URL uses APP_URL first and strips paths, queries, and fragments", async () => {
  const seo = await load("app/lib/seo.ts", {
    APP_URL: " https://finance.example.com/path?token=fixture#section ",
    NEXT_PUBLIC_APP_URL: "https://unused.example.com",
    DEPLOY_PRIME_URL: "https://deploy-preview.example.com",
  });
  assert.equal(seo.siteUrl.href, "https://finance.example.com/");
  const fallback = await load("app/lib/seo.ts", { APP_URL: " ", NEXT_PUBLIC_APP_URL: "https://public.example.com" });
  assert.equal(fallback.siteUrl.href, "https://public.example.com/");
});

test("invalid origins fail without echoing configured credentials", async () => {
  for (const value of ["not-a-url-fixture", "javascript:fixture", "https://fixture-user:fixture-password@example.com", "ftp://example.com"]) {
    await assert.rejects(load("app/lib/seo.ts", { APP_URL: value }), (error) => {
      assert.match(error.message, /^APP_URL must be/);
      assert.ok(!error.message.includes(value));
      assert.ok(!error.message.includes("fixture-password"));
      return true;
    });
  }
  await assert.rejects(load("app/lib/seo.ts", { NODE_ENV: "production", APP_URL: "http://example.com" }), /using HTTPS in production/);
  const local = await load("app/lib/seo.ts", { NODE_ENV: "development", APP_URL: "http://localhost:3000" });
  assert.equal(local.siteUrl.href, "http://localhost:3000/");
});

test("only the production landing page opts into indexing", async () => {
  for (const context of [undefined, "production", "deploy-preview", "branch-deploy", "dev"]) {
    const seo = await load("app/lib/seo.ts", { CONTEXT: context });
    assert.equal(seo.homeMetadata.robots.index, context === undefined || context === "production");
    assert.equal(seo.defaultMetadata.robots.index, false);
    assert.equal(seo.defaultMetadata.robots.follow, false);
  }
});

test("titles and sharing metadata are consistent and generic", async () => {
  const seo = await load("app/lib/seo.ts");
  assert.equal(seo.defaultMetadata.title.template, "%s | NiveshFlow");
  assert.equal(seo.homeMetadata.title.absolute, seo.siteTitle);
  assert.equal(seo.defaultMetadata.twitter.card, "summary_large_image");
  const metadata = seo.privatePageMetadata("Profile", "Manage your account settings.");
  assert.equal(metadata.title, "Profile");
  assert.equal(metadata.openGraph.title, "Profile | NiveshFlow");
  assert.equal(metadata.twitter.description, metadata.description);
  assert.equal(metadata.robots.index, false);
  assert.equal(metadata.alternates, undefined);
  assert.equal(metadata.openGraph.url, undefined);
});

test("all auth and authenticated pages define unique generic metadata", async () => {
  const seo = await load("app/lib/seo.ts");
  const pages = (await readdir(path.join(root, "app"), { recursive: true }))
    .filter((filename) => filename.replaceAll("\\", "/").endsWith("/page.tsx"));
  const titles = new Set();
  for (const filename of pages) {
    const file = ts.createSourceFile(filename, await source(path.join("app", filename)), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const declaration = file.statements.find((statement) => ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some((item) => item.name.getText(file) === "metadata"));
    assert.ok(declaration, `${filename} must define metadata`);
    const printed = ts.createPrinter().printNode(ts.EmitHint.Unspecified, declaration, file);
    const compiled = ts.transpileModule(printed, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const exports = {};
    new Function("exports", "privatePageMetadata", compiled)(exports, seo.privatePageMetadata);
    const metadata = exports.metadata;
    assert.equal(metadata.robots.index, false, filename);
    assert.equal(metadata.robots.follow, false, filename);
    assert.ok(metadata.description.length > 15, filename);
    assert.ok(!titles.has(metadata.title), `Duplicate title on ${filename}`);
    titles.add(metadata.title);
    assert.equal(metadata.alternates, undefined, filename);
    assert.ok(!JSON.stringify(metadata).includes("@gmail.com"), filename);
    if (filename.includes("accept-invitation")) assert.equal(metadata.referrer, "no-referrer");
  }
  assert.equal(pages.length, 17);
});

test("sitemap contains only the public home URL", async () => {
  for (const context of ["production", "deploy-preview"]) {
    const seo = await load("app/lib/seo.ts", { APP_URL: "https://finance.example.com", CONTEXT: context });
    const { default: sitemap } = await load("app/sitemap.ts", {}, { "@/app/lib/seo": seo });
    assert.deepEqual(sitemap(), context === "production" ? [{ url: "https://finance.example.com/" }] : []);
  }
});

test("robots permits reading noindex tags but excludes API resources", async () => {
  for (const context of ["production", "branch-deploy"]) {
    const seo = await load("app/lib/seo.ts", { APP_URL: "https://finance.example.com", CONTEXT: context });
    const { default: robots } = await load("app/robots.ts", {}, { "@/app/lib/seo": seo });
    assert.deepEqual(robots().rules, { userAgent: "*", allow: "/", disallow: "/api/" });
    assert.equal(robots().sitemap, context === "production" ? "https://finance.example.com/sitemap.xml" : undefined);
  }
});

test("noindex headers cover private redirects and APIs, not the landing page", async () => {
  const headers = await (await load("next.config.ts")).default.headers();
  const paths = headers.map((rule) => rule.source);
  for (const route of ["/login", "/login-otp", "/signup", "/forgot-password", "/accept-invitation", "/dashboard", "/accounts", "/transactions", "/debts", "/planning", "/profile", "/documentation", "/admin", "/api"]) {
    assert.ok(paths.includes(route) || paths.includes(`${route}/:path*`), route);
  }
  assert.ok(!paths.includes("/") && !paths.includes("/:path*"));
  for (const rule of headers) assert.deepEqual(rule.headers, [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }]);
});

test("structured data describes actual features without fabricated ratings or user records", async () => {
  const seo = await load("app/lib/seo.ts");
  const graph = seo.getSiteStructuredData();
  assert.equal(graph["@context"], "https://schema.org");
  assert.deepEqual(graph["@graph"].map((node) => node["@type"]), ["WebSite", "WebApplication"]);
  for (const node of graph["@graph"]) {
    assert.equal(node.name, "NiveshFlow");
    assert.equal(node.url, seo.siteUrl.href);
    for (const field of ["aggregateRating", "offers", "email", "telephone"]) assert.equal(node[field], undefined);
  }
});

test("JSON-LD cannot break out of its script element", async () => {
  const seo = await load("app/lib/seo.ts");
  const fixture = { description: "</script><script>alert('fixture')</script>" };
  const serialized = seo.serializeStructuredData(fixture);
  assert.ok(!serialized.includes("<"));
  assert.deepEqual(JSON.parse(serialized), fixture);
});

test("landing markup stays static with its query notice isolated inside Suspense", async () => {
  const landing = await source("app/page.tsx");
  assert.match(landing, /export default function Home\(\)/);
  assert.match(landing, /<Suspense fallback=\{null\}><AccountDeletedNotice \/><\/Suspense>/);
  assert.equal((landing.match(/<h1\b/g) || []).length, 1);
  assert.match(landing, /serializeStructuredData\(getSiteStructuredData\(\)\)/);
  assert.ok(!landing.includes("await searchParams"));
  const notice = await source("app/components/landing/account-deleted-notice.tsx");
  assert.match(notice, /params\.get\("accountDeleted"\) !== "1"/);
  assert.match(notice, /params\.get\("notification"\) === "sent"/);
});

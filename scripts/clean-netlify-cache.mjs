import { lstat, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function insideRoot(workspace, target) {
  const relative = path.relative(workspace, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function cleanNetlifyCache(workspace = root, environment = process.env) {
  if (environment.NETLIFY !== "true") return [];

  const resolvedRoot = await realpath(workspace);
  const caches = [".next/cache/turbopack", ".netlify/.next/cache/turbopack"];
  const removed = [];

  // Remove only compiler caches, never deployable bundles or runtime/route caches.
  for (const cache of caches) {
    const target = path.resolve(resolvedRoot, cache);
    if (!insideRoot(resolvedRoot, target)) throw new Error("Compiler cache path is outside the workspace.");

    let info;
    try {
      info = await lstat(target);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }

    const resolvedTarget = await realpath(target);
    if (info.isSymbolicLink() || !info.isDirectory() || !insideRoot(resolvedRoot, resolvedTarget)) {
      throw new Error("Refusing to remove a compiler cache outside the workspace or through a symbolic link.");
    }

    await rm(target, { recursive: true });
    removed.push(cache);
  }

  return removed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await cleanNetlifyCache();
}

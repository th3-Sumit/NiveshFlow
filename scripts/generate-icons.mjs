import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "app/icon.svg"));
const sizes = [16, 32, 48, 64];
const frames = [];
for (const size of sizes) {
  frames.push(await sharp(source).resize(size, size).png().toBuffer());
}

// ICO directories can embed PNG frames, retaining transparency at each tab size.
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
for (const [index, frame] of frames.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index];
  directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frame.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
}

await writeFile(path.join(root, "app/favicon.ico"), Buffer.concat([directory, ...frames]));
await sharp(source).resize(180, 180).flatten({ background: "#008579" }).png().toFile(path.join(root, "app/apple-icon.png"));
console.log("Generated NiveshFlow favicon (16/32/48/64px) and Apple touch icon (180px).");

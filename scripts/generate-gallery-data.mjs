import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const galleryRoot = path.join(root, "src", ".vuepress", "public", "images", "gallery");
const outputFile = path.join(root, "src", ".vuepress", "data", "gallery.generated.ts");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

function normalizeText(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toTitleCase(raw) {
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function walk(dirPath, acc = []) {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return acc;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, acc);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (IMAGE_EXT.has(ext)) {
      acc.push(fullPath);
    }
  }

  return acc;
}

function inferCategory(relativePath) {
  const segments = relativePath.split(path.sep);
  return segments.length > 1 ? toTitleCase(segments[0]) : "Uncategorized";
}

function inferTags(baseName, category) {
  const rawParts = baseName
    .split(/[_\-\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 2 && !/^\d+$/.test(part));

  return Array.from(new Set([category.toLowerCase(), ...rawParts])).slice(0, 8);
}

function toWebPath(relativePath) {
  return `/images/gallery/${relativePath.split(path.sep).join("/")}`;
}

function buildItem(absPath, index, stat) {
  const relativePath = path.relative(galleryRoot, absPath);
  const ext = path.extname(relativePath);
  const base = path.basename(relativePath, ext);
  const category = inferCategory(relativePath);
  const slug = normalizeText(relativePath.replaceAll(ext, ""));
  const alt = toTitleCase(base) || `Photo ${index + 1}`;

  return {
    id: `local-${slug}`,
    slug,
    src: toWebPath(relativePath),
    alt,
    category,
    tags: inferTags(base, category),
    createdAt: new Date(stat.mtimeMs).toISOString().slice(0, 10),
    width: 1600,
    height: 1067,
  };
}

function toTsModule(items) {
  const payload = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      items,
    },
    null,
    2
  );

  return `import type { GalleryDataFile } from "./gallery-schema";\n\nexport const generatedGalleryData: GalleryDataFile = ${payload} as const;\n`;
}

async function main() {
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.mkdir(galleryRoot, { recursive: true });

  const files = await walk(galleryRoot);
  files.sort((a, b) => a.localeCompare(b));

  const items = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const stat = await fs.stat(file);
    items.push(buildItem(file, index, stat));
  }

  await fs.writeFile(outputFile, toTsModule(items), "utf8");

  console.log(`[gallery] scanned ${items.length} local images`);
  console.log(`[gallery] wrote ${path.relative(root, outputFile)}`);
}

main().catch((error) => {
  console.error("[gallery] failed to generate gallery data");
  console.error(error);
  process.exitCode = 1;
});

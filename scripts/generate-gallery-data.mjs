import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const galleryRoot = path.join(root, "src", ".vuepress", "public", "images", "gallery");
const outputFile = path.join(root, "src", ".vuepress", "data", "gallery.generated.ts");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const META_EXTENSIONS = [".meta.json", ".json"];

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

function normalizeTags(tags) {
  if (!tags) {
    return [];
  }

  const source = Array.isArray(tags) ? tags : String(tags).split(",");

  return Array.from(
    new Set(
      source
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0)
    )
  );
}

function toCaptureMedium(value) {
  return String(value).toLowerCase() === "film" ? "film" : "digital";
}

function toPhotoTone(value) {
  return String(value).toLowerCase() === "bw" ? "bw" : "color";
}

function inferYear(createdAt) {
  const date = createdAt ? new Date(createdAt) : null;
  const year = date ? date.getFullYear() : NaN;
  return Number.isFinite(year) && year > 1900 ? year : 1970;
}

function normalizeFacets(facets) {
  if (!facets || typeof facets !== "object") {
    return {};
  }

  const normalized = {};

  for (const [group, values] of Object.entries(facets)) {
    const normalizedValues = normalizeTags(values);
    if (normalizedValues.length > 0) {
      normalized[group.trim()] = normalizedValues;
    }
  }

  return normalized;
}

async function readSidecarMeta(absPath) {
  const dir = path.dirname(absPath);
  const ext = path.extname(absPath);
  const base = path.basename(absPath, ext);

  for (const metaExt of META_EXTENSIONS) {
    const metaPath = path.join(dir, `${base}${metaExt}`);
    try {
      const content = await fs.readFile(metaPath, "utf8");
      return JSON.parse(content);
    } catch {
      // Try next candidate or fall back to inferred metadata.
    }
  }

  return null;
}

function toWebPath(relativePath) {
  return `/images/gallery/${relativePath.split(path.sep).join("/")}`;
}

function buildItem(absPath, index, stat) {
  const relativePath = path.relative(galleryRoot, absPath);
  const ext = path.extname(relativePath);
  const base = path.basename(relativePath, ext);
  const slug = normalizeText(relativePath.replaceAll(ext, ""));
  const alt = toTitleCase(base) || `Photo ${index + 1}`;
  const folderTag = inferCategory(relativePath).toLowerCase();

  return {
    id: `local-${slug}`,
    slug,
    src: toWebPath(relativePath),
    alt,
    requiredMeta: {
      year: inferYear(new Date(stat.mtimeMs).toISOString()),
      medium: folderTag.includes("film") ? "film" : "digital",
      tone: "color",
    },
    tags: inferTags(base, folderTag),
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

  return `import type { GalleryDataFile } from "./gallery-schema.js";\n\nexport const generatedGalleryData: GalleryDataFile = ${payload} as const;\n`;
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
    const sidecar = await readSidecarMeta(file);
    const item = buildItem(file, index, stat);

    if (sidecar && typeof sidecar === "object") {
      item.alt = sidecar.alt || item.alt;
        const mergedTags = normalizeTags([
          ...normalizeTags(item.tags),
          ...normalizeTags(sidecar.tags),
          ...normalizeTags(sidecar.category),
        ]);

        item.tags = mergedTags.length > 0 ? mergedTags : item.tags;
      const sidecarRequired = sidecar.requiredMeta || {};
      const rawYear = sidecarRequired.year || sidecar.year || inferYear(sidecar.createdAt || item.createdAt);
      const rawMedium = sidecarRequired.medium || sidecar.medium || (item.tags.includes("film") ? "film" : "digital");
      const rawTone = sidecarRequired.tone || sidecar.tone || "color";

      item.requiredMeta = {
        year: Number(rawYear) || inferYear(item.createdAt),
        medium: toCaptureMedium(rawMedium),
        tone: toPhotoTone(rawTone),
      };
      item.facets = {
        ...item.facets,
        ...normalizeFacets(sidecar.facets),
      };
      item.description = sidecar.description || item.description;
      item.thumbnailSrc = sidecar.thumbnailSrc || item.thumbnailSrc;
      item.createdAt = sidecar.createdAt || item.createdAt;
      item.featured = Boolean(sidecar.featured ?? item.featured);
      item.disabled = Boolean(sidecar.disabled ?? item.disabled);
      item.width = sidecar.width || item.width;
      item.height = sidecar.height || item.height;
    }

    items.push(item);
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

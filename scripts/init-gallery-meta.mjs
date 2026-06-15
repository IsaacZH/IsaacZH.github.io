import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const galleryRoot = path.join(root, "src", ".vuepress", "public", "images", "gallery");
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const FORCE = process.argv.includes("--force");

function toTitleCase(raw) {
  return raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

async function walk(dir, acc = []) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, acc);
    else if (IMAGE_EXT.has(path.extname(e.name).toLowerCase())) acc.push(full);
  }
  return acc;
}

async function readExistingGenerated() {
  try {
    const src = await fs.readFile(
      path.join(root, "src", ".vuepress", "data", "gallery.generated.ts"), "utf8");
    const match = src.match(/GalleryDataFile = (\{[\s\S]*?\}) as const/);
    if (!match) return {};
    const data = JSON.parse(match[1]);
    const map = {};
    for (const item of data.items || []) map[item.src] = item;
    return map;
  } catch { return {}; }
}

async function main() {
  await fs.mkdir(galleryRoot, { recursive: true });
  const images = await walk(galleryRoot);
  images.sort((a, b) => a.localeCompare(b));
  const existing = await readExistingGenerated();
  let created = 0, skipped = 0;

  for (const imgPath of images) {
    const ext = path.extname(imgPath);
    const base = path.basename(imgPath, ext);
    const dir = path.dirname(imgPath);
    const metaPath = path.join(dir, `${base}.meta.json`);
    const relPath = path.relative(galleryRoot, imgPath).split(path.sep).join("/");
    const webSrc = `/images/gallery/${relPath}`;

    const alreadyExists = await fs.access(metaPath).then(() => true).catch(() => false);
    if (alreadyExists && !FORCE) { skipped++; continue; }

    const stat = await fs.stat(imgPath);
    const seed = existing[webSrc] || {};
    const year = seed.requiredMeta?.year || new Date(stat.mtimeMs).getFullYear();
    const folderTag = relPath.split("/")[0]?.toLowerCase() || "general";

    const meta = {
      requiredMeta: { year, medium: seed.requiredMeta?.medium || "digital" },
      alt: seed.alt || toTitleCase(base),
      createdAt: seed.createdAt || new Date(stat.mtimeMs).toISOString().slice(0, 10),
      tags: seed.tags?.length ? seed.tags : [folderTag],
      description: seed.description || "",
      facets: seed.facets || {},
      featured: seed.featured || false,
      disabled: seed.disabled || false,
    };

    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
    console.log(`  [created] ${path.relative(root, metaPath)}`);
    created++;
  }

  console.log(`\ngallery:init-meta  ${created} created, ${skipped} skipped`);
  if (skipped > 0) console.log("  Use --force to overwrite existing files.");
  if (created > 0) console.log("  Edit .meta.json files, then: npm run gallery:sync");
}

main().catch(err => { console.error(err); process.exitCode = 1; });

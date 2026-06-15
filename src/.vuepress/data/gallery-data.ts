import { generatedGalleryData } from "./gallery.generated";
import { seedGalleryItems } from "./gallery-seed";
import type { GalleryItem } from "./gallery-schema";

const FALLBACK_DATE = "1970-01-01";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeTags(tags: string[] | string | undefined): string[] {
  if (!tags) {
    return [];
  }

  const source = Array.isArray(tags) ? tags : tags.split(",");

  return Array.from(
    new Set(
      source
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0)
    )
  );
}

function normalizeItem(item: Partial<GalleryItem>, index: number): GalleryItem {
  const slugBase = item.slug || item.alt || `photo-${index + 1}`;
  const slug = normalizeText(slugBase) || `photo-${index + 1}`;

  return {
    id: item.id || `gallery-${slug}-${index}`,
    slug,
    src: item.src || "",
    alt: item.alt || `Untitled ${index + 1}`,
    category: item.category || "Uncategorized",
    tags: normalizeTags(item.tags),
    createdAt: item.createdAt || FALLBACK_DATE,
    thumbnailSrc: item.thumbnailSrc,
    description: item.description,
    width: item.width,
    height: item.height,
    disabled: item.disabled || false,
    featured: item.featured || false,
  };
}

function dedupeById(items: GalleryItem[]): GalleryItem[] {
  const seen = new Set<string>();
  const output: GalleryItem[] = [];

  for (const item of items) {
    if (!item.src || seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    output.push(item);
  }

  return output;
}

const normalizedGenerated = generatedGalleryData.items.map((item, index) =>
  normalizeItem(item, index)
);
const normalizedSeed = seedGalleryItems.map((item, index) => normalizeItem(item, index + 1000));

export const galleryItems = dedupeById([...normalizedGenerated, ...normalizedSeed]).filter(
  (item) => !item.disabled
);

export const galleryConfig = {
  defaultPageSize: 6,
};

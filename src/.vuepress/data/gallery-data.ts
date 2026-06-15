import { generatedGalleryData } from "./gallery.generated.js";
import { seedGalleryItems } from "./gallery-seed.js";
import type { CaptureMedium, GalleryItem, PhotoTone } from "./gallery-schema.js";

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

function normalizeFacets(facets: GalleryItem["facets"]): Record<string, string[]> {
  if (!facets || typeof facets !== "object") {
    return {};
  }

  const normalized: Record<string, string[]> = {};

  for (const [group, values] of Object.entries(facets as Record<string, string[] | string>)) {
    const normalizedValues = normalizeTags(values);
    if (normalizedValues.length > 0) {
      normalized[group.trim()] = normalizedValues;
    }
  }

  return normalized;
}

function toCaptureMedium(value: unknown): CaptureMedium {
  return String(value).toLowerCase() === "film" ? "film" : "digital";
}

function toPhotoTone(value: unknown): PhotoTone {
  return String(value).toLowerCase() === "bw" ? "bw" : "color";
}

function inferYear(createdAt: string | undefined): number {
  const date = createdAt ? new Date(createdAt) : null;
  const year = date ? date.getFullYear() : NaN;
  return Number.isFinite(year) && year > 1900 ? year : 1970;
}

function normalizeRequiredMeta(item: Partial<GalleryItem>, normalizedTags: string[]): GalleryItem["requiredMeta"] {
  const source = item.requiredMeta || ({} as GalleryItem["requiredMeta"]);
  const mediumFromTags = normalizedTags.includes("film") ? "film" : "digital";

  return {
    year: Number(source.year) || inferYear(item.createdAt),
    medium: toCaptureMedium(source.medium || mediumFromTags),
    tone: toPhotoTone(source.tone),
  };
}

function normalizeItem(item: Partial<GalleryItem>, index: number): GalleryItem {
  const slugBase = item.slug || item.alt || `photo-${index + 1}`;
  const slug = normalizeText(slugBase) || `photo-${index + 1}`;
  const normalizedTags = normalizeTags(item.tags);

  return {
    id: item.id || `gallery-${slug}-${index}`,
    slug,
    src: item.src || "",
    alt: item.alt || `Untitled ${index + 1}`,
    requiredMeta: normalizeRequiredMeta(item, normalizedTags),
    tags: normalizedTags,
    facets: normalizeFacets(item.facets),
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

const normalizedGenerated = generatedGalleryData.items.map((item: Partial<GalleryItem>, index: number) =>
  normalizeItem(item, index)
);
const normalizedSeed = seedGalleryItems.map((item: Partial<GalleryItem>, index: number) => normalizeItem(item, index + 1000));

export const galleryItems = dedupeById([...normalizedGenerated, ...normalizedSeed]).filter(
  (item) => !item.disabled
);

export const galleryConfig = {
  defaultPageSize: 15,
};

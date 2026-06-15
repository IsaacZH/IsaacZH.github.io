export type CaptureMedium = "digital" | "film";

export interface RequiredMeta {
  year: number;
  medium: CaptureMedium;
}

export interface GalleryItem {
  id: string;
  slug: string;
  src: string;
  alt: string;
  requiredMeta: RequiredMeta;
  tags: string[] | string;
  facets?: Record<string, string[] | string>;
  createdAt: string;
  thumbnailSrc?: string;
  description?: string;
  width?: number;
  height?: number;
  disabled?: boolean;
  featured?: boolean;
}

export interface GalleryDataFile {
  generatedAt: string;
  items: GalleryItem[];
}

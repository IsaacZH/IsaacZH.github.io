export interface GalleryItem {
  id: string;
  slug: string;
  src: string;
  alt: string;
  category: string;
  tags: string[] | string;
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

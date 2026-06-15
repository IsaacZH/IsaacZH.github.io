<template>
    <section class="gallery-shell">
        <div class="toolbar">
            <div class="categories" role="tablist" aria-label="Image categories">
                <button
                    v-for="category in categories"
                    :key="category"
                    :class="['category-button', { active: selectedCategory === category }]"
                    role="tab"
                    :aria-selected="selectedCategory === category"
                    @click="selectedCategory = category"
                >
                    {{ category }}
                </button>
            </div>

            <div class="controls">
                <input
                    v-model.trim="searchQuery"
                    type="search"
                    class="search-input"
                    placeholder="Search by title, tag, or category"
                    aria-label="Search images"
                />
                <select v-model="sortBy" class="sort-select" aria-label="Sort images">
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="title">Title</option>
                </select>
            </div>
        </div>

        <div class="result-meta">
            <span>{{ filteredItems.length }} photos</span>
            <span v-if="searchQuery">for "{{ searchQuery }}"</span>
        </div>

        <div class="gallery-grid">
            <button
                v-for="(item, index) in visibleItems"
                :key="item.id"
                class="gallery-item"
                type="button"
                @click="openPreview(index)"
            >
                <img
                    :src="item.thumbnailSrc || item.src"
                    :alt="item.alt"
                    loading="lazy"
                    decoding="async"
                />
                <span class="chip">{{ item.category }}</span>
            </button>
        </div>

        <div v-if="hasMore" class="load-more-wrap">
            <button type="button" class="load-more" @click="loadMore">Load more</button>
        </div>
    </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";
import { galleryConfig, galleryItems } from "../data/gallery-data";

const items = galleryItems;

const selectedCategory = ref("All");
const searchQuery = ref("");
const sortBy = ref("newest");
const pageSize = galleryConfig.defaultPageSize;
const visibleCount = ref(pageSize);

const HASH_PREFIX = "#/gallery/";

const lightbox = ref(null);
const pendingOpenIndex = ref(null);
const skipHashClearOnce = ref(false);

const categories = computed(() => {
    const values = new Set(items.map((item) => item.category));
    return ["All", ...Array.from(values)];
});

const filteredItems = computed(() => {
    const query = searchQuery.value.toLowerCase();

    let list = items.filter((item) => {
        const byCategory =
            selectedCategory.value === "All" || item.category === selectedCategory.value;

        if (!query) {
            return byCategory;
        }

        const searchable = [item.alt, item.category, item.tags.join(" ")]
            .join(" ")
            .toLowerCase();

        return byCategory && searchable.includes(query);
    });

    list = [...list].sort((a, b) => {
        if (sortBy.value === "title") {
            return a.alt.localeCompare(b.alt);
        }

        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();

        if (sortBy.value === "oldest") {
            return aTime - bTime;
        }

        return bTime - aTime;
    });

    return list;
});

const visibleItems = computed(() => filteredItems.value.slice(0, visibleCount.value));
const hasMore = computed(() => visibleItems.value.length < filteredItems.value.length);

watch([selectedCategory, searchQuery, sortBy], () => {
    visibleCount.value = pageSize;
    tryRestoreFromHash();
});

watch(visibleItems, () => {
    if (pendingOpenIndex.value !== null && pendingOpenIndex.value < visibleItems.value.length) {
        nextTick(() => {
            openPreview(pendingOpenIndex.value);
            pendingOpenIndex.value = null;
        });
    }
});

function parseHashIndex() {
    if (typeof window === "undefined") {
        return null;
    }

    if (!window.location.hash.startsWith(HASH_PREFIX)) {
        return null;
    }

    const value = Number.parseInt(window.location.hash.slice(HASH_PREFIX.length), 10);
    if (Number.isNaN(value) || value < 0) {
        return null;
    }
    return value;
}

function syncHash(index) {
    if (typeof window === "undefined") {
        return;
    }
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${HASH_PREFIX}${index}`);
}

function clearHash() {
    if (typeof window === "undefined") {
        return;
    }

    if (skipHashClearOnce.value) {
        skipHashClearOnce.value = false;
        return;
    }

    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

function toSlide(item) {
    return {
        src: item.src,
        msrc: item.thumbnailSrc || item.src,
        alt: item.alt,
        width: item.width || 1600,
        height: item.height || 1067,
    };
}

function initLightbox() {
    const instance = new PhotoSwipeLightbox({
        dataSource: () => visibleItems.value.map(toSlide),
        pswpModule: () => import("photoswipe"),
        wheelToZoom: true,
    });

    instance.on("change", () => {
        const curr = instance.pswp?.currIndex;
        if (typeof curr === "number") {
            syncHash(curr);
        }
    });

    instance.on("close", () => {
        clearHash();
    });

    instance.init();
    lightbox.value = instance;
}

function handleHashChange() {
    const parsed = parseHashIndex();
    if (parsed === null) {
        return;
    }

    if (parsed < visibleItems.value.length) {
        skipHashClearOnce.value = true;
        openPreview(parsed);
        return;
    }

    pendingOpenIndex.value = parsed;
}

function tryRestoreFromHash() {
    const parsed = parseHashIndex();
    if (parsed === null) {
        pendingOpenIndex.value = null;
        return;
    }

    pendingOpenIndex.value = parsed;
}

onMounted(() => {
    initLightbox();
    tryRestoreFromHash();

    if (typeof window !== "undefined") {
        window.addEventListener("hashchange", handleHashChange);
    }

    if (pendingOpenIndex.value !== null) {
        nextTick(() => {
            handleHashChange();
        });
    }
});

onBeforeUnmount(() => {
    lightbox.value?.destroy();

    if (typeof window !== "undefined") {
        window.removeEventListener("hashchange", handleHashChange);
    }
});

function loadMore() {
    visibleCount.value += pageSize;
}

function openPreview(index) {
    if (!lightbox.value) {
        return;
    }
    syncHash(index);
    skipHashClearOnce.value = true;
    lightbox.value.loadAndOpen(index);
}
</script>

<style scoped>
.gallery-shell {
    width: min(1100px, 100%);
    margin: 0 auto;
}

.toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 14px;
}

.categories {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.category-button {
    position: relative;
    border: 1px solid transparent;
    border-radius: 999px;
    padding: 7px 14px;
    background: rgba(255, 255, 255, 0.03);
    color: #999999;
    cursor: pointer;
    transition: border-color 0.2s ease, transform 0.2s ease;
}

.category-button:hover {
    border-color: rgba(153, 153, 153, 0.45);
    transform: translateY(-1px);
}

.category-button.active {
    border-color: rgba(153, 153, 153, 0.8);
}

.controls {
    display: flex;
    align-items: center;
    gap: 10px;
}

.search-input,
.sort-select {
    border-radius: 8px;
    border: 1px solid rgba(153, 153, 153, 0.35);
    background: rgba(255, 255, 255, 0.03);
    color: inherit;
    padding: 8px 10px;
}

.search-input {
    min-width: 240px;
}

.result-meta {
    color: #8d8d8d;
    margin-bottom: 16px;
    display: flex;
    gap: 8px;
    font-size: 14px;
}

.gallery-grid {
    column-count: 3;
    column-gap: 14px;
}

.gallery-item {
    position: relative;
    width: 100%;
    border: 0;
    background: transparent;
    padding: 0;
    margin: 0 0 14px;
    break-inside: avoid;
    border-radius: 10px;
    overflow: hidden;
    cursor: zoom-in;
}

.gallery-item img {
    width: 100%;
    display: block;
    transition: transform 0.25s ease;
}

.gallery-item:hover img {
    transform: scale(1.02);
}

.chip {
    position: absolute;
    left: 8px;
    bottom: 8px;
    background: rgba(0, 0, 0, 0.5);
    color: #f4f4f4;
    font-size: 12px;
    border-radius: 999px;
    padding: 2px 8px;
}

.load-more-wrap {
    display: flex;
    justify-content: center;
    margin-top: 10px;
}

.load-more {
    border: 1px solid rgba(153, 153, 153, 0.45);
    background: transparent;
    color: inherit;
    border-radius: 999px;
    padding: 8px 16px;
    cursor: pointer;
}

@media (max-width: 960px) {
    .gallery-grid {
        column-count: 2;
    }

    .controls {
        width: 100%;
    }

    .search-input {
        min-width: 0;
        flex: 1;
    }
}

@media (max-width: 640px) {
    .gallery-grid {
        column-count: 1;
    }
}
</style>

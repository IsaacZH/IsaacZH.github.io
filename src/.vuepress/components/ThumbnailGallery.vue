<template>
    <section class="gallery-shell">
        <div class="toolbar">
            <div class="categories" role="tablist" aria-label="Image tags">
                <button
                    :class="['category-button', { active: selectedTags.length === 0 }]"
                    role="tab"
                    :aria-selected="selectedTags.length === 0"
                    @click="clearTagFilters"
                >
                    All
                </button>
                <button
                    v-for="option in visibleTagOptions"
                    :key="option.tag"
                    :class="['category-button', { active: selectedTags.includes(option.tag) }]"
                    role="tab"
                    :aria-selected="selectedTags.includes(option.tag)"
                    @click="toggleTag(option.tag)"
                >
                    {{ option.tag }}
                    <span class="tag-count">{{ option.count }}</span>
                </button>

                <button
                    v-if="tagFilters.length > maxVisibleTags"
                    class="category-button ghost"
                    role="tab"
                    :aria-selected="tagsExpanded"
                    @click="tagsExpanded = !tagsExpanded"
                >
                    {{ tagsExpanded ? 'Less' : `More (${tagFilters.length - maxVisibleTags})` }}
                </button>
            </div>

            <div class="controls">
                <input
                    v-model.trim="searchQuery"
                    type="search"
                    class="search-input"
                    placeholder="Search by title, tag, or facet"
                    aria-label="Search images"
                />
                <select v-model="selectedYear" class="sort-select" aria-label="Filter by year">
                    <option value="All">All years</option>
                    <option v-for="year in yearFilters" :key="year" :value="String(year)">
                        {{ year }}
                    </option>
                </select>
                <select v-model="selectedMedium" class="sort-select" aria-label="Filter by medium">
                    <option value="all">All medium</option>
                    <option value="digital">Digital</option>
                    <option value="film">Film</option>
                </select>
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
            <span v-if="selectedTags.length">tags {{ selectedTags.join(', ') }}</span>
            <span v-if="selectedYear !== 'All'">year {{ selectedYear }}</span>
            <span v-if="selectedMedium !== 'all'">{{ selectedMedium }}</span>
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
                    @load="rememberImageSize(item.id, $event)"
                />
                <span class="chip">{{ item.requiredMeta.year }} · {{ item.requiredMeta.medium }}</span>
            </button>
        </div>

        <div v-if="hasMore" class="load-more-wrap">
            <button type="button" class="load-more" @click.stop.prevent="loadMore">Load more</button>
        </div>
    </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";
import { galleryConfig, galleryItems } from "../data/gallery-data";

const items = galleryItems;

const selectedTags = ref([]);
const selectedYear = ref("All");
const selectedMedium = ref("all");
const searchQuery = ref("");
const sortBy = ref("newest");
const pageSize = galleryConfig.defaultPageSize;
const visibleCount = ref(pageSize);
const maxVisibleTags = 12;
const tagsExpanded = ref(false);

const HASH_PREFIX = "#/gallery/";

const lightbox = ref(null);
const pendingOpenIndex = ref(null);
const imageSizeById = ref({});

const tagFilters = computed(() => {
    const tagCountMap = new Map();
    for (const item of items) {
        for (const tag of item.tags) {
            tagCountMap.set(tag, (tagCountMap.get(tag) || 0) + 1);
        }
    }

    return Array.from(tagCountMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
});

const visibleTagOptions = computed(() => {
    if (tagsExpanded.value) {
        return tagFilters.value;
    }
    return tagFilters.value.slice(0, maxVisibleTags);
});

const yearFilters = computed(() => {
    const values = new Set(items.map((item) => item.requiredMeta.year));
    return Array.from(values).sort((a, b) => b - a);
});

const filteredItems = computed(() => {
    const query = searchQuery.value.toLowerCase();

    const flattenFacets = (facets) => {
        if (!facets || typeof facets !== "object") {
            return "";
        }

        return Object.entries(facets)
            .flatMap(([group, values]) => [group, ...(Array.isArray(values) ? values : String(values).split(","))])
            .join(" ")
            .toLowerCase();
    };

    let list = items.filter((item) => {
        const byTag =
            selectedTags.value.length === 0 || selectedTags.value.some((tag) => item.tags.includes(tag));
        const byYear = selectedYear.value === "All" || String(item.requiredMeta.year) === selectedYear.value;
        const byMedium = selectedMedium.value === "all" || item.requiredMeta.medium === selectedMedium.value;

        if (!query) {
            return byTag && byYear && byMedium;
        }

        const searchable = [
            item.alt,
            item.requiredMeta.year,
            item.requiredMeta.medium,
            item.tags.join(" "),
            flattenFacets(item.facets),
        ]
            .join(" ")
            .toLowerCase();

        return byTag && byYear && byMedium && searchable.includes(query);
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

watch([selectedTags, selectedYear, selectedMedium, searchQuery, sortBy], () => {
    visibleCount.value = pageSize;
    tryRestoreFromHash();
});

function toggleTag(tag) {
    if (selectedTags.value.includes(tag)) {
        selectedTags.value = selectedTags.value.filter((item) => item !== tag);
        return;
    }

    selectedTags.value = [...selectedTags.value, tag];
}

function clearTagFilters() {
    selectedTags.value = [];
}

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

    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

function toSlide(item) {
    const rememberedSize = imageSizeById.value[item.id];
    const width = rememberedSize?.width || item.width || 1600;
    const height = rememberedSize?.height || item.height || 1067;

    return {
        src: item.src,
        msrc: item.thumbnailSrc || item.src,
        alt: item.alt,
        width,
        height,
        w: width,
        h: height,
    };
}

function rememberImageSize(id, event) {
    const target = event?.target;
    if (!(target instanceof HTMLImageElement)) {
        return;
    }

    const width = target.naturalWidth;
    const height = target.naturalHeight;
    if (!width || !height) {
        return;
    }

    imageSizeById.value = {
        ...imageSizeById.value,
        [id]: { width, height },
    };
}

function ensureImageSize(item) {
    if (imageSizeById.value[item.id]) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        if (typeof window === "undefined") {
            resolve(undefined);
            return;
        }

        const probe = new Image();
        probe.onload = () => {
            imageSizeById.value = {
                ...imageSizeById.value,
                [item.id]: {
                    width: probe.naturalWidth || item.width || 1600,
                    height: probe.naturalHeight || item.height || 1067,
                },
            };
            resolve(undefined);
        };
        probe.onerror = () => resolve(undefined);
        probe.src = item.src;
    });
}

function initLightbox() {
    const instance = new PhotoSwipeLightbox({
        pswpModule: () => import("photoswipe"),
        wheelToZoom: true,
        imageClickAction: "zoom",
        tapAction: "zoom",
        doubleTapAction: "zoom",
        clickToCloseNonZoomable: false,
        initialZoomLevel: "fit",
        secondaryZoomLevel: 2,
        maxZoomLevel: 4,
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

async function openPreview(index) {
    if (!lightbox.value) {
        return;
    }

    const targetItem = visibleItems.value[index];
    if (targetItem) {
        await ensureImageSize(targetItem);
    }

    const dataSource = visibleItems.value.map(toSlide);
    if (dataSource.length === 0 || index >= dataSource.length) {
        return;
    }

    syncHash(index);
    lightbox.value.loadAndOpen(index, dataSource);
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

.category-button.ghost {
    opacity: 0.9;
}

.tag-count {
    margin-left: 6px;
    font-size: 11px;
    opacity: 0.75;
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

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

        <div v-if="isPreviewOpen && currentItem" class="lightbox" @click.self="closePreview">
            <button type="button" class="nav prev" aria-label="Previous" @click="prevItem">‹</button>

            <figure class="lightbox-body">
                <img :src="currentItem.src" :alt="currentItem.alt" />
                <figcaption>
                    <h3>{{ currentItem.alt }}</h3>
                    <p>{{ currentItem.category }} · {{ formatDate(currentItem.createdAt) }}</p>
                </figcaption>

                <div v-if="relatedItems.length" class="related-strip">
                    <button
                        v-for="item in relatedItems"
                        :key="item.id"
                        type="button"
                        class="related-item"
                        @click="jumpToItem(item.id)"
                    >
                        <img :src="item.thumbnailSrc || item.src" :alt="item.alt" loading="lazy" />
                    </button>
                </div>
            </figure>

            <button type="button" class="nav next" aria-label="Next" @click="nextItem">›</button>
            <button type="button" class="close" aria-label="Close" @click="closePreview">✕</button>
        </div>
    </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const rawItems = [
    {
        src: "https://raw.githubusercontent.com/IsaacZH/FigureBed/master/000022.JPG",
        alt: "Photo 1",
        category: "Portrait",
        tags: ["people", "moody"],
        createdAt: "2024-01-09",
    },
    {
        src: "https://raw.githubusercontent.com/IsaacZH/FigureBed/master/_MG_0216-Pano.jpg",
        alt: "Photo 2",
        category: "Urban",
        tags: ["city", "night"],
        createdAt: "2024-02-04",
    },
    {
        src: "https://raw.githubusercontent.com/IsaacZH/FigureBed/master/202406241328148.jpg",
        alt: "Photo 3",
        category: "Landscape",
        tags: ["nature", "sunset"],
        createdAt: "2024-06-24",
    },
    {
        src: "https://raw.githubusercontent.com/IsaacZH/FigureBed/master/202408242130419.jpg",
        alt: "Photo 4",
        category: "Landscape",
        tags: ["mountain", "travel"],
        createdAt: "2024-08-24",
    },
    {
        src: "https://raw.githubusercontent.com/IsaacZH/FigureBed/master/202408242130418.jpg",
        alt: "Photo 5",
        category: "Landscape",
        tags: ["cloud", "travel"],
        createdAt: "2024-08-24",
    },
    {
        src: "https://raw.githubusercontent.com/IsaacZH/FigureBed/master/202408242130416.jpg",
        alt: "Photo 6",
        category: "Landscape",
        tags: ["golden-hour", "nature"],
        createdAt: "2024-08-24",
    },
    {
        src: "https://raw.githubusercontent.com/IsaacZH/FigureBed/master/202408242135360.jpg",
        alt: "Photo 7",
        category: "Landscape",
        tags: ["valley", "hike"],
        createdAt: "2024-08-24",
    },
    {
        src: "https://raw.githubusercontent.com/IsaacZH/FigureBed/master/202408242135361.jpg",
        alt: "Photo 8",
        category: "Landscape",
        tags: ["fog", "hike"],
        createdAt: "2024-08-24",
    },
];

const items = rawItems.map((item, index) => ({
    id: `${index}-${item.src}`,
    ...item,
    createdAt: item.createdAt || "1970-01-01",
    tags: item.tags || [],
}));

const selectedCategory = ref("All");
const searchQuery = ref("");
const sortBy = ref("newest");
const pageSize = 6;
const visibleCount = ref(pageSize);

const isPreviewOpen = ref(false);
const currentIndex = ref(0);

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

const currentItem = computed(() => visibleItems.value[currentIndex.value] || null);

const relatedItems = computed(() => {
    if (!currentItem.value) {
        return [];
    }

    return visibleItems.value
        .filter((item) => item.id !== currentItem.value.id)
        .map((item) => {
            const sameCategory = item.category === currentItem.value.category ? 2 : 0;
            const sharedTags = item.tags.filter((tag) => currentItem.value.tags.includes(tag)).length;
            return { item, score: sameCategory + sharedTags };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((entry) => entry.item);
});

watch([selectedCategory, searchQuery, sortBy], () => {
    visibleCount.value = pageSize;
    currentIndex.value = 0;
});

watch(isPreviewOpen, (open) => {
    if (typeof document !== "undefined") {
        document.body.style.overflow = open ? "hidden" : "";
    }
});

const handleKeydown = (event) => {
    if (!isPreviewOpen.value) {
        return;
    }

    if (event.key === "Escape") {
        closePreview();
    }

    if (event.key === "ArrowLeft") {
        prevItem();
    }

    if (event.key === "ArrowRight") {
        nextItem();
    }
};

onMounted(() => {
    if (typeof window !== "undefined") {
        window.addEventListener("keydown", handleKeydown);
    }
});

onBeforeUnmount(() => {
    if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handleKeydown);
    }
    if (typeof document !== "undefined") {
        document.body.style.overflow = "";
    }
});

function loadMore() {
    visibleCount.value += pageSize;
}

function openPreview(index) {
    currentIndex.value = index;
    isPreviewOpen.value = true;
}

function closePreview() {
    isPreviewOpen.value = false;
}

function prevItem() {
    const total = visibleItems.value.length;
    if (!total) {
        return;
    }
    currentIndex.value = (currentIndex.value - 1 + total) % total;
}

function nextItem() {
    const total = visibleItems.value.length;
    if (!total) {
        return;
    }
    currentIndex.value = (currentIndex.value + 1) % total;
}

function jumpToItem(id) {
    const targetIndex = visibleItems.value.findIndex((item) => item.id === id);
    if (targetIndex >= 0) {
        currentIndex.value = targetIndex;
    }
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Unknown date";
    }
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
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

.lightbox {
    position: fixed;
    inset: 0;
    z-index: 999;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
}

.lightbox-body {
    max-width: min(1100px, 90vw);
    max-height: 90vh;
    margin: 0;
}

.lightbox-body img {
    max-width: 100%;
    max-height: 74vh;
    display: block;
    margin: 0 auto;
    border-radius: 10px;
}

.lightbox-body figcaption {
    color: #d8d8d8;
    text-align: center;
    margin-top: 10px;
}

.lightbox-body h3 {
    margin: 0;
    font-size: 18px;
}

.lightbox-body p {
    margin: 4px 0 0;
    color: #aaaaaa;
}

.related-strip {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
}

.related-item {
    width: 72px;
    height: 72px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 6px;
    padding: 0;
    overflow: hidden;
    background: transparent;
    cursor: pointer;
}

.related-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.close,
.nav {
    position: absolute;
    border: 0;
    background: rgba(255, 255, 255, 0.1);
    color: #f5f5f5;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    cursor: pointer;
}

.close {
    top: 16px;
    right: 16px;
}

.nav.prev {
    left: 24px;
}

.nav.next {
    right: 24px;
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

    .nav.prev {
        left: 10px;
    }

    .nav.next {
        right: 10px;
    }
}

@media (max-width: 640px) {
    .gallery-grid {
        column-count: 1;
    }
}
</style>

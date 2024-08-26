<template>
    <div>
        <!-- 分类按钮 -->
        <div class="categories">
            <button v-for="(category, index) in categories" :key="index" @click="selectedCategory = category"
                :class="{ active: selectedCategory === category }">
                {{ category }}
            </button>
        </div>

        <!-- 瀑布流图片展示 -->
        <div class="gallery-grid">
            <div v-for="(item, index) in filteredItems" :key="index" class="gallery-item">
                <img :src="item.src" :alt="item.alt" />
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            categories: ['All', 'Landscape', 'Portrait', 'Urban'], // 示例分类
            selectedCategory: 'All',
            items: [
                { src: 'https://raw.githubusercontent.com/IsaacZH/FigureBed/master/000022.JPG', alt: 'Photo 1', category: 'Landscape' },
                { src: 'https://raw.githubusercontent.com/IsaacZH/FigureBed/master/_MG_0216-Pano.jpg', alt: 'Photo 2', category: 'Portrait' },
                { src: 'https://raw.githubusercontent.com/IsaacZH/FigureBed/master/202406241328148.jpg', alt: 'Photo 3', category: 'Landscape' },
                { src: 'https://raw.githubusercontent.com/IsaacZH/FigureBed/master/000022.JPG', alt: 'Photo 4', category: 'Portrait' },
                // 更多图片
            ],
        };
    },
    computed: {
        filteredItems() {
            if (this.selectedCategory === 'All') {
                return this.items;
            }
            return this.items.filter(item => item.category === this.selectedCategory);
        },
    },
};
</script>

<style scoped>
.categories {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
}

.categories button {
    margin: 0 10px;
    padding: 10px 20px;
    cursor: pointer;
}

.categories button.active {
    background-color: #333;
    color: #fff;
}

.gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 10px;
}

.gallery-item img {
    width: 100%;
    height: auto;
    display: block;
}
</style>


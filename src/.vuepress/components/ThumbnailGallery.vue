<template>
    <div>
        <!-- 分类按钮 -->
        <div class="categories">
            <button v-for="(category, index) in categories" :key="index" @click="selectedCategory = category"
                :class="{ active: selectedCategory === category }" class="category-button">
                {{ category }}
            </button>
        </div>

        <!-- 瀑布流图片展示 -->
        <div class="gallery-grid">
            <div v-for="(item, index) in filteredItems" :key="index" class="gallery-item" @click="openPreview(item)">
                <img :src="item.thumbnailSrc || item.src" :alt="item.alt" />
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
                { src: 'https://raw.githubusercontent.com/IsaacZH/FigureBed/master/000022.JPG', alt: 'Photo 1', category: 'Portrait' },
                { src: 'https://raw.githubusercontent.com/IsaacZH/FigureBed/master/_MG_0216-Pano.jpg', alt: 'Photo 2', category: 'Urban' },
                { src: 'https://raw.githubusercontent.com/IsaacZH/FigureBed/master/202406241328148.jpg', alt: 'Photo 3', category: 'Landscape' },
                { src: 'https://raw.githubusercontent.com/IsaacZH/FigureBed/master/202408242130419.jpg', alt: 'Photo 4', category: 'Landscape' },
                { src: 'https://raw.githubusercontent.com/IsaacZH/FigureBed/master/202408242130418.jpg', alt: 'Photo 4', category: 'Landscape' },
                { src: 'https://raw.githubusercontent.com/IsaacZH/FigureBed/master/202408242130416.jpg', alt: 'Photo 4', category: 'Landscape' },
                { src: 'https://raw.githubusercontent.com/IsaacZH/FigureBed/master/202408242135360.jpg', alt: 'Photo 4', category: 'Landscape' },
                { src: 'https://raw.githubusercontent.com/IsaacZH/FigureBed/master/202408242135361.jpg', alt: 'Photo 4', category: 'Landscape' },
                // 更多图片
            ],
            isPreviewOpen: false, // 控制模态框显示
            currentItem: {}, // 存储当前预览的图片信息
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
    methods: {
        openPreview(item) {
            this.currentItem = item;
            this.isPreviewOpen = true;
        },
        closePreview() {
            this.isPreviewOpen = false;
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

.category-button {
    position: relative;
    margin: 0 10px;
    padding: 10px 20px;
    background: none;
    border: none;
    color: #999999;
    /* 文字颜色设为白色 */
    cursor: pointer;
    font-size: 16px;
    outline: none;
    transition: color 0.3s ease;
}

.category-button::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 0;
    height: 2px;
    background-color: #999999;
    /* 动画条颜色设为白色 */
    transition: width 0.3s ease, left 0.3s ease;
}

.category-button:hover {
    color: #999999;
    /* 鼠标悬停时保持文字颜色为白色 */
}

.category-button:hover::after {
    width: 100%;
    left: 0;
}

.category-button.active {
    color: #999999;
    /* 激活状态时保持文字颜色为白色 */
}

.category-button.active::after {
    width: 100%;
    left: 0;
    background-color: #999999;
    /* 激活状态时动画条颜色为白色 */
}

/* 瀑布流布局 */
.gallery-grid {
    column-count: 3;
    /* 设置列数，可以根据需求调整 */
    column-gap: 15px;
}

.gallery-item {
    break-inside: avoid;
    /* 防止图片被打断 */
    margin-bottom: 15px;
    cursor: pointer;
}

.gallery-item img {
    width: 100%;
    height: auto;
    display: block;
}

.caption {
    text-align: center;
    color: #ccc;
    padding: 10px 0;
}

.close {
    position: absolute;
    top: 20px;
    right: 30px;
    color: #999999;
    font-size: 40px;
    font-weight: bold;
    cursor: pointer;
}

.close:hover,
.close:focus {
    color: #bbb;
    text-decoration: none;
    cursor: pointer;
}
</style>

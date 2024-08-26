import { defineClientConfig } from "@vuepress/client";
import ThumbnailGallery from "./components/ThumbnailGallery.vue";

export default defineClientConfig({
  enhance({ app }) {
    app.component("ThumbnailGallery", ThumbnailGallery);
  },
});


import { defineUserConfig } from "vuepress";

import theme from "./theme.js";

export default defineUserConfig({
  base: "/IsaacZH.github.io/",

  lang: "en-US",
  title: "Isaac",
  description: "Isaac's blog",

  theme,

  // Enable it with pwa
  // shouldPrefetch: false,
});

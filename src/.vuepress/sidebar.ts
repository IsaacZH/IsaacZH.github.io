import { sidebar } from "vuepress-theme-hope";

export default sidebar({
  "/": [
    "",
    {
      text: "Blog",
      icon: "book",
      prefix: "blog/",
      link: "blog/",
      children: "structure",
    },

  ],
});

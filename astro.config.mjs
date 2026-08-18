// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

/**
 * KaTeX builds negated relations by overlaying a solidus on the base symbol.
 * In this release the overlay lands *beside* the symbol instead of across it,
 * so `\neq` reads as "a / = 0" — dangerously close to "a = 0". Mapping the
 * negated relations onto their real Unicode glyphs fixes every occurrence at
 * once, including in future articles.
 */
const katexMacros = {
  '\\neq': '\\mathrel{\\char"2260}',
  '\\ne': '\\mathrel{\\char"2260}',
  '\\notin': '\\mathrel{\\char"2209}',
  '\\nsubseteq': '\\mathrel{\\char"2288}',
  '\\nleq': '\\mathrel{\\char"2270}',
  '\\ngeq': '\\mathrel{\\char"2271}',
};

// `meth04.github.io` is a GitHub *user* site, so it is served from the domain
// root. No `base` path is needed; keeping it at '/' avoids links that work
// locally but 404 on GitHub Pages.
export default defineConfig({
  site: 'https://meth04.github.io',
  base: '/',
  trailingSlash: 'always',
  build: {
    // Emit `/blog/slug/index.html` so that direct navigation to a nested URL
    // (and refreshing on it) works on GitHub Pages, which has no rewrite rules.
    format: 'directory',
  },
  integrations: [
    mdx(),
    // The search page is marked noindex, so it does not belong in the sitemap.
    sitemap({ filter: (page) => !page.includes('/search/') }),
  ],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        [rehypeKatex, { output: 'htmlAndMathml', strict: false, macros: katexMacros }],
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'prepend',
            test: ['h2', 'h3', 'h4'],
            properties: { class: 'heading-anchor', 'aria-hidden': 'true', tabindex: -1 },
            // Empty: the "#" is drawn by CSS, so it never becomes part of the
            // heading's text and cannot leak into the table of contents or into
            // whatever a reader copies.
            content: [],
          },
        ],
      ],
    }),
    shikiConfig: {
      theme: 'github-light',
      wrap: false,
    },
  },
  vite: {
    build: {
      cssCodeSplit: true,
    },
  },
});

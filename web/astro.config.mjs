import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

const locales = ['it', 'en', 'fr', 'es', 'de', 'el', 'sq', 'ar', 'zh', 'ja'];

export default defineConfig({
  site: 'https://presicceproloco.org',
  trailingSlash: 'always',
  // Tutte le pagine sono statiche; solo /api/translate gira come funzione Vercel.
  output: 'static',
  adapter: vercel(),
  i18n: {
    defaultLocale: 'it',
    locales,
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/api/'),
      i18n: { defaultLocale: 'it', locales: Object.fromEntries(locales.map((l) => [l, l])) },
    }),
  ],
  image: { domains: ['cdn.sanity.io', 'presicceproloco.org'] },
});

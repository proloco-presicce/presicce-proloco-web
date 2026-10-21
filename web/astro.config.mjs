import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import sanity from '@sanity/astro';
import { dataset, projectId } from '../studio/env.ts';


const locales = ['it', 'en', 'fr', 'es', 'de', 'el', 'sq', 'ar', 'zh', 'ja'];

export default defineConfig({
  site: 'https://presicceproloco.org',
  trailingSlash: 'always',
  // Tutte le pagine sono statiche; girano come funzioni Vercel solo /api/* e l'area riservata /admin.
  output: 'static',
  adapter: vercel({ maxDuration: 60 }),
  i18n: {
    defaultLocale: 'it',
    locales,
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sanity({ projectId, dataset, useCdn: false, studioBasePath: '/admin' }),
    react(),
    sitemap({
      filter: (page) => !page.includes('/api/') && !page.includes('/admin'),
      i18n: { defaultLocale: 'it', locales: Object.fromEntries(locales.map((l) => [l, l])) },
    }),
  ],
  image: { domains: ['cdn.sanity.io', 'presicceproloco.org'] },
});

import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { readFileSync } from 'node:fs';

// Interruttore "Presepe Vivente attivo" (impostazioni in Sanity, o seed.json in locale):
// fuori stagione le pagine del Presepe restano online per i QR code ma escono dalla sitemap.
async function presepeAttivo() {
  const projectId = process.env.PUBLIC_SANITY_PROJECT_ID;
  if (!projectId) return JSON.parse(readFileSync(new URL('./src/data/seed.json', import.meta.url), 'utf8')).impostazioni.presepeAttivo === true;
  const dataset = process.env.PUBLIC_SANITY_DATASET ?? 'production';
  const query = encodeURIComponent('*[_id == "impostazioni"][0].presepeAttivo');
  const res = await fetch(`https://${projectId}.api.sanity.io/v2026-09-01/data/query/${dataset}?query=${query}`);
  return (await res.json()).result === true;
}
const presepe = await presepeAttivo();

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
      filter: (page) => !page.includes('/api/') && (presepe || !page.includes('/presepe-vivente/')),
      i18n: { defaultLocale: 'it', locales: Object.fromEntries(locales.map((l) => [l, l])) },
    }),
  ],
  image: { domains: ['cdn.sanity.io', 'presicceproloco.org'] },
});

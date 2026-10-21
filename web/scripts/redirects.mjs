// L'adattatore Vercel di Astro scrive da sé .vercel/output/config.json e ignora i redirect
// di vercel.json. Dopo la build li aggiungiamo noi in testa alle regole, così i vecchi
// indirizzi (anche quelli stampati nei QR code) continuano a funzionare.
import { readFileSync, writeFileSync } from 'node:fs';
import { getTransformedRoutes } from '@vercel/routing-utils';

const { redirects } = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const { routes, error } = getTransformedRoutes({ redirects });
if (error) throw new Error(error.message);

const configUrl = new URL('../.vercel/output/config.json', import.meta.url);
const config = JSON.parse(readFileSync(configUrl, 'utf8'));
config.routes = [...routes, ...config.routes];
writeFileSync(configUrl, JSON.stringify(config, null, 2));
console.log(`Redirect aggiunti: ${redirects.length}`);

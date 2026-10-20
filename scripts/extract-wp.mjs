// Estrae i contenuti dal vecchio sito WordPress (HTML e JSON salvati in locale)
// e li scrive in web/src/data/seed.json, nello stesso formato dei documenti Sanity.
//
// Uso: node scripts/extract-wp.mjs <cartella-raw>
//   <cartella-raw> è la cartella con page-*.html e api/*.json (default: ../presicce-analisi/raw)
//
// Il seed serve a due cose: far funzionare il sito anche prima di collegare Sanity,
// e caricare i contenuti in Sanity con scripts/seed-to-sanity.mjs.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';

const rawDir = resolve(process.argv[2] ?? '../presicce-analisi/raw');
const outFile = resolve('web/src/data/seed.json');
const SITE = 'https://presicceproloco.org';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

const read = (name) => readFileSync(join(rawDir, name), 'utf8');
const loc = (it) => ({ _type: 'stringaLocalizzata', it: (it ?? '').trim() });
const locText = (it) => ({ _type: 'testoLocalizzato', it: (it ?? '').trim() });
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'k';
const abs = (url) => (url?.startsWith('/') ? SITE + url : url);

/** Il <main> interno ai template del child theme (pagine Presepe). */
function presicceMain(html) {
  const { document } = parseHTML(html);
  return document.querySelector('main.content-wrapper') ?? document.querySelector('main');
}

function headerOf(html) {
  const { document } = parseHTML(html);
  const header = document.querySelector('main .site-header') ?? document;
  return {
    title: header.querySelector('h1')?.textContent.trim() ?? '',
    subtitle: header.querySelector('.subtitle')?.textContent.trim() ?? '',
  };
}

/** Separa le immagini (sezioni .map-section) dal testo e converte il testo in Markdown. */
function splitBody(main) {
  const images = [];
  for (const section of main.querySelectorAll('section.map-section, figure')) {
    for (const img of section.querySelectorAll('img')) {
      const url = abs(img.getAttribute('data-src') ?? img.getAttribute('src'));
      if (!url || url.startsWith('data:')) continue;
      images.push({
        _key: key(url.split('/').pop()),
        _type: 'immagineConDidascalia',
        url,
        alt: img.getAttribute('alt') ?? '',
        didascalia: loc(section.querySelector('h2, figcaption')?.textContent ?? ''),
      });
    }
    section.remove();
  }
  // Titolo "Immagini" rimasto orfano dopo aver tolto le gallerie.
  for (const h of main.querySelectorAll('h2')) if (h.textContent.trim() === 'Immagini') h.remove();
  for (const el of main.querySelectorAll('[style]')) el.removeAttribute('style');
  const markdown = turndown
    .turndown(main.innerHTML)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { markdown, images };
}

// --- Presepe Vivente: ordine delle tappe preso dalla pagina "Menù tappe"
const menu = parseHTML(read('page-presepe-vivente-menu.html')).document;
const order = [...menu.querySelectorAll('main a[href*="/presepe-vivente/"]')]
  .map((a) => a.getAttribute('href').split('/').filter(Boolean).pop())
  .filter((slug, i, all) => slug !== 'menu' && all.indexOf(slug) === i);

const stazioni = order
  .filter((slug) => existsSync(join(rawDir, `page-presepe-vivente-${slug}.html`)))
  .map((slug, i) => {
    const html = read(`page-presepe-vivente-${slug}.html`);
    const { title, subtitle } = headerOf(html);
    const { markdown, images } = splitBody(presicceMain(html));
    return {
      _id: `stazione-${slug}`,
      _type: 'stazione',
      slug: { _type: 'slug', current: slug },
      ordine: i + 1,
      titolo: loc(title),
      sottotitolo: loc(subtitle),
      testo: locText(markdown),
      immagini: images,
    };
  });

// --- Pagina introduttiva del Presepe
const presepeHtml = read('page-presepe-vivente.html');
const presepeHead = headerOf(presepeHtml);
const presepeBody = splitBody(presicceMain(presepeHtml));
const pagine = [
  {
    _id: 'pagina-presepe-vivente',
    _type: 'pagina',
    slug: { _type: 'slug', current: 'presepe-vivente' },
    titolo: loc(presepeHead.title),
    sottotitolo: loc(presepeHead.subtitle),
    testo: locText(presepeBody.markdown),
    immagini: presepeBody.images,
  },
];

// --- Eventi (tipo personalizzato presicce_event)
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
function dataDalTesto(text) {
  const m = text.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/i);
  if (!m) return null;
  const month = String(MESI.indexOf(m[2].toLowerCase()) + 1).padStart(2, '0');
  return `${m[3]}-${month}-${m[1].padStart(2, '0')}`;
}

const eventi = JSON.parse(read('api/presicce_event.json')).map((ev) => {
  const file = `page-eventi-cpt-${ev.slug}.html`;
  const { document } = parseHTML(existsSync(join(rawDir, file)) ? read(file) : '<main></main>');
  const content = document.querySelector('.entry-content');
  const img = document.querySelector('.featured-image img');
  const markdown = content ? turndown.turndown(content.innerHTML).trim() : '';
  // La data non è un campo strutturato nel vecchio sito: la ricavo dal testo, altrimenti uso la data di pubblicazione.
  const giorno = dataDalTesto(markdown) ?? ev.date.slice(0, 10);
  return {
    _id: `evento-${ev.slug}`,
    _type: 'evento',
    slug: { _type: 'slug', current: ev.slug },
    titolo: loc(ev.title?.rendered ?? ''),
    dataInizio: `${giorno}T00:00:00+02:00`,
    luogo: 'Pompei',
    descrizione: locText(markdown),
    immagine: img ? { url: abs(img.getAttribute('data-src') ?? img.getAttribute('src')), alt: img.getAttribute('alt') ?? '' } : null,
  };
});

// --- Home e contatti
const home = parseHTML(read('home.html')).document;
const homeText = (sel) => home.querySelector(sel)?.textContent.replace(/\s+/g, ' ').trim() ?? '';
const tel = home.querySelector('a[href^="tel:"]')?.getAttribute('href').replace('tel:', '') ?? '';
const email = home.querySelector('a[href^="mailto:"]')?.getAttribute('href').replace('mailto:', '') ?? '';
const impostazioni = {
  _id: 'impostazioni',
  _type: 'impostazioni',
  telefono: tel,
  whatsapp: tel,
  email,
  heroTitolo: loc(homeText('main h1')),
  heroTesto: locText(homeText('main h1 + p') || homeText('main p')),
};

const seed = { impostazioni, pagine, stazioni, eventi };
writeFileSync(outFile, JSON.stringify(seed, null, 2) + '\n');
console.log(`Scritto ${outFile}: ${stazioni.length} tappe, ${pagine.length} pagine, ${eventi.length} eventi.`);

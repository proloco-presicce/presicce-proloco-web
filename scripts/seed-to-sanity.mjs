// Converte web/src/data/seed.json in un file NDJSON da importare in Sanity.
// Le immagini vengono scaricate dal vecchio sito durante l'importazione, quindi va lanciato
// mentre presicceproloco.org è ancora online.
//
// Uso:
//   node scripts/seed-to-sanity.mjs
//   cd studio && npx sanity dataset import ../seed.ndjson production --replace

import { readFileSync, writeFileSync } from 'node:fs';

const seed = JSON.parse(readFileSync('web/src/data/seed.json', 'utf8'));

/** Un'immagine del seed ({ url, alt, didascalia }) diventa un asset Sanity da scaricare. */
function toSanityImage(img) {
  if (!img?.url) return undefined;
  const { url, ...rest } = img;
  return { ...rest, _type: 'immagineConDidascalia', _sanityAsset: `image@${url}` };
}

const docs = [
  seed.impostazioni,
  ...seed.pagine.map((p) => ({ ...p, immagini: p.immagini?.map(toSanityImage) })),
  ...seed.stazioni.map((s) => ({ ...s, immagini: s.immagini?.map(toSanityImage) })),
  ...seed.eventi.map((e) => ({ ...e, immagine: toSanityImage(e.immagine) })),
];

writeFileSync('seed.ndjson', docs.map((d) => JSON.stringify(d)).join('\n') + '\n');
console.log(`Scritto seed.ndjson con ${docs.length} documenti.`);

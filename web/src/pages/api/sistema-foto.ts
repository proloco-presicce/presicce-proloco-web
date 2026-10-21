// Pagina temporanea (ottobre 2026): toglie dai luoghi storici le foto prese da altri siti,
// mette al loro posto le foto della Pro Loco e aggiunge il credito alla foto di Wikimedia.
// Si apre con /api/sistema-foto?k=<SANITY_WEBHOOK_SECRET> (anteprima) e &applica=1 (esegue).
// Le foto tolte restano nell'archivio di Sanity, solo scollegate. Va tolta subito dopo l'uso.
import type { APIRoute } from 'astro';
import { createClient } from '@sanity/client';
import { randomUUID } from 'node:crypto';
import { dataset, projectId } from '../../../../studio/env';

export const prerender = false;

// Nomi dei file importati dal vecchio sito che appartengono ad altri siti.
const ALTRI_SITI = ['colonna-di-sant-andrea', 'Presicce_3', 'izzo_', 'GINO0007', 'GINO0008', '29_05_17-05_12_34', 'case-a-corte-presicce', 'ICCD4757936'];
const WIKIMEDIA = '960px-Chiesa_madre';

// Foto della Pro Loco (mandate da Luigi il 21/10/2026), in testa alla galleria del luogo.
const NOSTRE: Record<string, { file: string; alt: string; didascalia: string }> = {
  'stazione-santandrea-e-chiesa-madre': { file: 'chiesa-madre-dall-alto.jpg', alt: 'La Chiesa Madre di Presicce vista dall’alto', didascalia: 'La Chiesa Madre vista dall’alto' },
  'stazione-case-a-corte': { file: 'corti-giardino.jpg', alt: 'Il giardino di una corte storica di Presicce', didascalia: 'Il giardino di una corte storica' },
  'stazione-frantoi-ipogei': { file: 'frantoi-ipogei.jpg', alt: 'Interno di un frantoio ipogeo con la macina', didascalia: 'Un frantoio ipogeo con la sua macina' },
};

interface Img {
  _key: string;
  _type: string;
  asset?: { _type?: string; _ref: string };
  alt?: string;
  didascalia?: { _type: string; it?: string };
}
interface Stazione {
  _id: string;
  titolo?: { it?: string };
  immagini?: Img[];
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const secret = import.meta.env.SANITY_WEBHOOK_SECRET;
  if (!secret || url.searchParams.get('k') !== secret) return text('Non autorizzato', 401);
  const applica = url.searchParams.get('applica') === '1';

  const client = createClient({ projectId, dataset, token: import.meta.env.SANITY_WRITE_TOKEN, apiVersion: '2026-09-01', useCdn: false });
  const assets = await client.fetch<{ _id: string; originalFilename?: string }[]>('*[_type == "sanity.imageAsset"]{_id, originalFilename}');
  const nome = new Map(assets.map((a) => [a._id, a.originalFilename ?? '']));
  const altri = new Set(assets.filter((a) => ALTRI_SITI.some((p) => a.originalFilename?.startsWith(p))).map((a) => a._id));
  const wiki = assets.find((a) => a.originalFilename?.startsWith(WIKIMEDIA))?._id;
  const credito = wiki ? await creditoWikimedia().catch((e: Error) => `Foto: Wikimedia Commons (${e.message})`) : '';

  const stazioni = await client.fetch<Stazione[]>('*[_type == "stazione" && !(_id in path("drafts.**"))]{_id, titolo, immagini}');
  const righe = [`Foto di altri siti collegate: ${[...altri].map((id) => nome.get(id)).join(', ') || 'nessuna'}`, `Credito Wikimedia: ${credito || '-'}`, ''];

  for (const s of stazioni) {
    const prima = s.immagini ?? [];
    let dopo: Img[] = prima
      .filter((i) => i.asset && !altri.has(i.asset._ref))
      .map((i) =>
        i.asset!._ref === wiki
          ? { ...i, alt: 'La Chiesa Madre di Sant’Andrea Apostolo a Presicce', didascalia: { _type: 'stringaLocalizzata', it: `La Chiesa Madre. ${credito}` } }
          : i,
      );
    const nostra = NOSTRE[s._id];
    if (nostra && !dopo.some((i) => nome.get(i.asset!._ref) === nostra.file)) {
      let ref = `(${nostra.file} da caricare)`;
      if (applica) {
        const res = await fetch(`${url.origin}/foto-temp/${nostra.file}`);
        if (!res.ok) return text(`Foto ${nostra.file} non trovata (${res.status})`, 500);
        ref = (await client.assets.upload('image', Buffer.from(await res.arrayBuffer()), { filename: nostra.file, contentType: 'image/jpeg' }))._id;
      }
      nome.set(ref, nostra.file);
      dopo = [
        { _key: randomUUID().slice(0, 12), _type: 'immagineConDidascalia', asset: { _type: 'reference', _ref: ref }, alt: nostra.alt, didascalia: { _type: 'stringaLocalizzata', it: nostra.didascalia } },
        ...dopo,
      ];
    }
    if (JSON.stringify(prima) === JSON.stringify(dopo)) continue;
    const elenco = (list: Img[]) => list.map((i) => nome.get(i.asset?._ref ?? '') || 'senza file').join(', ') || 'nessuna foto';
    righe.push(`${s.titolo?.it ?? s._id}: ${elenco(prima)} -> ${elenco(dopo)}`);
    if (applica) await client.patch(s._id).set({ immagini: dopo }).commit();
  }

  righe.push('', applica ? 'Fatto.' : 'Anteprima: aggiungi &applica=1 per eseguire.');
  return text(righe.join('\n'));
};

async function creditoWikimedia() {
  const api =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles=File:Chiesa_madre_di_sant%27Andrea_Presicce.jpg';
  const res = await fetch(api, { headers: { 'user-agent': 'presicceproloco.org (ufficioturistico@prolocopresicce.it)' } });
  const data = (await res.json()) as {
    query: { pages: Record<string, { imageinfo?: { extmetadata: Record<string, { value: string }> }[] }> };
  };
  const meta = Object.values(data.query.pages)[0]?.imageinfo?.[0]?.extmetadata ?? {};
  const pulito = (s?: string) => (s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return `Foto: ${pulito(meta.Artist?.value) || 'autore su Wikimedia Commons'}, ${pulito(meta.LicenseShortName?.value) || 'licenza libera'}, via Wikimedia Commons`;
}

const text = (body: string, status = 200) => new Response(body + '\n', { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

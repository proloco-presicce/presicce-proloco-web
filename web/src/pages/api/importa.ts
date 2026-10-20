// Importazione una tantum dei contenuti del vecchio sito (src/data/seed.json) in Sanity.
//
// Basta aprire /api/importa: crea in Sanity i documenti che mancano e carica le foto
// scaricandole dal vecchio sito, quindi va fatto mentre presicceproloco.org è ancora su WordPress.
// Non sovrascrive mai un documento che esiste già, quindi si può ripetere senza danni:
// se il tempo non basta per tutte le foto, la risposta dice di ricaricare la pagina.
import type { APIRoute } from 'astro';
import { createClient } from '@sanity/client';
import seed from '../../data/seed.json';
import { dataset, projectId } from '../../../../studio/env';

export const prerender = false;

const TIME_BUDGET_MS = 45_000;

interface SeedImage {
  _key?: string;
  url?: string;
  alt?: string;
  didascalia?: unknown;
}

type Doc = Record<string, unknown> & { _id: string; _type: string };

export const GET: APIRoute = async () => {
  try {
    return await importa();
  } catch (err) {
    const e = err as Error & { cause?: { code?: string; message?: string } };
    return text(`Errore: ${e.message}${e.cause ? ` (${e.cause.code ?? e.cause.message})` : ''}`, 500);
  }
};

async function importa() {
  const token = import.meta.env.SANITY_WRITE_TOKEN;
  if (!token) return text('Manca SANITY_WRITE_TOKEN nelle variabili di Vercel.', 500);

  const client = createClient({ projectId, dataset, token, apiVersion: '2026-09-01', useCdn: false });
  const started = Date.now();

  const docs: Doc[] = [seed.impostazioni, ...seed.pagine, ...seed.stazioni, ...seed.eventi] as Doc[];
  const existing = new Set(await client.fetch<string[]>('*[_id in $ids]._id', { ids: docs.map((d) => d._id) }));
  const todo = docs.filter((d) => !existing.has(d._id));

  const created: string[] = [];
  const skipped: string[] = [];
  // Una foto che non si scarica più (es. presa da un altro sito) viene saltata, non blocca l'importazione.
  const tryUpload = (img: SeedImage) =>
    upload(client, img).catch((err: Error) => {
      skipped.push(err.message);
      return null;
    });
  for (const doc of todo) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    const out: Doc = { ...doc };
    if (Array.isArray(doc.immagini)) out.immagini = (await Promise.all((doc.immagini as SeedImage[]).map(tryUpload))).filter(Boolean);
    if (doc.immagine) out.immagine = (await tryUpload(doc.immagine as SeedImage)) ?? undefined;
    await client.createIfNotExists(out);
    created.push(doc._id);
  }

  const remaining = todo.length - created.length;
  return text(
    [
      `Documenti già presenti: ${existing.size}`,
      `Creati adesso: ${created.length}`,
      remaining ? `Ne mancano ${remaining}: ricarica questa pagina per continuare.` : 'Importazione completata.',
      ...(skipped.length ? ['', 'Foto saltate:', ...skipped] : []),
    ].join('\n'),
  );
}

/** Scarica un'immagine dal vecchio sito e la carica in Sanity (che scarta i doppioni da sola). */
async function upload(client: ReturnType<typeof createClient>, img: SeedImage) {
  const { url, ...rest } = img;
  if (!url) return { ...rest, _type: 'immagineConDidascalia' };
  const res = await fetch(url).catch((err) => {
    throw new Error(`Foto non scaricata: ${url} (${err.cause?.code ?? err.cause?.message ?? err.message})`);
  });
  if (!res.ok) throw new Error(`Foto non scaricata (${res.status}): ${url}`);
  const asset = await client.assets.upload('image', Buffer.from(await res.arrayBuffer()), {
    filename: url.split('/').pop(),
    contentType: res.headers.get('content-type') ?? undefined,
  });
  return { ...rest, _type: 'immagineConDidascalia', asset: { _type: 'reference', _ref: asset._id } };
}

const text = (body: string, status = 200) => new Response(body + '\n', { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

// Pagina temporanea (ottobre 2026) per la traduzione una tantum di pagine fisse e luoghi storici.
// ?k=<SANITY_WEBHOOK_SECRET>&esporta=1 restituisce i testi italiani da tradurre;
// ?k=<SANITY_WEBHOOK_SECRET>&applica=1 salva le traduzioni di src/data/traduzioni-fisse.json,
// solo se il testo italiano non è cambiato e la lingua è ancora vuota. Va tolta dopo l'uso.
import type { APIRoute } from 'astro';
import { createClient } from '@sanity/client';
import traduzioni from '../../data/traduzioni-fisse.json';
import { dataset, projectId } from '../../../../studio/env';

export const prerender = false;

const LINGUE = ['en', 'fr', 'es', 'de', 'el', 'sq', 'ar', 'zh', 'ja'];
const LOCALIZZATI = new Set(['stringaLocalizzata', 'testoLocalizzato']);
type Testi = Record<string, string | undefined>;

/** Tutti i campi multilingua di un documento, con il loro percorso Sanity (anche dentro gli array). */
function campi(node: unknown, path = '', out: Record<string, Testi> = {}) {
  if (Array.isArray(node)) {
    for (const item of node) {
      const key = (item as { _key?: string })?._key;
      if (key) campi(item, `${path}[_key=="${key}"]`, out);
    }
  } else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (typeof obj._type === 'string' && LOCALIZZATI.has(obj._type)) {
      out[path] = obj as Testi;
      return out;
    }
    for (const [k, v] of Object.entries(obj)) if (!k.startsWith('_')) campi(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const secret = import.meta.env.SANITY_WEBHOOK_SECRET;
  if (!secret || url.searchParams.get('k') !== secret) return new Response('Non autorizzato', { status: 401 });

  const client = createClient({ projectId, dataset, token: import.meta.env.SANITY_WRITE_TOKEN, apiVersion: '2026-09-01', useCdn: false });
  const docs = await client.fetch<Record<string, unknown>[]>('*[_type in ["impostazioni", "pagina", "stazione"] && !(_id in path("drafts.**"))]');

  if (url.searchParams.get('esporta') === '1') {
    const out: Record<string, Record<string, string>> = {};
    for (const doc of docs) {
      const testi = Object.entries(campi(doc)).filter(([, v]) => v.it?.trim() && LINGUE.some((l) => !v[l]));
      if (testi.length) out[doc._id as string] = Object.fromEntries(testi.map(([p, v]) => [p, v.it!]));
    }
    return Response.json(out);
  }

  if (url.searchParams.get('applica') !== '1') return new Response('Usa esporta=1 o applica=1', { status: 400 });
  const righe: string[] = [];
  const dati = traduzioni as Record<string, Record<string, Testi>>;
  for (const doc of docs) {
    const id = doc._id as string;
    const attuali = campi(doc);
    const set: Record<string, string> = {};
    let saltati = 0;
    for (const [path, tr] of Object.entries(dati[id] ?? {})) {
      const ora = attuali[path];
      if (!ora || ora.it !== tr.it) {
        saltati++;
        continue;
      }
      for (const l of LINGUE) if (tr[l] && !ora[l]) set[`${path}.${l}`] = tr[l]!;
    }
    if (Object.keys(set).length) await client.patch(id).set(set).commit();
    if (dati[id]) righe.push(`${id}: ${Object.keys(set).length} testi salvati${saltati ? `, ${saltati} campi saltati (italiano cambiato)` : ''}`);
  }
  return new Response(righe.join('\n') + '\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};

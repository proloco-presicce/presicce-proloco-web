// Aggiornamento una tantum: il Presepe Vivente diventa la "Guida ai luoghi storici".
//
// Basta aprire /api/aggiorna-guida: riporta in Sanity i testi italiani riscritti in
// src/data/seed.json (tappe e pagina introduttiva) e toglie l'interruttore del Presepe.
// Tocca solo i campi italiani, quindi si può ripetere senza danni. Da togliere dopo l'uso.
import type { APIRoute } from 'astro';
import { createClient } from '@sanity/client';
import seed from '../../data/seed.json';
import { dataset, projectId } from '../../../../studio/env';

export const prerender = false;

export const GET: APIRoute = async () => {
  const token = import.meta.env.SANITY_WRITE_TOKEN;
  if (!token) return text('Manca SANITY_WRITE_TOKEN nelle variabili di Vercel.', 500);
  try {
    const client = createClient({ projectId, dataset, token, apiVersion: '2026-09-01', useCdn: false });
    const tx = client.transaction();
    for (const s of seed.stazioni) {
      tx.patch(s._id, (p) =>
        p.set({ ordine: s.ordine, 'titolo.it': s.titolo.it, 'sottotitolo.it': s.sottotitolo.it, 'testo.it': s.testo.it }),
      );
    }
    const intro = seed.pagine.find((p) => p._id === 'pagina-luoghi-storici')!;
    const vecchia = await client.getDocument('pagina-presepe-vivente');
    tx.createIfNotExists({ ...intro, immagini: vecchia?.immagini ?? [] });
    tx.patch(intro._id, (p) =>
      p.set({ slug: intro.slug, 'titolo.it': intro.titolo.it, 'sottotitolo.it': intro.sottotitolo.it, 'testo.it': intro.testo.it }),
    );
    tx.delete('pagina-presepe-vivente');
    tx.patch('impostazioni', (p) => p.unset(['presepeAttivo']));
    await tx.commit();
    return text(`Fatto: ${seed.stazioni.length} luoghi e pagina introduttiva aggiornati.`);
  } catch (err) {
    return text(`Errore: ${(err as Error).message}`, 500);
  }
};

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

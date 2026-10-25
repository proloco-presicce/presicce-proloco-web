// Rigenera il sito quando si pubblica qualcosa in /admin.
//
// Sanity chiama questo indirizzo (webhook) ogni volta che un evento, un luogo o una pagina viene
// pubblicato o cancellato; qui si chiede a Vercel di rifare il sito (Deploy Hook), che in circa
// un minuto è online. Gli eventi non vengono tradotti: nelle altre lingue la pagina offre la
// traduzione gratuita di Google (vedi layouts/Base.astro).
import type { APIRoute } from 'astro';
import { timingSafeEqual } from 'node:crypto';
import { waitUntil } from '@vercel/functions';

export const prerender = false;

function authorized(request: Request) {
  const expected = import.meta.env.SANITY_WEBHOOK_SECRET ?? '';
  const given = request.headers.get('x-webhook-secret') ?? '';
  return expected.length > 0 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return new Response('Non autorizzato', { status: 401 });
  const { _id } = (await request.json().catch(() => ({}))) as { _id?: string };

  const hook = import.meta.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hook) {
    console.warn(`Manca VERCEL_DEPLOY_HOOK_URL: il sito non si rigenera (${_id})`);
    return new Response('Manca VERCEL_DEPLOY_HOOK_URL', { status: 500 });
  }
  waitUntil(
    fetch(hook, { method: 'POST' })
      .then((res) => console.log(`Rigenerazione chiesta per ${_id}: ${res.status}`))
      .catch((err) => console.error(`Rigenerazione per ${_id} fallita:`, err)),
  );
  return new Response('Ricevuto', { status: 202 });
};

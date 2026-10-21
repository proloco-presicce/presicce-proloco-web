// Traduzione automatica alla pubblicazione.
//
// Sanity chiama questo indirizzo (webhook) ogni volta che un evento, una tappa o una pagina
// viene pubblicata. Qui si traducono i campi italiani cambiati nelle altre 9 lingue con l'API
// di Claude, si salvano le traduzioni nel documento e si chiede a Vercel di rigenerare il sito.
//
// Regole:
// - si traduce un campo solo se il testo italiano è cambiato dall'ultima traduzione;
// - se qualcuno ha corretto a mano una traduzione, quella lingua non viene più toccata.
// - una lingua che fallisce resta da tradurre e viene ripresa alla pubblicazione successiva.
import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SanityDocument } from '@sanity/client';
import { createHash, timingSafeEqual } from 'node:crypto';
import { waitUntil } from '@vercel/functions';

export const prerender = false;

const TARGETS = ['en', 'fr', 'es', 'de', 'el', 'sq', 'ar', 'zh', 'ja'] as const;
type Target = (typeof TARGETS)[number];
const LANGUAGE_NAMES: Record<Target, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  el: 'Greek',
  sq: 'Albanian',
  ar: 'Arabic (Modern Standard)',
  zh: 'Simplified Chinese',
  ja: 'Japanese',
};
const LOCALIZED_TYPES = new Set(['stringaLocalizzata', 'testoLocalizzato']);
const TRANSLATABLE_DOCS = new Set(['evento', 'stazione', 'pagina', 'impostazioni']);

type TranslationState = Record<string, { src: string; out: Record<string, string> }>;

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

interface LocalizedField {
  path: string; // percorso Sanity, es. "immagini[_key==\"abc\"].didascalia"
  stateKey: string; // chiave sicura per salvare lo stato (niente punti né parentesi)
  value: Record<string, string | undefined>;
}

/** Trova tutti i campi multilingua del documento, anche dentro array (es. didascalie). */
function findLocalized(node: unknown, path = '', out: LocalizedField[] = []): LocalizedField[] {
  if (Array.isArray(node)) {
    node.forEach((item) => {
      const key = (item as { _key?: string })?._key;
      if (key) findLocalized(item, `${path}[_key=="${key}"]`, out);
    });
  } else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (typeof obj._type === 'string' && LOCALIZED_TYPES.has(obj._type)) {
      out.push({ path, stateKey: path.replace(/[^a-zA-Z0-9]+/g, '_'), value: obj as Record<string, string | undefined> });
      return out;
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('_')) continue;
      findLocalized(v, path ? `${path}.${k}` : k, out);
    }
  }
  return out;
}

// Una richiesta per lingua, tutte in parallelo: più veloce, e una pagina lunga non sfora il
// limite di testo di una singola risposta.
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    translations: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, text: { type: 'string' } },
        required: ['id', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['translations'],
  additionalProperties: false,
};

const SYSTEM = `You translate content for the website of the Pro Loco of Presicce, a tourist association in a small village in Salento (Apulia, Italy). Readers are tourists visiting the village.
Translate each Italian text into the requested language. Keep the meaning, tone and Markdown formatting (paragraph breaks, **bold**, *italic*, lists, links) exactly. Keep proper names of places, palaces, streets, churches and people in Italian (e.g. "Palazzo Adamo Izzo", "Via Crudili", "Frantoi Ipogei" may get a short explanation only if it is already in the text). Keep dates, times, prices and phone numbers unchanged in value, written the way a native reader expects. Return only the JSON, with one entry per input id.`;

async function translateTo(client: Anthropic, lang: Target, items: { id: string; it: string }[]) {
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    // Se il modello rifiuta una richiesta, l'API la ripete su un modello di riserva.
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Language: ${LANGUAGE_NAMES[lang]}.\n\nTexts:\n${JSON.stringify(items)}` }],
  });
  if (response.stop_reason !== 'end_turn') throw new Error(`Traduzione in ${lang} interrotta: ${response.stop_reason}`);
  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  return new Map((JSON.parse(text) as { translations: { id: string; text: string }[] }).translations.map((t) => [t.id, t.text]));
}

function authorized(request: Request) {
  const expected = import.meta.env.SANITY_WEBHOOK_SECRET ?? '';
  const given = request.headers.get('x-webhook-secret') ?? '';
  return expected.length > 0 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return new Response('Non autorizzato', { status: 401 });

  const { _id } = (await request.json()) as { _id?: string };
  if (!_id) return new Response('Manca _id', { status: 400 });

  // Sanity aspetta la risposta solo pochi secondi e altrimenti ripete la chiamata: rispondiamo
  // subito e traduciamo dopo (Vercel tiene viva la funzione fino alla fine del lavoro).
  waitUntil(
    handle(_id.replace(/^drafts\./, '')).catch((err) => console.error(`Traduzione di ${_id} fallita:`, err)),
  );
  return new Response('Ricevuto', { status: 202 });
};

async function handle(id: string) {
  const sanity = createClient({
    projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID,
    dataset: import.meta.env.PUBLIC_SANITY_DATASET ?? 'production',
    apiVersion: '2026-09-01',
    token: import.meta.env.SANITY_WRITE_TOKEN,
    useCdn: false,
  });
  const doc = await sanity.getDocument<SanityDocument & { traduzioniStato?: string }>(id);
  // Documento cancellato: niente da tradurre, ma il sito va rigenerato per toglierlo.
  if (!doc) return rebuild(`${id} cancellato`);
  if (!TRANSLATABLE_DOCS.has(doc._type)) return;

  // Stato delle traduzioni salvato nel documento come JSON (campo nascosto nello Studio).
  const saved = JSON.parse(doc.traduzioniStato || '{}') as { at?: string; fields?: TranslationState };
  const state: TranslationState = saved.fields ?? {};
  const fields = findLocalized(doc).filter((f) => f.value.it?.trim());

  // Per ogni campo: quali lingue vanno (ri)tradotte?
  const work = fields
    .map((f) => {
      const prev = state[f.stateKey];
      const srcChanged = prev?.src !== hash(f.value.it!);
      const langs = TARGETS.filter((l) => {
        const current = f.value[l];
        if (!current) return true; // mai tradotto
        const manuallyEdited = prev?.out?.[l] !== undefined && prev.out[l] !== hash(current);
        return srcChanged && !manuallyEdited;
      });
      return { field: f, langs };
    })
    .filter((w) => w.langs.length > 0);

  if (work.length > 0) {
    const anthropic = new Anthropic();
    const langs = TARGETS.filter((l) => work.some((w) => w.langs.includes(l)));
    const settled = await Promise.allSettled(
      langs.map((l) =>
        translateTo(
          anthropic,
          l,
          work.filter((w) => w.langs.includes(l)).map((w) => ({ id: w.field.stateKey, it: w.field.value.it! })),
        ),
      ),
    );
    // Una lingua andata male non blocca le altre: resta vuota e si ritraduce alla prossima pubblicazione.
    const byLang = new Map<Target, Map<string, string>>();
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') byLang.set(langs[i], r.value);
      else console.error(`Traduzione in ${langs[i]} di ${id} fallita:`, r.reason);
    });

    const set: Record<string, string> = {};
    const newState = { ...state };
    for (const { field, langs: fieldLangs } of work) {
      const prevOut = state[field.stateKey]?.out ?? {};
      const out: Record<string, string> = {};
      for (const l of TARGETS) {
        const tr = fieldLangs.includes(l) ? byLang.get(l)?.get(field.stateKey) : undefined;
        if (tr) {
          set[`${field.path}.${l}`] = tr;
          out[l] = hash(tr);
        } else if (field.value[l]) {
          // Correzioni manuali (o lingue fallite) restano con il loro hash attuale.
          out[l] = prevOut[l] ?? hash(field.value[l]!);
        }
      }
      // Se qualche lingua è fallita, il testo italiano resta "da tradurre" per quelle lingue.
      const allDone = fieldLangs.every((l) => out[l] !== undefined);
      newState[field.stateKey] = { src: allDone ? hash(field.value.it!) : (state[field.stateKey]?.src ?? ''), out };
    }
    if (Object.keys(set).length > 0) {
      await sanity
        .patch(id)
        .set({ ...set, traduzioniStato: JSON.stringify({ at: new Date().toISOString(), fields: newState }) })
        .commit();
    }
    console.log(`${id}: tradotti ${work.length} campi in ${byLang.size}/${langs.length} lingue`);
  }

  // Il nostro salvataggio qui sopra fa ripartire il webhook: quella seconda chiamata non ha
  // niente da tradurre e arriva entro pochi secondi, quindi non rigenera di nuovo.
  const isEcho = work.length === 0 && saved.at && new Date(doc._updatedAt).getTime() - new Date(saved.at).getTime() < 30_000;
  if (!isEcho) await rebuild(`${id} pubblicato`);
}

async function rebuild(reason: string) {
  const hook = import.meta.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hook) return console.warn(`Manca VERCEL_DEPLOY_HOOK_URL: il sito non si rigenera (${reason})`);
  const res = await fetch(hook, { method: 'POST' });
  console.log(`Rigenerazione chiesta (${reason}): ${res.status}`);
}

// Traduzione automatica alla pubblicazione.
//
// Sanity chiama questo indirizzo (webhook) ogni volta che un evento, una tappa o una pagina
// viene pubblicata. Qui si traducono i campi italiani cambiati nelle altre 9 lingue con l'API
// di Claude, si salvano le traduzioni nel documento e si chiede a Vercel di rigenerare il sito.
//
// Regole:
// - si traduce un campo solo se il testo italiano è cambiato dall'ultima traduzione;
// - se qualcuno ha corretto a mano una traduzione, quella lingua non viene più toccata.
import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SanityDocument } from '@sanity/client';
import { createHash, timingSafeEqual } from 'node:crypto';

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

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    translations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          ...Object.fromEntries(TARGETS.map((l) => [l, { type: 'string' }])),
        },
        required: ['id', ...TARGETS],
        additionalProperties: false,
      },
    },
  },
  required: ['translations'],
  additionalProperties: false,
};

const SYSTEM = `You translate content for the website of the Pro Loco of Presicce, a tourist association in a small village in Salento (Apulia, Italy). Readers are tourists visiting the village.
Translate each Italian text into every requested language. Keep the meaning, tone and Markdown formatting (paragraph breaks, **bold**, *italic*, lists, links) exactly. Keep proper names of places, palaces, streets, churches and people in Italian (e.g. "Palazzo Adamo Izzo", "Via Crudili", "Frantoi Ipogei" may get a short explanation only if it is already in the text). Keep dates, times, prices and phone numbers unchanged in value, written the way a native reader expects. Return only the JSON.`;

async function translate(client: Anthropic, items: { id: string; it: string }[]) {
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    // Se il modello rifiuta una richiesta, l'API la ripete su un modello di riserva.
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Languages: ${TARGETS.map((l) => `${l} = ${LANGUAGE_NAMES[l]}`).join(', ')}.\n\nTexts:\n${JSON.stringify(items)}`,
      },
    ],
  });
  if (response.stop_reason !== 'end_turn') throw new Error(`Traduzione interrotta: ${response.stop_reason}`);
  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  return (JSON.parse(text) as { translations: ({ id: string } & Record<Target, string>)[] }).translations;
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
  const id = _id.replace(/^drafts\./, '');

  const sanity = createClient({
    projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID,
    dataset: import.meta.env.PUBLIC_SANITY_DATASET ?? 'production',
    apiVersion: '2026-09-01',
    token: import.meta.env.SANITY_WRITE_TOKEN,
    useCdn: false,
  });
  const doc = await sanity.getDocument<SanityDocument & { traduzioniStato?: string }>(id);
  if (!doc || !TRANSLATABLE_DOCS.has(doc._type)) return new Response('Niente da tradurre', { status: 200 });

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
    const results = await translate(
      anthropic,
      work.map((w) => ({ id: w.field.stateKey, it: w.field.value.it! })),
    );
    const byId = new Map(results.map((r) => [r.id, r]));

    const set: Record<string, string> = {};
    const newState = { ...state };
    for (const { field, langs } of work) {
      const tr = byId.get(field.stateKey);
      if (!tr) continue;
      const out = { ...(state[field.stateKey]?.out ?? {}) };
      for (const l of langs) {
        set[`${field.path}.${l}`] = tr[l];
        out[l] = hash(tr[l]);
      }
      // Le lingue non ritradotte (correzioni manuali) restano con il loro hash attuale.
      for (const l of TARGETS) if (!langs.includes(l) && field.value[l]) out[l] = state[field.stateKey]?.out?.[l] ?? hash(field.value[l]!);
      newState[field.stateKey] = { src: hash(field.value.it!), out };
    }
    await sanity
      .patch(id)
      .set({ ...set, traduzioniStato: JSON.stringify({ at: new Date().toISOString(), fields: newState }) })
      .commit();
  }

  // Rigenera il sito. Il nostro salvataggio qui sopra fa ripartire il webhook: quella seconda
  // chiamata non ha niente da tradurre e arriva entro pochi secondi, quindi non rigenera di nuovo.
  const isEcho = work.length === 0 && saved.at && new Date(doc._updatedAt).getTime() - new Date(saved.at).getTime() < 30_000;
  const hook = import.meta.env.VERCEL_DEPLOY_HOOK_URL;
  if (hook && !isEcho) await fetch(hook, { method: 'POST' });

  return Response.json({ translatedFields: work.length });
};

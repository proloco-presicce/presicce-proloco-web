import { defineType } from 'sanity';

// Campi multilingua. I volontari compilano solo l'italiano. Pagine fisse e luoghi storici sono
// stati tradotti una volta sola (ottobre 2026) e si correggono a mano qui; gli eventi restano in
// italiano e nelle altre lingue il sito offre la traduzione di Google.
export const LANGUAGES = [
  { id: 'it', title: 'Italiano' },
  { id: 'en', title: 'English' },
  { id: 'fr', title: 'Français' },
  { id: 'es', title: 'Español' },
  { id: 'de', title: 'Deutsch' },
  { id: 'el', title: 'Ελληνικά' },
  { id: 'sq', title: 'Shqip' },
  { id: 'ar', title: 'العربية' },
  { id: 'zh', title: '中文' },
  { id: 'ja', title: '日本語' },
];

const fieldsets = [{ name: 'traduzioni', title: 'Traduzioni (facoltative)', options: { collapsible: true, collapsed: true } }];

export const stringaLocalizzata = defineType({
  name: 'stringaLocalizzata',
  title: 'Testo breve',
  type: 'object',
  fieldsets,
  fields: LANGUAGES.map((lang) => ({
    name: lang.id,
    title: lang.title,
    type: 'string',
    fieldset: lang.id === 'it' ? undefined : 'traduzioni',
  })),
});

export const testoLocalizzato = defineType({
  name: 'testoLocalizzato',
  title: 'Testo',
  type: 'object',
  fieldsets,
  fields: LANGUAGES.map((lang) => ({
    name: lang.id,
    title: lang.title,
    type: 'text',
    rows: lang.id === 'it' ? 10 : 6,
    description: lang.id === 'it' ? 'Lascia una riga vuota tra un paragrafo e l’altro. **grassetto**, *corsivo*.' : undefined,
    fieldset: lang.id === 'it' ? undefined : 'traduzioni',
  })),
});

export const immagineConDidascalia = defineType({
  name: 'immagineConDidascalia',
  title: 'Immagine',
  type: 'image',
  options: { hotspot: true },
  fields: [
    { name: 'alt', title: 'Descrizione per chi non vede l’immagine', type: 'string' },
    { name: 'didascalia', title: 'Didascalia', type: 'stringaLocalizzata' },
  ],
});

/** Campo tecnico nascosto, usato dalla vecchia traduzione automatica (tolta a ottobre 2026). */
export const traduzioniStato = { name: 'traduzioniStato', type: 'string', hidden: true, readOnly: true } as const;

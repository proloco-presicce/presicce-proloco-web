import { defineType } from 'sanity';

// Campi multilingua. I volontari compilano solo l'italiano: le altre lingue vengono
// riempite in automatico alla pubblicazione (web/src/pages/api/translate.ts) e restano
// correggibili a mano. Una correzione manuale non viene più sovrascritta.
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

const fieldsets = [{ name: 'traduzioni', title: 'Traduzioni automatiche (facoltativo correggerle)', options: { collapsible: true, collapsed: true } }];

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

/** Campo tecnico nascosto: lo usa la traduzione automatica per sapere cosa è già tradotto. */
export const traduzioniStato = { name: 'traduzioniStato', type: 'string', hidden: true, readOnly: true } as const;

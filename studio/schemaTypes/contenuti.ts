import { defineField, defineType } from 'sanity';
import { CogIcon } from '@sanity/icons/Cog';
import { DocumentTextIcon } from '@sanity/icons/DocumentText';
import { PinIcon } from '@sanity/icons/Pin';
import { traduzioniStato } from './localized';

const titolo = defineField({ name: 'titolo', title: 'Titolo', type: 'stringaLocalizzata' });
const sottotitolo = defineField({ name: 'sottotitolo', title: 'Sottotitolo', type: 'stringaLocalizzata' });
const slug = defineField({
  name: 'slug',
  title: 'Indirizzo della pagina',
  type: 'slug',
  options: { source: 'titolo.it', maxLength: 80 },
  validation: (rule) => rule.required(),
});
const testo = defineField({ name: 'testo', title: 'Testo', type: 'testoLocalizzato' });
const immagini = defineField({ name: 'immagini', title: 'Immagini', type: 'array', of: [{ type: 'immagineConDidascalia' }] });

/** Una tappa del percorso del Presepe Vivente. */
export const stazione = defineType({
  name: 'stazione',
  title: 'Tappa del Presepe',
  type: 'document',
  icon: PinIcon,
  fields: [
    titolo,
    sottotitolo,
    slug,
    defineField({ name: 'ordine', title: 'Ordine nel percorso', type: 'number', validation: (rule) => rule.required().min(1) }),
    testo,
    immagini,
    defineField(traduzioniStato),
  ],
  orderings: [{ title: 'Ordine', name: 'ordine', by: [{ field: 'ordine', direction: 'asc' }] }],
  preview: { select: { title: 'titolo.it', ordine: 'ordine' }, prepare: ({ title, ordine }) => ({ title: `${ordine ?? '?'}. ${title}` }) },
});

/** Pagina libera: introduzione al Presepe, visite guidate, chi siamo... */
export const pagina = defineType({
  name: 'pagina',
  title: 'Pagina',
  type: 'document',
  icon: DocumentTextIcon,
  fields: [titolo, sottotitolo, slug, testo, immagini, defineField(traduzioniStato)],
  preview: { select: { title: 'titolo.it', subtitle: 'slug.current' } },
});

/** Dati generali del sito (documento unico). */
export const impostazioni = defineType({
  name: 'impostazioni',
  title: 'Impostazioni del sito',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({ name: 'heroTitolo', title: 'Titolo della home', type: 'stringaLocalizzata' }),
    defineField({ name: 'heroTesto', title: 'Testo di benvenuto', type: 'testoLocalizzato' }),
    defineField({ name: 'heroImmagine', title: 'Foto di apertura', type: 'immagineConDidascalia' }),
    defineField({ name: 'telefono', title: 'Telefono per info e prenotazioni', type: 'string' }),
    defineField({ name: 'whatsapp', title: 'Numero WhatsApp', type: 'string' }),
    defineField({ name: 'email', title: 'Email', type: 'string' }),
    defineField({ name: 'facebook', title: 'Pagina Facebook', type: 'url' }),
    defineField({ name: 'instagram', title: 'Profilo Instagram', type: 'url' }),
    defineField(traduzioniStato),
  ],
  preview: { prepare: () => ({ title: 'Impostazioni del sito' }) },
});

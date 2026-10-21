import { defineField, defineType } from 'sanity';
import { CalendarIcon } from '@sanity/icons/Calendar';
import { traduzioniStato } from './localized';

export const evento = defineType({
  name: 'evento',
  title: 'Evento',
  type: 'document',
  icon: CalendarIcon,
  fields: [
    defineField({
      name: 'titolo',
      title: 'Titolo',
      type: 'stringaLocalizzata',
      validation: (rule) => rule.custom((value: { it?: string } | undefined) => (value?.it ? true : 'Scrivi il titolo in italiano')),
    }),
    defineField({
      name: 'slug',
      title: 'Indirizzo della pagina',
      type: 'slug',
      description: 'Premi "Genera": viene creato dal titolo.',
      options: { source: 'titolo.it', maxLength: 80 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'tipo',
      title: 'Tipo di evento',
      type: 'string',
      description: 'Serve per i filtri nella pagina Eventi.',
      options: {
        list: [
          { title: 'Visita guidata', value: 'visita' },
          { title: 'Gita', value: 'gita' },
          { title: 'Serata', value: 'serata' },
          { title: 'Altro', value: 'altro' },
        ],
        layout: 'radio',
      },
    }),
    defineField({ name: 'sommario', title: 'Frase breve sotto il titolo (facoltativa)', type: 'stringaLocalizzata' }),
    defineField({ name: 'dataInizio', title: 'Inizio', type: 'datetime', validation: (rule) => rule.required() }),
    defineField({ name: 'dataFine', title: 'Fine (facoltativa)', type: 'datetime' }),
    defineField({ name: 'luogo', title: 'Luogo', type: 'string', description: 'Es. Piazza del Popolo, Presicce' }),
    defineField({ name: 'immagine', title: 'Locandina o foto', type: 'immagineConDidascalia' }),
    defineField({
      name: 'descrizione',
      title: 'Descrizione',
      type: 'testoLocalizzato',
      description: 'Per il programma usa un elenco: ogni riga che inizia con "- " diventa una tappa della giornata.',
    }),
    defineField({ name: 'foto', title: 'Altre foto (facoltative)', type: 'array', of: [{ type: 'immagineConDidascalia' }] }),
    defineField({
      name: 'telefono',
      title: 'Telefono per prenotare',
      type: 'string',
      description: 'Se vuoto si usa il numero della Pro Loco. Formato: +39 340 1234567',
    }),
    defineField({ name: 'whatsapp', title: 'WhatsApp (facoltativo)', type: 'string' }),
    defineField({ name: 'inEvidenza', title: 'Mostra in home', type: 'boolean', initialValue: true }),
    defineField(traduzioniStato),
  ],
  orderings: [{ title: 'Data', name: 'data', by: [{ field: 'dataInizio', direction: 'desc' }] }],
  preview: {
    select: { title: 'titolo.it', date: 'dataInizio', media: 'immagine' },
    prepare: ({ title, date, media }) => ({
      title,
      subtitle: date ? new Date(date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Senza data',
      media,
    }),
  },
});

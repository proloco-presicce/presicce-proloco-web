import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { itITLocale } from '@sanity/locale-it-it';
import { evento } from './schemaTypes/evento';
import { impostazioni, pagina, stazione } from './schemaTypes/contenuti';
import { immagineConDidascalia, stringaLocalizzata, testoLocalizzato } from './schemaTypes/localized';
import { dataset, projectId } from './env';

const SINGLETONS = new Set(['impostazioni']);

export default defineConfig({
  name: 'proloco-presicce',
  title: 'Pro Loco Presicce',
  projectId,
  dataset,
  plugins: [
    structureTool({
      // Menu dell'area riservata: gli eventi in cima, perché sono la cosa che si aggiorna più spesso.
      structure: (S) =>
        S.list()
          .title('Contenuti')
          .items([
            S.documentTypeListItem('evento').title('Eventi'),
            S.divider(),
            S.documentTypeListItem('stazione').title('Guida: luoghi storici'),
            S.documentTypeListItem('pagina').title('Pagine'),
            S.divider(),
            S.listItem()
              .title('Impostazioni del sito')
              .id('impostazioni')
              .child(S.document().schemaType('impostazioni').documentId('impostazioni')),
          ]),
    }),
    itITLocale(),
  ],
  schema: {
    types: [stringaLocalizzata, testoLocalizzato, immagineConDidascalia, evento, stazione, pagina, impostazioni],
    // Le impostazioni sono un documento unico: niente "crea nuovo".
    templates: (templates) => templates.filter(({ schemaType }) => !SINGLETONS.has(schemaType)),
  },
  document: {
    actions: (actions, { schemaType }) =>
      SINGLETONS.has(schemaType) ? actions.filter(({ action }) => action !== 'duplicate' && action !== 'delete') : actions,
  },
});

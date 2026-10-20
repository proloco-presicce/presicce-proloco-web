import { defineCliConfig } from 'sanity/cli';
import { dataset, projectId } from './env';

export default defineCliConfig({
  api: { projectId, dataset },
  // L'area riservata vive dentro il sito, su presicceproloco.org/admin (vedi web/sanity.config.ts).
  // `npm run deploy -w studio` la pubblica anche su https://proloco-presicce.sanity.studio, se serve.
  studioHost: 'proloco-presicce',
});

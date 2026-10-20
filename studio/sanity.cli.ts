import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID,
    dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',
  },
  // L'area riservata viene pubblicata su https://proloco-presicce.sanity.studio
  // (presicceproloco.org/admin ci rimanda lì, vedi web/vercel.json).
  studioHost: 'proloco-presicce',
});

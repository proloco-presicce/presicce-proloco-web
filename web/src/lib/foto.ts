// Foto della Pro Loco salvate nel sito (inviate da Luigi il 21/10/2026). Astro le ridimensiona
// e le converte in WebP durante la build, così sullo smartphone pesano poco.
// Valgono come riserva per i luoghi che in Sanity non hanno ancora una foto.
import type { ImageMetadata } from 'astro';
import chiesaMadre from '../assets/foto/chiesa-madre-dall-alto.jpg';
import corte from '../assets/foto/corte.jpg';
import frantoio from '../assets/foto/frantoio-ipogeo.jpg';
import vicolo from '../assets/foto/vicolo.jpg';
import campagna from '../assets/foto/campagna-angeli.jpg';

export const foto = { chiesaMadre, corte, frantoio, vicolo, campagna };

/** Foto locale per una tappa della guida, in base allo slug. */
export const fotoTappa: Record<string, ImageMetadata> = {
  'santandrea-e-chiesa-madre': chiesaMadre,
  'case-a-corte': corte,
  'frantoi-ipogei': frantoio,
};

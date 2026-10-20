// L'area riservata (Sanity Studio) servita dal sito stesso su /admin.
// La configurazione vera è in studio/sanity.config.ts: qui cambia solo l'indirizzo.
import config from '../studio/sanity.config';

export default { ...config, basePath: '/admin' };

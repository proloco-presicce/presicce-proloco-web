// Accesso ai contenuti. Se Sanity è configurato (PUBLIC_SANITY_PROJECT_ID) legge da lì,
// altrimenti usa src/data/seed.json, cioè i contenuti estratti dal vecchio WordPress.
import { createClient } from '@sanity/client';
import { createImageUrlBuilder } from '@sanity/image-url';
import { marked } from 'marked';
import seed from '../data/seed.json';
import { defaultLocale, type Locale } from '../i18n/config';

type Localized = Partial<Record<Locale, string>> & { _type?: string };

interface RawImage {
  _key?: string;
  url?: string;
  asset?: { _ref: string };
  alt?: string;
  didascalia?: Localized;
}

interface RawDoc {
  _id: string;
  slug: { current: string };
  titolo: Localized;
  sottotitolo?: Localized;
  testo?: Localized;
  immagini?: RawImage[];
}

interface RawStazione extends RawDoc {
  ordine: number;
}

interface RawEvento {
  _id: string;
  slug: { current: string };
  titolo: Localized;
  dataInizio: string;
  dataFine?: string;
  luogo?: string;
  immagine?: RawImage | null;
  descrizione?: Localized;
  telefono?: string;
  whatsapp?: string;
  inEvidenza?: boolean;
}

interface RawImpostazioni {
  presepeAttivo?: boolean;
  heroTitolo?: Localized;
  heroTesto?: Localized;
  heroImmagine?: RawImage;
  telefono?: string;
  whatsapp?: string;
  email?: string;
  facebook?: string;
  instagram?: string;
}

const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = import.meta.env.PUBLIC_SANITY_DATASET ?? 'production';
const client = projectId ? createClient({ projectId, dataset, apiVersion: '2026-09-01', useCdn: false }) : null;
const imageBuilder = client ? createImageUrlBuilder(client) : null;

// --- Helpers per la lingua

/** Testo nella lingua richiesta, con l'italiano come riserva. */
export const pick = (value: Localized | undefined, locale: Locale) => value?.[locale] || value?.[defaultLocale] || '';

/** True se il testo mostrato non è nella lingua richiesta (traduzione non ancora pronta). */
export const isFallback = (value: Localized | undefined, locale: Locale) => locale !== defaultLocale && !value?.[locale];

export const markdown = (value: Localized | undefined, locale: Locale) => marked.parse(pick(value, locale), { async: false });

export interface Image {
  src: string;
  alt: string;
  caption: string;
}

export function image(img: RawImage | null | undefined, locale: Locale, width = 1200): Image | null {
  if (!img) return null;
  const src = img.asset && imageBuilder ? imageBuilder.image(img).width(width).auto('format').quality(75).url() : img.url;
  if (!src) return null;
  return { src, alt: img.alt ?? '', caption: pick(img.didascalia, locale) };
}

// --- Query

async function query<T>(groq: string, fallback: T): Promise<T> {
  if (!client) return fallback;
  return client.fetch<T>(groq);
}

export const getImpostazioni = () =>
  query<RawImpostazioni>(`*[_id == "impostazioni"][0]`, seed.impostazioni as RawImpostazioni);

export const getEventi = () =>
  query<RawEvento[]>(
    `*[_type == "evento" && !(_id in path("drafts.**"))] | order(dataInizio asc)`,
    [...(seed.eventi as RawEvento[])].sort((a, b) => a.dataInizio.localeCompare(b.dataInizio)),
  );

export const getStazioni = () =>
  query<RawStazione[]>(
    `*[_type == "stazione" && !(_id in path("drafts.**"))] | order(ordine asc)`,
    [...(seed.stazioni as RawStazione[])].sort((a, b) => a.ordine - b.ordine),
  );

export const getPagine = () =>
  query<RawDoc[]>(`*[_type == "pagina" && !(_id in path("drafts.**"))]`, seed.pagine as RawDoc[]);

export async function getPagina(slug: string) {
  return (await getPagine()).find((p) => p.slug.current === slug) ?? null;
}

/** Divide gli eventi in prossimi (anche quelli in corso oggi) e passati. */
export function splitEventi(eventi: RawEvento[], now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = (e: RawEvento) => new Date(e.dataFine ?? e.dataInizio).getTime();
  return {
    prossimi: eventi.filter((e) => end(e) >= startOfToday),
    passati: eventi.filter((e) => end(e) < startOfToday).reverse(),
  };
}

export type { RawEvento as Evento, RawStazione as Stazione, RawDoc as Pagina, RawImpostazioni as Impostazioni };

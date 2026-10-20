// Lingue del sito. L'italiano è la lingua di partenza e non ha prefisso negli URL
// (così restano validi gli indirizzi del vecchio WordPress); le altre stanno sotto /<codice>/.
export const defaultLocale = 'it';

export const locales = ['it', 'en', 'fr', 'es', 'de', 'el', 'sq', 'ar', 'zh', 'ja'] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  it: 'Italiano',
  en: 'English',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
  el: 'Ελληνικά',
  sq: 'Shqip',
  ar: 'العربية',
  zh: '中文',
  ja: '日本語',
};

// Codici BCP 47 per l'attributo lang e per hreflang.
export const htmlLang: Record<Locale, string> = {
  it: 'it',
  en: 'en',
  fr: 'fr',
  es: 'es',
  de: 'de',
  el: 'el',
  sq: 'sq',
  ar: 'ar',
  zh: 'zh-Hans',
  ja: 'ja',
};

export const rtlLocales: Locale[] = ['ar'];

export const isLocale = (value: string | undefined): value is Locale =>
  !!value && (locales as readonly string[]).includes(value);

/** Parametro `lang` per getStaticPaths: undefined per l'italiano (nessun prefisso). */
export const langParam = (locale: Locale) => (locale === defaultLocale ? undefined : locale);

/** Costruisce un percorso nella lingua indicata, es. path('fr', '/eventi/') → '/fr/eventi/'. */
export const path = (locale: Locale, p = '/') => {
  const clean = p.startsWith('/') ? p : `/${p}`;
  return locale === defaultLocale ? clean : `/${locale}${clean}`;
};

/** Toglie il prefisso di lingua da un percorso, per il selettore lingua. */
export const stripLocale = (pathname: string) => {
  const [, first, ...rest] = pathname.split('/');
  return isLocale(first) ? `/${rest.join('/')}` : pathname;
};

/** getStaticPaths per una pagina che esiste in tutte le lingue. */
export const localePaths = () => locales.map((locale) => ({ params: { lang: langParam(locale) }, props: { locale } }));

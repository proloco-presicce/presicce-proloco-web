import { htmlLang, type Locale } from '../i18n/config';

const TIME_ZONE = 'Europe/Rome';

/** Data dell'evento nella lingua del visitatore, sempre nel fuso orario di Presicce. */
export function formatDate(iso: string, locale: Locale, withTime = false) {
  const date = new Date(iso);
  const hasTime = withTime && !iso.includes('T00:00:00');
  return new Intl.DateTimeFormat(htmlLang[locale], {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

/** Giorno e mese abbreviato per il "bollino" sulle card, es. { day: '12', month: 'ott' }. */
export function dateBadge(iso: string, locale: Locale) {
  const date = new Date(iso);
  const part = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(htmlLang[locale], { timeZone: TIME_ZONE, ...opts }).format(date);
  return { day: part({ day: 'numeric' }), month: part({ month: 'short' }) };
}

/** Link tel: e WhatsApp a partire da un numero scritto a mano ("+39 340 650 6421"). */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const whatsappHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;

/** Link "Aggiungi a Google Calendar" (funziona anche da smartphone senza scaricare file). */
export function calendarHref(title: string, startIso: string, endIso: string | undefined, location = '') {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = fmt(startIso);
  const end = fmt(endIso ?? new Date(new Date(startIso).getTime() + 2 * 3600_000).toISOString());
  const params = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${start}/${end}`, location });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Giorno della settimana per esteso, per la riga sotto il titolo delle card ("domenica"). */
export const weekday = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(htmlLang[locale], { timeZone: TIME_ZONE, weekday: 'long' }).format(new Date(iso));

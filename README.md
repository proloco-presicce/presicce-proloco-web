# Sito Pro Loco Presicce

Nuovo sito di [presicceproloco.org](https://presicceproloco.org), che sostituisce il WordPress su Amazon Lightsail.

- `web/`: il sito pubblico, fatto con [Astro](https://astro.build), in 10 lingue (italiano, inglese, francese, spagnolo, tedesco, greco, albanese, arabo, cinese, giapponese). Si pubblica su Vercel.
- `studio/`: l'area riservata ([Sanity Studio](https://www.sanity.io)) dove la Pro Loco e i volontari entrano con email e password e caricano eventi e testi.
- `scripts/`: script una tantum per portare i contenuti dal vecchio WordPress.

La grafica attuale è provvisoria: verrà sostituita da quella fatta con Claude Design.

## Come funziona

1. Un volontario entra su `presicceproloco.org/admin`, crea un evento in italiano e preme **Pubblica**.
2. Sanity avvisa il sito (`/api/translate`): i testi italiani nuovi o cambiati vengono tradotti nelle altre 9 lingue con l'API di Claude e salvati nell'evento. Le traduzioni corrette a mano non vengono più sovrascritte.
3. Vercel rigenera il sito e in circa un minuto l'evento è online in tutte le lingue.

Il sito non vende nulla: per prenotare ci sono i pulsanti "Chiama" e WhatsApp.

## Lavorare in locale

Serve Node.js 22.

```bash
npm install
npm run dev        # sito su http://localhost:4321
npm run studio     # area riservata su http://localhost:3333
```

Senza `PUBLIC_SANITY_PROJECT_ID` il sito usa `web/src/data/seed.json`, cioè i contenuti estratti dal vecchio sito, quindi si può lavorare alla grafica anche prima di configurare Sanity.

## Messa in funzione (una volta sola)

1. **Sanity**: crea il progetto su sanity.io/manage e scrivi il suo Project ID in `studio/env.ts`. In *API → CORS origins* aggiungi gli indirizzi del sito (con "Allow credentials"). L'area riservata è dentro il sito, su `/admin`: non va pubblicata a parte.
2. **Contenuti**: i contenuti del vecchio sito sono già stati importati in Sanity (ottobre 2026, con l'endpoint `/api/importa`, poi rimosso: è nella storia git se servisse di nuovo). Su Vercel `PUBLIC_SANITY_PROJECT_ID` fa leggere il sito da Sanity invece che da `seed.json`.
3. **Vercel**: importa il repository, imposta *Root Directory* = `web` e aggiungi le variabili di `.env.example`. Crea un *Deploy Hook* e mettine l'indirizzo in `VERCEL_DEPLOY_HOOK_URL`.
4. **Sanity → API**: crea un token con permessi di scrittura (`SANITY_WRITE_TOKEN`) e un webhook verso `https://presicceproloco.org/api/translate`, sui documenti `evento`, `stazione`, `pagina`, `impostazioni`, evento *publish*, con l'header `x-webhook-secret` uguale a `SANITY_WEBHOOK_SECRET`.
5. **Anthropic**: crea una chiave API su console.anthropic.com e mettila in `ANTHROPIC_API_KEY`, con un limite di spesa mensile basso.
6. **Volontari**: in sanity.io/manage → Members, invitali con ruolo *Editor*.

## Aggiornare i contenuti estratti

```bash
node scripts/extract-wp.mjs ../presicce-analisi/raw
```

legge l'HTML e i JSON salvati dal vecchio sito e riscrive `web/src/data/seed.json`.

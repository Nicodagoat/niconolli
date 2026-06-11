# Trenord Strike Monitor

Servizio automatico che monitora la pagina avvisi di Trenord
(<https://www.trenord.it/news/trenord-informa/avvisi/>), rileva gli avvisi di
**sciopero** e crea automaticamente eventi calendario.

## Cosa fa

1. Controlla la pagina avvisi ogni **6 ore** (APScheduler, oppure cron/GitHub Actions con `--once`).
2. Estrae tutti gli avvisi presenti nell'elenco.
3. Confronta con lo storico locale **SQLite** e individua solo gli avvisi nuovi.
4. Se il testo contiene `sciopero`, `agitazione sindacale` o `strike`, lo tratta come avviso di sciopero.
5. Apre la pagina di dettaglio dell'avviso e ne analizza il contenuto.
6. Estrae **data/ora di inizio e fine** dello sciopero, titolo e URL.
7. Converte tutte le date nel fuso **Europe/Rome**.
8. Genera un file **.ics** con titolo `Sciopero Trenord`, descrizione sintetica e link all'avviso.
9. Crea l'evento sul **Google Calendar** configurato (default: `niccolonolli@gmail.com`) tramite Google Calendar API.
10. Invia (opzionale) una **notifica Telegram**.
11. **Nessun duplicato**: storico in SQLite + ID evento deterministico lato Google Calendar.

Se il parser principale (regex sui pattern tipici degli avvisi Trenord) non
trova le date, scatta il fallback con **dateparser** sul testo completo; se
viene trovata solo una data senza orari l'evento viene creato "tutto il
giorno". Se non viene trovata alcuna data, l'evento non viene creato ma la
notifica Telegram segnala l'avviso da controllare manualmente.

## Struttura del progetto

```
trenord-strike-monitor/
├── main.py                     # entrypoint (scheduler o --once)
├── requirements.txt
├── .env.example                # template configurazione → copiare in .env
├── Dockerfile
├── docker-compose.yml
├── src/
│   ├── config.py               # caricamento .env / variabili d'ambiente
│   ├── logging_setup.py        # logging console + file rotante
│   ├── database.py             # storico SQLite (avvisi + run)
│   ├── scraper.py              # scraping elenco e dettaglio (3 strategie)
│   ├── strike_parser.py        # keyword sciopero + estrazione date (regex/dateparser)
│   ├── ics_writer.py           # generazione file .ics (RFC 5545)
│   ├── google_calendar.py      # Google Calendar API (service account / OAuth)
│   ├── telegram_notifier.py    # notifiche Telegram opzionali
│   └── monitor.py              # orchestrazione di un ciclo di controllo
├── scripts/
│   └── google_oauth_setup.py   # generazione token OAuth (esecuzione locale)
├── data/                       # avvisi.sqlite3 + file .ics generati
├── logs/                       # monitor.log (rotazione automatica)
└── secrets/                    # credenziali Google (non versionate)

../.github/workflows/trenord-monitor.yml   # esecuzione schedulata su GitHub Actions
```

## Configurazione

```bash
cd trenord-strike-monitor
cp .env.example .env
# poi compila i valori in .env
```

Variabili principali (vedi `.env.example` per l'elenco completo):

| Variabile | Default | Descrizione |
|---|---|---|
| `CHECK_INTERVAL_HOURS` | `6` | intervallo tra i controlli |
| `GOOGLE_CALENDAR_ID` | `niccolonolli@gmail.com` | calendario di destinazione |
| `GOOGLE_AUTH_METHOD` | `service_account` | `service_account` oppure `oauth` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | vuoti | notifiche Telegram (opzionali) |

### Credenziali Google Calendar

Sono supportati due metodi. Per un servizio sempre attivo (server, Docker,
GitHub Actions) è consigliato il **service account**.

**Metodo A — Service account (consigliato per server/CI)**

1. Su [Google Cloud Console](https://console.cloud.google.com/) crea un progetto e abilita la **Google Calendar API** (API e servizi → Libreria).
2. API e servizi → Credenziali → *Crea credenziali* → **Account di servizio**; al termine apri l'account di servizio → Chiavi → *Aggiungi chiave* → JSON.
3. Salva il file JSON in `secrets/service_account.json`.
4. Su [Google Calendar](https://calendar.google.com/) (account `niccolonolli@gmail.com`): Impostazioni del calendario → *Condividi con persone specifiche* → aggiungi l'email del service account (`...@...iam.gserviceaccount.com`) con permesso **"Apportare modifiche agli eventi"**.

**Metodo B — OAuth (account personale, esecuzione locale)**

1. Stesso progetto Cloud con Calendar API abilitata; crea credenziali **OAuth 2.0** di tipo *Desktop app* e scarica il JSON in `secrets/oauth_client.json`.
2. Genera il token (si apre il browser per autorizzare `niccolonolli@gmail.com`):
   ```bash
   python scripts/google_oauth_setup.py
   ```
3. Imposta in `.env`: `GOOGLE_AUTH_METHOD=oauth`. Il token viene rinnovato automaticamente.

### Telegram (opzionale)

1. Crea un bot con [@BotFather](https://t.me/BotFather) → ottieni il token.
2. Scrivi un messaggio al bot, poi recupera il tuo chat id:
   `https://api.telegram.org/bot<TOKEN>/getUpdates` → campo `message.chat.id`.
3. Inserisci `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` in `.env`.

## Esecuzione locale

Richiede Python ≥ 3.10.

```bash
cd trenord-strike-monitor
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # e compila i valori

# servizio continuo (controllo subito + ogni 6 ore)
python main.py

# oppure controllo singolo (per cron di sistema)
python main.py --once
```

Log su console e in `logs/monitor.log`; storico in `data/avvisi.sqlite3`;
file `.ics` in `data/ics/`.

## Docker

```bash
cd trenord-strike-monitor
cp .env.example .env   # e compila i valori
# metti le credenziali Google in secrets/

docker compose up -d --build
docker compose logs -f
```

Il container gira con `restart: unless-stopped` e lo scheduler interno ogni 6
ore; `data/`, `logs/` e `secrets/` sono montati come volumi, quindi storico e
credenziali sopravvivono al riavvio del container.

## GitHub Actions (schedulato ogni 6 ore)

Il workflow è già incluso: [`.github/workflows/trenord-monitor.yml`](../.github/workflows/trenord-monitor.yml).
Esegue `python main.py --once` con cron `0 */6 * * *` (e a richiesta con
*Run workflow*). Lo storico SQLite viene conservato tra le esecuzioni tramite
la cache di GitHub Actions e i file `.ics` vengono caricati come artifact.

Configura i **Secrets** del repository (Settings → Secrets and variables →
Actions → *New repository secret*):

| Secret | Contenuto |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | l'intero contenuto del file JSON del service account |
| `GOOGLE_CALENDAR_ID` | `niccolonolli@gmail.com` |
| `TELEGRAM_BOT_TOKEN` | token del bot (opzionale) |
| `TELEGRAM_CHAT_ID` | chat id (opzionale) |

Note:
- in GitHub Actions va usato il metodo **service account** (nessun browser disponibile per il flusso OAuth);
- gli schedule di GitHub possono slittare di alcuni minuti: è normale;
- la cache di GitHub scade dopo 7 giorni di inattività: alla scadenza il
  database riparte vuoto e gli avvisi ancora in pagina verrebbero rivisti come
  "nuovi", ma i duplicati su Google Calendar sono comunque impossibili perché
  l'ID evento è derivato dall'URL dell'avviso (l'API risponde 409 e il
  servizio lo tratta come "già creato".)

## Gestione errori e robustezza

- **Rete**: retry automatici con backoff esponenziale (4 tentativi) su errori 429/5xx e timeout configurabile.
- **HTML cambiato**: tre strategie di parsing in cascata (link diretti, JSON `__NEXT_DATA__`, JSON-LD); se nessuna produce risultati viene loggato un errore esplicito che indica di aggiornare i selettori.
- **Date non trovate**: fallback regex → dateparser → evento "tutto il giorno" → notifica Telegram di controllo manuale.
- **Errori temporanei** (rete o API Google): l'avviso resta "pending" nel database e viene rielaborato al ciclo successivo; gli ID deterministici degli eventi impediscono comunque i duplicati.
- **Akamai/bot protection**: il sito Trenord è dietro Akamai; il servizio usa header da browser reale (`USER_AGENT` configurabile). Se l'IP di esecuzione viene bloccato (alcuni datacenter lo sono), eseguire il servizio da una rete residenziale o tramite un runner self-hosted.

## Schema database (SQLite)

- `avvisi`: `url` (UNIQUE), `title`, `content_hash`, `is_strike`,
  `strike_start`/`strike_end` (ISO 8601, Europe/Rome), `all_day`, `ics_path`,
  `gcal_event_id`, `telegram_notified`, `first_seen`, `processed_at`.
- `runs`: storico delle esecuzioni con esito, numero di nuovi avvisi e scioperi rilevati.

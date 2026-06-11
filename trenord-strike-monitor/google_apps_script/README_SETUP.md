# Setup Google Apps Script (una volta sola, poi va da solo)

Il monitor gira nel cloud di Google **per sempre, in background, gratis**:
controlla la pagina avvisi Trenord ogni 6 ore e crea **un solo evento
"Sciopero Trenord"** per ogni sciopero.

## 1. API key ScraperAPI (gratis)

→ **https://www.scraperapi.com** → Sign up (no carta di credito) → copia la API key.

Serve perché Trenord blocca gli IP dei datacenter (inclusi quelli di Google):
le richieste passano da ScraperAPI. Il piano gratuito (1000 chiamate/mese)
basta ampiamente: il monitor ne usa ~5 al giorno.

## 2. Progetto Apps Script

→ **https://script.google.com** → Nuovo progetto → incolla `TrenordMonitor.gs`

Poi: ⚙ **Impostazioni progetto** (sidebar in basso a sinistra) →
**Proprietà script** → *Aggiungi proprietà*:

| Nome | Valore |
|---|---|
| `SCRAPER_API_KEY` | la tua key ScraperAPI |

## 3. Avvio (una volta sola)

1. **Ctrl+S** per salvare
2. Dal dropdown nella toolbar seleziona **`setupTrigger`** → ▶ **Run**
3. Consenti le autorizzazioni (se appare "App non verificata":
   Avanzate → "Vai a … (non sicuro)" — normale per gli script personali)

`setupTrigger` registra il trigger **ogni 6 ore** ed esegue subito il primo
controllo. Da questo momento non devi più fare nulla: il PC può essere spento,
gira tutto sui server di Google.

## Come funziona l'anti-duplicato (v2)

- un avviso è considerato sciopero solo se **il titolo** contiene
  `sciopero` / `agitazione sindacale` / `strike` (Trenord mette il banner
  sciopero su *tutte* le pagine, quindi il testo della pagina darebbe falsi
  positivi — è il bug che aveva creato 14 eventi);
- prima di creare l'evento si controlla se sul calendario esiste già uno
  "Sciopero Trenord" **nello stesso periodo** → in quel caso si salta;
- lo storico degli URL già visti è salvato in modo incrementale, quindi
  anche se un'esecuzione viene interrotta non si riparte da zero.

## Funzioni di utilità (eseguibili dal dropdown)

| Funzione | Cosa fa |
|---|---|
| `main()` | controllo manuale immediato |
| `cleanupDuplicates()` | rimuove eventuali eventi "Sciopero Trenord" duplicati |
| `resetSeen()` | azzera lo storico degli avvisi visti |

## Verifica

- **Esecuzioni** (sidebar) → log di ogni run
- **Trigger** (icona ⏰) → deve esserci `main / Basato sul tempo / Ogni 6 ore`
- Se un avviso di sciopero non ha date riconoscibili ricevi una **email**
  con il link per controllarlo a mano.

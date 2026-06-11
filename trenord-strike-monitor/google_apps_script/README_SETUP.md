# Setup Google Apps Script (2 minuti)

## 1. Apri il tuo Google Apps Script

→ **https://script.google.com/home/start**

Clicca **"Nuovo progetto"**.

## 2. Incolla il codice

- Seleziona tutto il contenuto del file `TrenordMonitor.gs`
- Incollalo nell'editor (sostituendo il `function myFunction() {}` vuoto)
- Clicca il **floppy disk** (salva) o `Ctrl+S`

## 3. Avvia il monitor

Nella toolbar in alto, dal menu a discesa accanto al tasto ▶ Run, seleziona **`setupTrigger`** e clicca ▶.

Google chiede le autorizzazioni → clicca **"Esamina le autorizzazioni"** → scegli il tuo account Google → **"Consenti"**.

`setupTrigger` fa due cose:
1. Registra il trigger automatico **ogni 6 ore**
2. Esegue subito il primo controllo

## 4. Verifica

- Clicca **"Esecuzioni"** (icona a sinistra) per vedere i log del primo run
- Apri Google Calendar: se c'è uno sciopero attivo troverai l'evento **"Sciopero Trenord"**

## Niente altro da fare

Il monitor girerà da solo ogni 6 ore finché non lo elimini da **Trigger** → icona orologio a sinistra.

---

### Funzioni di utilità

| Funzione | Cosa fa |
|---|---|
| `setupTrigger()` | Registra il trigger e avvia subito |
| `main()` | Esegui un controllo manuale al volo |
| `resetSeen()` | Azzera lo storico (riprocessa tutti gli avvisi) |

### Se un avviso non ha date riconoscibili

Ricevi una email automatica su `niccolonolli@gmail.com` con il link all'avviso da controllare manualmente.

/**
 * Trenord Strike Monitor — Google Apps Script  (v2)
 *
 * Setup (una tantum):
 *  1. Registrati gratis su https://www.scraperapi.com e copia la API key.
 *  2. In questo editor: ⚙ Impostazioni progetto → Proprietà script →
 *     aggiungi:  SCRAPER_API_KEY = <la tua key>
 *  3. Salva (Ctrl+S), seleziona setupTrigger() dal dropdown, ▶ Run, Consenti.
 *
 * v2 — fix anti-duplicati:
 *  - un avviso è "sciopero" solo se il TITOLO o lo slug URL contengono le
 *    keyword (Trenord mette il banner sciopero su tutte le pagine del sito,
 *    quindi il testo della pagina non è affidabile per la classificazione)
 *  - prima di creare un evento si controlla se sul calendario esiste già un
 *    "Sciopero Trenord" che si sovrappone allo stesso periodo → si salta
 *  - lo storico viene salvato dopo OGNI avviso (resiste ai timeout)
 *  - max 10 nuovi avvisi per esecuzione (limite 6 min di Apps Script)
 */

// ─── Configurazione ───────────────────────────────────────────────────────────
const CONFIG = {
  AVVISI_URL:    'https://www.trenord.it/news/trenord-informa/avvisi/',
  CALENDAR_ID:   'niccolonolli@gmail.com',
  LISTING_PATH:  '/news/trenord-informa/avvisi',
  KEYWORDS:      ['sciopero', 'agitazione sindacale', 'strike'],
  SCRAPER_PROXY: 'https://api.scraperapi.com/?api_key={KEY}&url={URL}',
  MAX_PER_RUN:   10,
};

// ─── Mesi italiani ───────────────────────────────────────────────────────────
const MONTHS = {
  gennaio:1, febbraio:2, marzo:3, aprile:4, maggio:5, giugno:6,
  luglio:7, agosto:8, settembre:9, ottobre:10, novembre:11, dicembre:12,
};
const MONTH_RE = Object.keys(MONTHS).join('|');

// ─── Entrypoint principale ───────────────────────────────────────────────────
function main() {
  Logger.log('=== Trenord Strike Monitor ===');
  const store = PropertiesService.getScriptProperties();
  const seen  = JSON.parse(store.getProperty('seen') || '{}');

  let html;
  try {
    html = fetchPage(CONFIG.AVVISI_URL);
  } catch (e) {
    Logger.log('Fetch pagina fallita: ' + e.message);
    return;
  }

  const notices = parseNotices(html);
  Logger.log('Avvisi in pagina: ' + notices.length);

  let newCount = 0, strikeCount = 0;

  for (const notice of notices) {
    if (seen[notice.url]) continue;            // già elaborato
    if (newCount >= CONFIG.MAX_PER_RUN) break; // il resto al prossimo giro

    Logger.log('Nuovo avviso: ' + notice.title);
    newCount++;

    // La classificazione usa SOLO titolo + slug URL: il testo della pagina
    // contiene il banner sciopero sitewide e darebbe falsi positivi.
    if (!isStrike(notice.title + ' ' + notice.url)) {
      seen[notice.url] = { strike: false };
      store.setProperty('seen', JSON.stringify(seen));
      continue;
    }

    Logger.log('SCIOPERO: ' + notice.title);
    strikeCount++;

    let detailText = notice.title;
    try {
      detailText = extractText(fetchPage(notice.url));
    } catch (e) {
      Logger.log('Dettaglio non raggiungibile: ' + e.message);
    }

    const period  = extractPeriod(detailText) || extractPeriod(notice.title);
    const eventId = period
      ? createEvent(notice.title, detailText, notice.url, period)
      : null;

    seen[notice.url] = { strike: true, eventId: eventId };
    store.setProperty('seen', JSON.stringify(seen));

    if (!period) {
      Logger.log('ATTENZIONE: date non trovate per ' + notice.url);
      notifyNoDates(notice.title, notice.url);
    }
  }

  Logger.log('Fine: ' + newCount + ' nuovi, ' + strikeCount + ' scioperi');
}

// ─── Setup trigger ogni 6 ore (esegui una volta sola) ────────────────────────
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('main').timeBased().everyHours(6).create();
  Logger.log('Trigger ogni 6 ore registrato.');
  main(); // primo controllo immediato
}

// ─── HTTP via ScraperAPI ─────────────────────────────────────────────────────
function fetchPage(url) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('SCRAPER_API_KEY');
  if (!apiKey) throw new Error('SCRAPER_API_KEY non impostata nelle Proprietà script.');

  const proxyUrl = CONFIG.SCRAPER_PROXY
    .replace('{KEY}', encodeURIComponent(apiKey))
    .replace('{URL}', encodeURIComponent(url));

  const res = UrlFetchApp.fetch(proxyUrl, { method: 'GET', muteHttpExceptions: true });
  const code = res.getResponseCode();
  if (code !== 200) throw new Error('HTTP ' + code + ' per ' + url);
  return res.getContentText('UTF-8');
}

// ─── Parsing elenco avvisi ───────────────────────────────────────────────────
function parseNotices(html) {
  const base = 'https://www.trenord.it';
  const re   = /href="(\/news\/trenord-informa\/avvisi\/[^"?#]+)"/gi;
  const dedup = {};
  const out   = [];
  let m;

  while ((m = re.exec(html)) !== null) {
    const path = m[1].replace(/\/$/, '');
    if (path === CONFIG.LISTING_PATH) continue;
    const url = base + path;
    if (dedup[url]) continue;
    dedup[url] = true;

    const ctx = html.slice(Math.max(0, m.index - 300), m.index + 500);
    let title = '';
    const hMatch = ctx.match(/<h[2-4][^>]*>([^<]{5,150})<\/h[2-4]>/i);
    if (hMatch) title = hMatch[1].trim();
    if (!title) {
      const aText = ctx.match(/>[^<\n]{5,120}</);
      if (aText) title = aText[0].slice(1, -1).trim();
    }
    title = title
      .replace(/&amp;/g, '&').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim()
      || path.split('/').pop().replace(/-/g, ' ');

    out.push({ url: url, title: title });
  }
  return out;
}

// ─── Estrazione testo puro (senza nav/footer) ────────────────────────────────
function extractText(html) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&hellip;/g, '…').replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ').trim();

  // Taglia la spazzatura di navigazione/footer che segue il contenuto
  for (const marker of ['Maggiori informazioni Accedi', 'Accedi / Registrati', 'Titoli di viaggio Biglietti']) {
    const idx = text.indexOf(marker);
    if (idx > 100) { text = text.slice(0, idx).trim(); break; }
  }
  return text;
}

// ─── Keyword sciopero (solo titolo/slug) ─────────────────────────────────────
function isStrike(titleAndSlug) {
  const t = titleAndSlug.toLowerCase().replace(/-/g, ' ');
  return CONFIG.KEYWORDS.some(k => t.includes(k));
}

// ─── Estrazione date ─────────────────────────────────────────────────────────
function extractPeriod(text) {
  const t = text.toLowerCase();
  const now = new Date();

  // 1) "dalle ore 3:00 di giovedì 11 giugno [fino] alle ore 2:00 di venerdì 12 giugno [2026]"
  const reCross = new RegExp(
    `dall[ae]\\s+(?:ore\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?\\s+(?:di|del)\\s+(?:\\w+[iì]\\s+|sabato\\s+|domenica\\s+)?(\\d{1,2})\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?` +
    `[\\s,]+(?:e\\s+)?(?:fino\\s+)?all[ae]\\s+(?:ore\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?\\s+(?:di|del)\\s+(?:\\w+[iì]\\s+|sabato\\s+|domenica\\s+)?(\\d{1,2})\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?`,
    'i'
  );
  let m = reCross.exec(t);
  if (m) {
    const s = makeDate(m[3], m[4], m[5], m[1], m[2], now);
    const e = makeDate(m[8], m[9], m[10], m[6], m[7], now);
    if (s && e) {
      if (e <= s) e.setFullYear(e.getFullYear() + 1);
      return { start: s, end: e, allDay: false };
    }
  }

  // 2) "12 giugno [2026], dalle ore 9:01 alle ore 17:59"
  const reSameDay = new RegExp(
    `(?:\\w+[iì]\\s+)?(\\d{1,2})\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?\\s*[,;:]?\\s*` +
    `dall[ae]\\s+(?:ore\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?\\s+(?:fino\\s+)?all[ae]\\s+(?:ore\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?`,
    'i'
  );
  m = reSameDay.exec(t);
  if (m) {
    const s = makeDate(m[1], m[2], m[3], m[4], m[5], now);
    const e = makeDate(m[1], m[2], m[3], m[6], m[7], now);
    if (s && e) {
      if (e <= s) e.setDate(e.getDate() + 1);
      return { start: s, end: e, allDay: false };
    }
  }

  // 3) "dalle ore 9:01 alle ore 17:59 del 20 giugno [2026]"
  const reTimesFirst = new RegExp(
    `dall[ae]\\s+(?:ore\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?\\s+(?:fino\\s+)?all[ae]\\s+(?:ore\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?\\s+` +
    `(?:di|del(?:\\s+giorno)?)\\s+(?:\\w+[iì]\\s+|sabato\\s+|domenica\\s+)?(\\d{1,2})\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?`,
    'i'
  );
  m = reTimesFirst.exec(t);
  if (m) {
    const s = makeDate(m[5], m[6], m[7], m[1], m[2], now);
    const e = makeDate(m[5], m[6], m[7], m[3], m[4], now);
    if (s && e) {
      if (e <= s) e.setDate(e.getDate() + 1);
      return { start: s, end: e, allDay: false };
    }
  }

  // 4) Formato numerico: "12/06/2026 ore 03:00 ... 13/06/2026 ore 02:00"
  const numRe = /(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})[^\d]*(\d{1,2})[:.]\s*(\d{2})/g;
  const nums  = [];
  let nm;
  while ((nm = numRe.exec(text)) !== null) nums.push(nm);
  if (nums.length >= 2) {
    const s = makeDateNum(nums[0]), e = makeDateNum(nums[1]);
    if (s && e) {
      if (e <= s) e.setDate(e.getDate() + 1);
      return { start: s, end: e, allDay: false };
    }
  }

  // 5) Solo data → evento tutto il giorno
  const reSingle = new RegExp(`(\\d{1,2})\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?`, 'i');
  m = reSingle.exec(t);
  if (m) {
    const s = makeDate(m[1], m[2], m[3], '0', '0', now);
    if (s) {
      const e = new Date(s); e.setDate(e.getDate() + 1);
      return { start: s, end: e, allDay: true };
    }
  }

  return null;
}

function makeDate(day, monthName, year, hour, min, now) {
  const month = MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  let y;
  if (year) {
    y = parseInt(year);
  } else {
    y = now.getFullYear();
    const candidate = new Date(y, month - 1, parseInt(day));
    if (candidate < new Date(now.getTime() - 60 * 86400000)) y += 1;
  }
  const d = new Date(y, month - 1, parseInt(day), parseInt(hour || 0), parseInt(min || 0), 0);
  return isNaN(d.getTime()) ? null : d;
}

function makeDateNum(m) {
  let y = parseInt(m[3]); if (y < 100) y += 2000;
  const d = new Date(y, parseInt(m[2]) - 1, parseInt(m[1]), parseInt(m[4]), parseInt(m[5]), 0);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Creazione evento (con deduplica per periodo) ────────────────────────────
function createEvent(title, detailText, url, period) {
  try {
    const cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID)
              || CalendarApp.getDefaultCalendar();

    // DEDUPLICA: se esiste già uno "Sciopero Trenord" che si sovrappone allo
    // stesso periodo, non creare un secondo evento (più avvisi possono
    // riferirsi allo stesso sciopero).
    const existing = cal.getEvents(period.start, period.end)
      .filter(ev => ev.getTitle() === 'Sciopero Trenord');
    if (existing.length > 0) {
      Logger.log('Evento già presente per questo periodo, salto: ' + title);
      return existing[0].getId();
    }

    const desc = title + '\n\n' + detailText.substring(0, 800) + '\n\nAvviso: ' + url;
    const event = period.allDay
      ? cal.createAllDayEvent('Sciopero Trenord', period.start, { description: desc })
      : cal.createEvent('Sciopero Trenord', period.start, period.end, { description: desc });

    Logger.log('Evento creato: ' + period.start + ' → ' + period.end);
    return event.getId();
  } catch (e) {
    Logger.log('Errore creazione evento: ' + e.message);
    return null;
  }
}

// ─── Email se le date non sono riconosciute ──────────────────────────────────
function notifyNoDates(title, url) {
  try {
    MailApp.sendEmail({
      to:      Session.getActiveUser().getEmail(),
      subject: '⚠️ Sciopero Trenord — date non riconosciute',
      body:    'Rilevato un avviso di sciopero ma le date non sono state estratte.\n\n' +
               'Titolo: ' + title + '\nURL: ' + url + '\n\nControlla e aggiungi l\'evento a mano.',
    });
  } catch (_) {}
}

// ─── Utilità ─────────────────────────────────────────────────────────────────

/** Azzera lo storico (gli avvisi in pagina verranno rivisti come nuovi). */
function resetSeen() {
  PropertiesService.getScriptProperties().deleteProperty('seen');
  Logger.log('Storico azzerato.');
}

/** Rimuove i duplicati "Sciopero Trenord" nei prossimi 60 giorni (ne tiene 1 per periodo). */
function cleanupDuplicates() {
  const cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID)
            || CalendarApp.getDefaultCalendar();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  const to = new Date();
  to.setDate(to.getDate() + 60);

  const groups = {};
  cal.getEvents(from, to)
    .filter(ev => ev.getTitle() === 'Sciopero Trenord')
    .forEach(ev => {
      const key = ev.getStartTime().getTime() + '|' + ev.getEndTime().getTime();
      (groups[key] = groups[key] || []).push(ev);
    });

  let deleted = 0;
  for (const key in groups) {
    groups[key].slice(1).forEach(ev => { ev.deleteEvent(); deleted++; });
  }
  Logger.log('Duplicati rimossi: ' + deleted);
}

/**
 * Trenord Strike Monitor — Google Apps Script
 *
 * Setup (una tantum, 2 minuti):
 *  1. Vai su https://script.google.com → Nuovo progetto
 *  2. Incolla questo file
 *  3. Esegui setupTrigger() una volta sola → il monitor parte ogni 6 ore
 *  4. Alla prima esecuzione Google chiede le autorizzazioni → Consenti
 *
 * Non serve nessuna chiave API. Il calendario viene aggiornato direttamente.
 */

// ─── Configurazione ───────────────────────────────────────────────────────────
const CONFIG = {
  AVVISI_URL:    'https://www.trenord.it/news/trenord-informa/avvisi/',
  CALENDAR_ID:   'niccolonolli@gmail.com',   // o 'primary'
  LISTING_PATH:  '/news/trenord-informa/avvisi',
  KEYWORDS:      ['sciopero', 'agitazione sindacale', 'strike'],
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
    if (seen[notice.url]) continue;   // già elaborato

    Logger.log('Nuovo avviso: ' + notice.title);
    newCount++;

    // Carica il testo del dettaglio
    let detailText = notice.title;
    try {
      detailText = extractText(fetchPage(notice.url));
    } catch (e) {
      Logger.log('Dettaglio non raggiungibile: ' + e.message);
    }

    const fullText = notice.title + ' ' + detailText;

    if (!isStrike(fullText)) {
      seen[notice.url] = { strike: false };
      continue;
    }

    Logger.log('SCIOPERO: ' + notice.title);
    strikeCount++;

    const period  = extractPeriod(detailText) || extractPeriod(fullText);
    const eventId = period ? createEvent(notice.title, detailText, notice.url, period) : null;

    seen[notice.url] = { strike: true, eventId };

    if (!period) {
      Logger.log('ATTENZIONE: date non trovate per ' + notice.url);
      notifyNoDates(notice.title, notice.url);
    }
  }

  store.setProperty('seen', JSON.stringify(seen));
  Logger.log('Fine: ' + newCount + ' nuovi, ' + strikeCount + ' scioperi');
}

// ─── Setup trigger ogni 6 ore (esegui una volta sola) ────────────────────────
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('main').timeBased().everyHours(6).create();
  Logger.log('Trigger ogni 6 ore registrato. Primo run tra ≤ 6 ore.');
  main(); // esegui subito la prima volta
}

// ─── HTTP ────────────────────────────────────────────────────────────────────
function fetchPage(url) {
  const res = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
      'Accept':          'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'it-IT,it;q=0.9',
    },
    followRedirects:   true,
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 200) throw new Error('HTTP ' + code + ' per ' + url);
  return res.getContentText('UTF-8');
}

// ─── Parsing elenco avvisi ───────────────────────────────────────────────────
function parseNotices(html) {
  const base = 'https://www.trenord.it';
  const re   = /href="(\/news\/trenord-informa\/avvisi\/[^"?#]+)"/gi;
  const seen = {};
  const out  = [];
  let m;

  while ((m = re.exec(html)) !== null) {
    const path = m[1].replace(/\/$/, '');
    if (path === CONFIG.LISTING_PATH) continue;
    const url = base + path;
    if (seen[url]) continue;
    seen[url] = true;

    // Cerca il titolo nel contesto HTML intorno al link
    const ctx   = html.slice(Math.max(0, m.index - 300), m.index + 500);
    let title   = '';
    const hMatch = ctx.match(/<h[2-4][^>]*>([^<]{5,150})<\/h[2-4]>/i);
    if (hMatch) title = hMatch[1].trim();
    if (!title) {
      const aText = ctx.match(/>[^<\n]{5,120}</);
      if (aText) title = aText[0].slice(1, -1).trim();
    }
    title = title
      .replace(/&amp;/g, '&').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim()
      || path.split('/').pop().replace(/-/g, ' ');

    out.push({ url, title });
  }
  return out;
}

// ─── Estrazione testo puro ───────────────────────────────────────────────────
function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// ─── Keyword sciopero ────────────────────────────────────────────────────────
function isStrike(text) {
  const t = text.toLowerCase();
  return CONFIG.KEYWORDS.some(k => t.includes(k));
}

// ─── Estrazione date ─────────────────────────────────────────────────────────
function extractPeriod(text) {
  const t = text.toLowerCase();
  const now = new Date();

  // 1) "dalle ore 3:00 di giovedì 12 giugno alle ore 2:00 di venerdì 13 giugno [2026]"
  const reCross = new RegExp(
    `dall[ae]\\s+(?:ore\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?\\s+(?:di|del)\\s+(?:\\w+[iì]\\s+|sabato\\s+|domenica\\s+)?(\\d{1,2})\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?` +
    `[\\s,]+(?:e\\s+)?(?:fino\\s+)?all[ae]\\s+(?:ore\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?\\s+(?:di|del)\\s+(?:\\w+[iì]\\s+|sabato\\s+|domenica\\s+)?(\\d{1,2})\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?`,
    'i'
  );
  let m = reCross.exec(t);
  if (m) {
    const [,h1,m1,d1,mo1,y1,h2,m2,d2,mo2,y2] = m;
    const s = makeDate(d1,mo1,y1,h1,m1,now), e = makeDate(d2,mo2,y2,h2,m2,now);
    if (s && e) {
      if (e <= s) e.setFullYear(e.getFullYear() + 1);
      return { start:s, end:e, allDay:false };
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
    const [,d,mo,y,h1,mi1,h2,mi2] = m;
    const s = makeDate(d,mo,y,h1,mi1,now), e = makeDate(d,mo,y,h2,mi2,now);
    if (s && e) {
      if (e <= s) e.setDate(e.getDate() + 1);
      return { start:s, end:e, allDay:false };
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
    const [,h1,mi1,h2,mi2,d,mo,y] = m;
    const s = makeDate(d,mo,y,h1,mi1,now), e = makeDate(d,mo,y,h2,mi2,now);
    if (s && e) {
      if (e <= s) e.setDate(e.getDate() + 1);
      return { start:s, end:e, allDay:false };
    }
  }

  // 4) Formato numerico: "12/06/2026 ore 03:00 ... 13/06/2026 ore 02:00"
  const numRe = /(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})[^\d]*(\d{1,2})[:.]\s*(\d{2})/g;
  const nums  = [...text.matchAll(numRe)];
  if (nums.length >= 2) {
    const s = makeDateNum(nums[0]), e = makeDateNum(nums[1]);
    if (s && e) {
      if (e <= s) e.setDate(e.getDate() + 1);
      return { start:s, end:e, allDay:false };
    }
  }

  // 5) Solo data → evento tutto il giorno
  const reSingle = new RegExp(`(\\d{1,2})\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?`, 'i');
  m = reSingle.exec(t);
  if (m) {
    const [,d,mo,y] = m;
    const s = makeDate(d,mo,y,'0','0',now);
    if (s) {
      const e = new Date(s); e.setDate(e.getDate() + 1);
      return { start:s, end:e, allDay:true };
    }
  }

  return null;
}

function makeDate(day, monthName, year, hour, min, now) {
  const month = MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  try {
    let y = year ? parseInt(year) : (() => {
      const c = new Date(now.getFullYear(), month - 1, parseInt(day));
      return c < new Date(now - 60*86400000) ? now.getFullYear()+1 : now.getFullYear();
    })();
    return new Date(y, month - 1, parseInt(day), parseInt(hour||0), parseInt(min||0), 0);
  } catch(_) { return null; }
}

function makeDateNum(m) {
  try {
    let y = parseInt(m[3]); if (y < 100) y += 2000;
    return new Date(y, parseInt(m[2])-1, parseInt(m[1]), parseInt(m[4]), parseInt(m[5]), 0);
  } catch(_) { return null; }
}

// ─── Creazione evento Google Calendar ────────────────────────────────────────
function createEvent(title, detailText, url, period) {
  try {
    const cal  = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID)
               || CalendarApp.getDefaultCalendar();
    const desc = title + '\n\n' + detailText.substring(0, 800) + '\n\nAvviso: ' + url;
    const opts = {
      description: desc,
    };

    let event;
    if (period.allDay) {
      event = cal.createAllDayEvent('Sciopero Trenord', period.start, opts);
    } else {
      event = cal.createEvent('Sciopero Trenord', period.start, period.end, opts);
    }

    Logger.log('Evento creato: ' + event.getId() + ' | ' + period.start.toISOString());
    return event.getId();
  } catch (e) {
    Logger.log('Errore creazione evento: ' + e.message);
    return null;
  }
}

// ─── Notifica email se le date non sono riconosciute ─────────────────────────
function notifyNoDates(title, url) {
  try {
    MailApp.sendEmail({
      to:      Session.getActiveUser().getEmail(),
      subject: '⚠️ Sciopero Trenord — date non riconosciute',
      body:    'È stato rilevato un avviso di sciopero, ma le date non sono state estratte automaticamente.\n\nTitolo: ' + title + '\nURL: ' + url + '\n\nControlla manualmente e aggiungi l\'evento al calendario.',
    });
  } catch(_) {}
}

// ─── Reset storico (utilità) ──────────────────────────────────────────────────
function resetSeen() {
  PropertiesService.getScriptProperties().deleteProperty('seen');
  Logger.log('Storico azzerato.');
}

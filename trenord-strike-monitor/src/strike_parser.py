"""Riconoscimento scioperi ed estrazione di date/orari dal testo degli avvisi.

Strategia:
1. regex mirate sui pattern tipici degli avvisi Trenord
   ("dalle ore 3:00 di giovedì 12 giugno alle ore 2:00 di venerdì 13 giugno",
    "lo sciopero è previsto il 12 giugno dalle 9:01 alle 17:59", ...)
2. fallback con dateparser.search.search_dates sul testo completo
3. se viene trovata solo una data senza orari, l'evento è "tutto il giorno".
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

TZ = ZoneInfo("Europe/Rome")

STRIKE_KEYWORDS = ("sciopero", "agitazione sindacale", "strike")

_MONTHS = {
    "gennaio": 1,
    "febbraio": 2,
    "marzo": 3,
    "aprile": 4,
    "maggio": 5,
    "giugno": 6,
    "luglio": 7,
    "agosto": 8,
    "settembre": 9,
    "ottobre": 10,
    "novembre": 11,
    "dicembre": 12,
}
_MONTH_RE = "|".join(_MONTHS)

# Nome del giorno della settimana, opzionale ("giovedì 12 giugno")
_WD = r"(?:(?:luned|marted|mercoled|gioved|venerd)[iì]\s+|(?:sabato|domenica)\s+)?"
# Orario: "3", "3:00", "03.30", "ore 21"
_TIME = r"(\d{1,2})(?:[:.](\d{2}))?"

# "dalle ore 3:00 di giovedì 12 giugno [2026] alle ore 2:00 di venerdì 13 giugno [2026]"
_RE_CROSS_DAY = re.compile(
    rf"dall?e\s+(?:ore\s+)?{_TIME}\s+(?:di|del)\s+{_WD}(\d{{1,2}})\s+({_MONTH_RE})(?:\s+(\d{{4}}))?"
    rf"[\s,]+(?:e\s+)?(?:fino\s+)?all?e\s+(?:ore\s+)?{_TIME}\s+(?:di|del)\s+{_WD}(\d{{1,2}})\s+({_MONTH_RE})(?:\s+(\d{{4}}))?",
    re.IGNORECASE,
)

# "... 12 giugno [2026], dalle ore 9:01 alle ore 17:59"
_RE_DAY_FIRST = re.compile(
    rf"{_WD}(\d{{1,2}})\s+({_MONTH_RE})(?:\s+(\d{{4}}))?\s*[,;:]?\s*"
    rf"dall?e\s+(?:ore\s+)?{_TIME}\s+(?:fino\s+)?all?e\s+(?:ore\s+)?{_TIME}",
    re.IGNORECASE,
)

# "dalle ore 9:01 alle ore 17:59 di giovedì 12 giugno [2026]"
_RE_TIMES_FIRST = re.compile(
    rf"dall?e\s+(?:ore\s+)?{_TIME}\s+(?:fino\s+)?all?e\s+(?:ore\s+)?{_TIME}\s+"
    rf"(?:di|del(?:\s+giorno)?)\s+{_WD}(\d{{1,2}})\s+({_MONTH_RE})(?:\s+(\d{{4}}))?",
    re.IGNORECASE,
)

# Data singola: "12 giugno [2026]"
_RE_SINGLE_DATE = re.compile(
    rf"(\d{{1,2}})\s+({_MONTH_RE})(?:\s+(\d{{4}}))?", re.IGNORECASE
)

# Date numeriche: "12/06/2026 [alle] [ore] 03:00", "13.06.26 ore 02:00"
_RE_NUMERIC = re.compile(
    r"(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})"
    r"(?:\s*,?\s*(?:dalle\s+|alle\s+)?(?:ore\s+)?(\d{1,2})[:.](\d{2}))?",
    re.IGNORECASE,
)

# Data numerica seguita da intervallo orario: "20/06/2026 dalle ore 9:01 alle ore 17:59"
_RE_NUMERIC_RANGE = re.compile(
    r"(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\s*,?\s*"
    rf"dall?e\s+(?:ore\s+)?{_TIME}\s+(?:fino\s+)?all?e\s+(?:ore\s+)?{_TIME}",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class StrikePeriod:
    start: datetime  # timezone-aware Europe/Rome
    end: datetime    # timezone-aware Europe/Rome
    all_day: bool
    method: str      # "regex" | "dateparser"


def is_strike_text(text: str) -> bool:
    lowered = text.lower()
    return any(keyword in lowered for keyword in STRIKE_KEYWORDS)


def _resolve_year(day: int, month: int, year: Optional[str], now: datetime) -> int:
    """Se l'anno non è indicato, sceglie l'anno che rende la data plausibile
    (gli avvisi riguardano scioperi futuri o molto recenti)."""
    if year:
        return int(year)
    candidate = datetime(now.year, month, day, tzinfo=TZ)
    if candidate < now - timedelta(days=60):
        return now.year + 1
    return now.year


def _build_dt(day: str, month_name: str, year: Optional[str],
              hour: str, minute: Optional[str], now: datetime) -> Optional[datetime]:
    month = _MONTHS[month_name.lower()]
    try:
        resolved_year = _resolve_year(int(day), month, year, now)
        return datetime(
            resolved_year, month, int(day), int(hour), int(minute or 0), tzinfo=TZ
        )
    except ValueError:
        return None


def _try_cross_day(text: str, now: datetime) -> Optional[StrikePeriod]:
    match = _RE_CROSS_DAY.search(text)
    if not match:
        return None
    (h1, m1, d1, mo1, y1, h2, m2, d2, mo2, y2) = match.groups()
    start = _build_dt(d1, mo1, y1, h1, m1, now)
    end = _build_dt(d2, mo2, y2, h2, m2, now)
    if start is None or end is None:
        return None
    if end <= start:
        # anni non indicati a cavallo d'anno (es. 31 dicembre -> 1 gennaio)
        end = end.replace(year=end.year + 1)
    return StrikePeriod(start=start, end=end, all_day=False, method="regex")


def _try_same_day(text: str, now: datetime) -> Optional[StrikePeriod]:
    for pattern, order in ((_RE_DAY_FIRST, "day_first"), (_RE_TIMES_FIRST, "times_first")):
        match = pattern.search(text)
        if not match:
            continue
        if order == "day_first":
            day, month_name, year, h1, m1, h2, m2 = match.groups()
        else:
            h1, m1, h2, m2, day, month_name, year = match.groups()
        start = _build_dt(day, month_name, year, h1, m1, now)
        end = _build_dt(day, month_name, year, h2, m2, now)
        if start is None or end is None:
            continue
        if end <= start:  # sciopero a cavallo di mezzanotte
            end += timedelta(days=1)
        return StrikePeriod(start=start, end=end, all_day=False, method="regex")
    return None


def _try_single_date(text: str, now: datetime) -> Optional[StrikePeriod]:
    match = _RE_SINGLE_DATE.search(text)
    if not match:
        return None
    day, month_name, year = match.groups()
    start = _build_dt(day, month_name, year, "0", "0", now)
    if start is None:
        return None
    return StrikePeriod(
        start=start, end=start + timedelta(days=1), all_day=True, method="regex"
    )


def _try_numeric(text: str, now: datetime) -> Optional[StrikePeriod]:
    """Date in formato numerico (12/06/2026 ore 03:00)."""
    match = _RE_NUMERIC_RANGE.search(text)
    if match:
        day, month, year, h1, m1, h2, m2 = match.groups()
        year_int = int(year)
        if year_int < 100:
            year_int += 2000
        try:
            start = datetime(
                year_int, int(month), int(day), int(h1), int(m1 or 0), tzinfo=TZ
            )
            end = datetime(
                year_int, int(month), int(day), int(h2), int(m2 or 0), tzinfo=TZ
            )
            if end <= start:
                end += timedelta(days=1)
            return StrikePeriod(start=start, end=end, all_day=False, method="regex")
        except ValueError:
            pass

    parsed: list[tuple[datetime, bool]] = []  # (datetime, ha_orario)
    for day, month, year, hour, minute in _RE_NUMERIC.findall(text):
        year_int = int(year)
        if year_int < 100:
            year_int += 2000
        try:
            dt = datetime(
                year_int, int(month), int(day),
                int(hour) if hour else 0, int(minute) if minute else 0,
                tzinfo=TZ,
            )
        except ValueError:
            continue
        if now - timedelta(days=30) <= dt <= now + timedelta(days=400):
            parsed.append((dt, bool(hour)))

    if not parsed:
        return None

    if len(parsed) >= 2:
        start, end = parsed[0][0], parsed[1][0]
        if end <= start:
            if start.date() == end.date():
                end += timedelta(days=1)
            else:
                start, end = end, start
        return StrikePeriod(start=start, end=end, all_day=False, method="regex")

    only, has_time = parsed[0]
    if not has_time:
        return StrikePeriod(
            start=only, end=only + timedelta(days=1), all_day=True, method="regex"
        )
    return StrikePeriod(
        start=only, end=only + timedelta(hours=8), all_day=False, method="regex"
    )


def _try_dateparser(text: str, now: datetime) -> Optional[StrikePeriod]:
    """Fallback: ricerca libera di date/orari nel testo con dateparser."""
    try:
        from dateparser.search import search_dates
    except ImportError:
        logger.error("dateparser non installato: fallback non disponibile")
        return None

    try:
        results = search_dates(
            text,
            languages=["it"],
            settings={
                "TIMEZONE": "Europe/Rome",
                "RETURN_AS_TIMEZONE_AWARE": True,
                "PREFER_DATES_FROM": "future",
                "RELATIVE_BASE": now.replace(tzinfo=None),
            },
        )
    except Exception:
        logger.exception("Errore durante la ricerca date con dateparser")
        return None

    if not results:
        return None

    # Scarta risultati implausibili (frammenti numerici interpretati come date)
    plausible = [
        dt for _, dt in results
        if now - timedelta(days=30) <= dt <= now + timedelta(days=400)
    ]
    if not plausible:
        return None

    if len(plausible) >= 2:
        start, end = plausible[0], plausible[1]
        if end <= start:
            start, end = min(plausible[:2]), max(plausible[:2])
        if end <= start:
            end = start + timedelta(hours=1)
        return StrikePeriod(
            start=start.astimezone(TZ),
            end=end.astimezone(TZ),
            all_day=False,
            method="dateparser",
        )

    only = plausible[0].astimezone(TZ)
    if only.hour == 0 and only.minute == 0:
        # nessun orario nel testo: evento "tutto il giorno"
        return StrikePeriod(
            start=only, end=only + timedelta(days=1), all_day=True,
            method="dateparser",
        )
    return StrikePeriod(
        start=only, end=only + timedelta(hours=8), all_day=False,
        method="dateparser",
    )


def extract_strike_period(text: str, now: Optional[datetime] = None) -> Optional[StrikePeriod]:
    """Estrae il periodo dello sciopero dal testo dell'avviso.

    Restituisce None se non viene trovata nessuna data utilizzabile.
    """
    now = now or datetime.now(TZ)

    for extractor in (_try_cross_day, _try_same_day, _try_numeric):
        period = extractor(text, now)
        if period:
            logger.info(
                "Periodo sciopero estratto (%s): %s -> %s",
                period.method, period.start, period.end,
            )
            return period

    period = _try_dateparser(text, now)
    if period:
        logger.info(
            "Periodo sciopero estratto con fallback dateparser: %s -> %s",
            period.start, period.end,
        )
        return period

    period = _try_single_date(text, now)
    if period:
        logger.info(
            "Trovata solo una data, creo evento tutto il giorno: %s", period.start
        )
        return period

    logger.warning("Nessuna data trovata nel testo dell'avviso")
    return None


def summarize(text: str, max_length: int = 600) -> str:
    """Sintesi del contenuto dell'avviso per la descrizione dell'evento."""
    text = " ".join(text.split())
    if len(text) <= max_length:
        return text
    cut = text[:max_length]
    last_space = cut.rfind(" ")
    if last_space > 0:
        cut = cut[:last_space]
    return cut + "…"

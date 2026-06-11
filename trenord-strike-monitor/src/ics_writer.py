"""Generazione di file .ics (RFC 5545) per gli scioperi rilevati."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from pathlib import Path

from .strike_parser import StrikePeriod

logger = logging.getLogger(__name__)

PRODID = "-//trenord-strike-monitor//IT"


def event_uid(url: str) -> str:
    """UID deterministico derivato dall'URL dell'avviso (usato anche come
    ID evento Google Calendar: sha1 esadecimale = alfabeto base32hex valido)."""
    return hashlib.sha1(url.encode("utf-8")).hexdigest()


def _escape(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
    )


def _fold(line: str) -> str:
    """Piegatura delle righe a 75 ottetti come richiesto da RFC 5545."""
    encoded = line.encode("utf-8")
    if len(encoded) <= 75:
        return line
    parts = []
    current = b""
    for char in line:
        char_bytes = char.encode("utf-8")
        limit = 75 if not parts else 74  # le continuazioni iniziano con uno spazio
        if len(current) + len(char_bytes) > limit:
            parts.append(current.decode("utf-8"))
            current = char_bytes
        else:
            current += char_bytes
    if current:
        parts.append(current.decode("utf-8"))
    return parts[0] + "".join("\r\n " + part for part in parts[1:])


def _fmt_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def build_ics(
    period: StrikePeriod,
    title: str,
    description: str,
    url: str,
    summary: str = "Sciopero Trenord",
) -> str:
    uid = event_uid(url)
    dtstamp = _fmt_utc(datetime.now(timezone.utc))
    full_description = f"{title}\n\n{description}\n\nAvviso originale: {url}"

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{PRODID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{uid}@trenord-strike-monitor",
        f"DTSTAMP:{dtstamp}",
    ]
    if period.all_day:
        lines.append(f"DTSTART;VALUE=DATE:{period.start.strftime('%Y%m%d')}")
        lines.append(f"DTEND;VALUE=DATE:{period.end.strftime('%Y%m%d')}")
    else:
        lines.append(f"DTSTART:{_fmt_utc(period.start)}")
        lines.append(f"DTEND:{_fmt_utc(period.end)}")
    lines.extend(
        [
            f"SUMMARY:{_escape(summary)}",
            f"DESCRIPTION:{_escape(full_description)}",
            f"URL:{_escape(url)}",
            "STATUS:CONFIRMED",
            "TRANSP:OPAQUE",
            "END:VEVENT",
            "END:VCALENDAR",
        ]
    )
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"


def write_ics(
    ics_dir: Path,
    period: StrikePeriod,
    title: str,
    description: str,
    url: str,
) -> Path:
    ics_dir.mkdir(parents=True, exist_ok=True)
    path = ics_dir / f"sciopero_{period.start:%Y%m%d}_{event_uid(url)[:10]}.ics"
    path.write_text(
        build_ics(period, title, description, url), encoding="utf-8"
    )
    logger.info("File ICS scritto: %s", path)
    return path

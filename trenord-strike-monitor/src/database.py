"""Storico locale degli avvisi su SQLite (deduplica e stato di elaborazione)."""

from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS avvisi (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    url               TEXT NOT NULL UNIQUE,
    title             TEXT NOT NULL,
    content_hash      TEXT,
    is_strike         INTEGER NOT NULL DEFAULT 0,
    strike_start      TEXT,
    strike_end        TEXT,
    all_day           INTEGER NOT NULL DEFAULT 0,
    ics_path          TEXT,
    gcal_event_id     TEXT,
    telegram_notified INTEGER NOT NULL DEFAULT 0,
    first_seen        TEXT NOT NULL,
    processed_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_avvisi_pending
    ON avvisi (is_strike, processed_at);

CREATE TABLE IF NOT EXISTS runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at   TEXT NOT NULL,
    finished_at  TEXT,
    status       TEXT,
    new_count    INTEGER DEFAULT 0,
    strike_count INTEGER DEFAULT 0,
    error        TEXT
);
"""


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Database:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(path))
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(_SCHEMA)
        self._conn.commit()
        logger.debug("Database inizializzato: %s", path)

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> "Database":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    # ------------------------------------------------------------------ avvisi

    def is_known(self, url: str) -> bool:
        row = self._conn.execute(
            "SELECT 1 FROM avvisi WHERE url = ?", (url,)
        ).fetchone()
        return row is not None

    def insert_avviso(self, url: str, title: str) -> int:
        cur = self._conn.execute(
            "INSERT OR IGNORE INTO avvisi (url, title, first_seen) VALUES (?, ?, ?)",
            (url, title, _utcnow()),
        )
        self._conn.commit()
        return cur.lastrowid or 0

    def get_avviso(self, url: str) -> Optional[sqlite3.Row]:
        return self._conn.execute(
            "SELECT * FROM avvisi WHERE url = ?", (url,)
        ).fetchone()

    def set_strike_info(
        self,
        url: str,
        is_strike: bool,
        content_hash: str,
        strike_start: Optional[str] = None,
        strike_end: Optional[str] = None,
        all_day: bool = False,
    ) -> None:
        self._conn.execute(
            """UPDATE avvisi
               SET is_strike = ?, content_hash = ?,
                   strike_start = ?, strike_end = ?, all_day = ?
               WHERE url = ?""",
            (int(is_strike), content_hash, strike_start, strike_end, int(all_day), url),
        )
        self._conn.commit()

    def set_ics_path(self, url: str, ics_path: str) -> None:
        self._conn.execute(
            "UPDATE avvisi SET ics_path = ? WHERE url = ?", (ics_path, url)
        )
        self._conn.commit()

    def set_gcal_event_id(self, url: str, event_id: str) -> None:
        self._conn.execute(
            "UPDATE avvisi SET gcal_event_id = ? WHERE url = ?", (event_id, url)
        )
        self._conn.commit()

    def set_telegram_notified(self, url: str) -> None:
        self._conn.execute(
            "UPDATE avvisi SET telegram_notified = 1 WHERE url = ?", (url,)
        )
        self._conn.commit()

    def mark_processed(self, url: str) -> None:
        self._conn.execute(
            "UPDATE avvisi SET processed_at = ? WHERE url = ?", (_utcnow(), url)
        )
        self._conn.commit()

    def get_pending(self) -> list[sqlite3.Row]:
        """Avvisi visti ma non ancora elaborati con successo (da ritentare)."""
        return self._conn.execute(
            "SELECT * FROM avvisi WHERE processed_at IS NULL ORDER BY id"
        ).fetchall()

    # -------------------------------------------------------------------- runs

    def start_run(self) -> int:
        cur = self._conn.execute(
            "INSERT INTO runs (started_at) VALUES (?)", (_utcnow(),)
        )
        self._conn.commit()
        return cur.lastrowid

    def finish_run(
        self,
        run_id: int,
        status: str,
        new_count: int = 0,
        strike_count: int = 0,
        error: Optional[str] = None,
    ) -> None:
        self._conn.execute(
            """UPDATE runs
               SET finished_at = ?, status = ?, new_count = ?,
                   strike_count = ?, error = ?
               WHERE id = ?""",
            (_utcnow(), status, new_count, strike_count, error, run_id),
        )
        self._conn.commit()

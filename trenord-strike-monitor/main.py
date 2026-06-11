#!/usr/bin/env python3
"""Trenord Strike Monitor - entrypoint.

Esecuzione continua (scheduler ogni 6 ore):
    python main.py

Esecuzione singola (per cron / GitHub Actions):
    python main.py --once
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime

from src.config import settings
from src.logging_setup import setup_logging
from src.monitor import run_check
from src.strike_parser import TZ


def main() -> int:
    parser = argparse.ArgumentParser(description="Monitor avvisi sciopero Trenord")
    parser.add_argument(
        "--once",
        action="store_true",
        help="esegue un solo controllo ed esce (per cron/GitHub Actions)",
    )
    args = parser.parse_args()

    setup_logging()
    logger = logging.getLogger("main")
    logger.info(
        "Trenord Strike Monitor avviato (calendario: %s, intervallo: %dh)",
        settings.google_calendar_id,
        settings.check_interval_hours,
    )

    if args.once:
        run_check()
        return 0

    from apscheduler.schedulers.blocking import BlockingScheduler

    scheduler = BlockingScheduler(timezone="Europe/Rome")
    scheduler.add_job(
        run_check,
        trigger="interval",
        hours=settings.check_interval_hours,
        next_run_time=datetime.now(TZ),  # primo controllo immediato
        coalesce=True,
        max_instances=1,
        misfire_grace_time=3600,
        id="trenord_check",
    )
    logger.info("Scheduler attivo: controllo ogni %d ore", settings.check_interval_hours)
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Arresto richiesto, esco.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

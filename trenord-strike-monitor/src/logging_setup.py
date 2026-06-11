"""Configurazione del logging: console + file rotante."""

from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler

from .config import settings

_FORMAT = "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s"


def setup_logging() -> None:
    settings.log_dir.mkdir(parents=True, exist_ok=True)

    root = logging.getLogger()
    if root.handlers:  # già configurato (es. esecuzioni ripetute nei test)
        return
    root.setLevel(settings.log_level)

    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter(_FORMAT))
    root.addHandler(console)

    file_handler = RotatingFileHandler(
        settings.log_dir / "monitor.log",
        maxBytes=1_000_000,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(logging.Formatter(_FORMAT))
    root.addHandler(file_handler)

    # Riduce il rumore delle librerie di terze parti
    for noisy in ("urllib3", "googleapiclient", "httpx", "apscheduler"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

"""Caricamento configurazione da variabili d'ambiente / file .env."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def _resolve(path_str: str) -> Path:
    """Risolve un percorso relativo rispetto alla cartella del progetto."""
    path = Path(path_str)
    return path if path.is_absolute() else BASE_DIR / path


@dataclass(frozen=True)
class Settings:
    avvisi_url: str
    check_interval_hours: int
    request_timeout: int
    user_agent: str

    db_path: Path
    ics_dir: Path
    log_dir: Path
    log_level: str

    google_calendar_id: str
    google_auth_method: str
    google_service_account_file: Path
    google_oauth_client_secrets: Path
    google_oauth_token_file: Path

    telegram_bot_token: str
    telegram_chat_id: str

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            avvisi_url=os.getenv(
                "AVVISI_URL", "https://www.trenord.it/news/trenord-informa/avvisi/"
            ),
            check_interval_hours=int(os.getenv("CHECK_INTERVAL_HOURS", "6")),
            request_timeout=int(os.getenv("REQUEST_TIMEOUT", "30")),
            user_agent=os.getenv(
                "USER_AGENT",
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            ),
            db_path=_resolve(os.getenv("DB_PATH", "data/avvisi.sqlite3")),
            ics_dir=_resolve(os.getenv("ICS_DIR", "data/ics")),
            log_dir=_resolve(os.getenv("LOG_DIR", "logs")),
            log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
            google_calendar_id=os.getenv("GOOGLE_CALENDAR_ID", "niccolonolli@gmail.com"),
            google_auth_method=os.getenv("GOOGLE_AUTH_METHOD", "service_account").lower(),
            google_service_account_file=_resolve(
                os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "secrets/service_account.json")
            ),
            google_oauth_client_secrets=_resolve(
                os.getenv("GOOGLE_OAUTH_CLIENT_SECRETS", "secrets/oauth_client.json")
            ),
            google_oauth_token_file=_resolve(
                os.getenv("GOOGLE_OAUTH_TOKEN_FILE", "secrets/oauth_token.json")
            ),
            telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", "").strip(),
            telegram_chat_id=os.getenv("TELEGRAM_CHAT_ID", "").strip(),
        )


settings = Settings.from_env()

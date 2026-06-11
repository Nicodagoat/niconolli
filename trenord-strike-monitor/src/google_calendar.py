"""Creazione eventi su Google Calendar tramite Google Calendar API.

Supporta due metodi di autenticazione:
- service_account: chiave JSON di un service account; il calendario di
  destinazione deve essere condiviso con l'email del service account
  (permesso "Apportare modifiche agli eventi"). Adatto a server e CI.
- oauth: credenziali utente generate con scripts/google_oauth_setup.py.
  Adatto all'esecuzione locale sul proprio account.

La deduplica lato calendario usa un ID evento deterministico derivato
dall'URL dell'avviso: se l'evento esiste già l'API risponde 409 e
l'inserimento viene considerato riuscito.
"""

from __future__ import annotations

import logging
from typing import Optional

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from .config import settings
from .ics_writer import event_uid
from .strike_parser import StrikePeriod

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]


class CalendarNotConfigured(Exception):
    """Credenziali Google assenti: la creazione eventi è disabilitata."""


class CalendarError(Exception):
    """Errore temporaneo o di permessi nella chiamata API."""


def _load_credentials():
    if settings.google_auth_method == "service_account":
        if not settings.google_service_account_file.exists():
            raise CalendarNotConfigured(
                f"File service account non trovato: "
                f"{settings.google_service_account_file}"
            )
        from google.oauth2 import service_account

        return service_account.Credentials.from_service_account_file(
            str(settings.google_service_account_file), scopes=SCOPES
        )

    if settings.google_auth_method == "oauth":
        if not settings.google_oauth_token_file.exists():
            raise CalendarNotConfigured(
                f"Token OAuth non trovato: {settings.google_oauth_token_file}. "
                "Eseguire prima: python scripts/google_oauth_setup.py"
            )
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials

        creds = Credentials.from_authorized_user_file(
            str(settings.google_oauth_token_file), SCOPES
        )
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            settings.google_oauth_token_file.write_text(creds.to_json())
        return creds

    raise CalendarNotConfigured(
        f"GOOGLE_AUTH_METHOD non valido: {settings.google_auth_method!r} "
        "(valori ammessi: service_account, oauth)"
    )


def _build_service():
    credentials = _load_credentials()
    return build("calendar", "v3", credentials=credentials, cache_discovery=False)


def create_strike_event(
    period: StrikePeriod,
    title: str,
    description: str,
    url: str,
) -> Optional[str]:
    """Crea l'evento "Sciopero Trenord" sul calendario configurato.

    Restituisce l'ID evento. Se l'evento esiste già (stesso avviso),
    restituisce l'ID esistente senza crearne uno nuovo.
    """
    service = _build_service()
    event_id = event_uid(url)

    body = {
        "id": event_id,
        "summary": "Sciopero Trenord",
        "description": f"{title}\n\n{description}\n\nAvviso originale: {url}",
        "source": {"title": "Avviso Trenord", "url": url},
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "popup", "minutes": 24 * 60},
                {"method": "popup", "minutes": 60},
            ],
        },
    }
    if period.all_day:
        body["start"] = {"date": period.start.strftime("%Y-%m-%d")}
        body["end"] = {"date": period.end.strftime("%Y-%m-%d")}
    else:
        body["start"] = {
            "dateTime": period.start.isoformat(),
            "timeZone": "Europe/Rome",
        }
        body["end"] = {
            "dateTime": period.end.isoformat(),
            "timeZone": "Europe/Rome",
        }

    try:
        created = (
            service.events()
            .insert(calendarId=settings.google_calendar_id, body=body)
            .execute()
        )
        logger.info(
            "Evento Google Calendar creato: %s (%s)",
            created.get("id"),
            created.get("htmlLink", ""),
        )
        return created.get("id", event_id)
    except HttpError as exc:
        if exc.resp.status == 409:
            logger.info(
                "Evento già presente su Google Calendar (id=%s), nessun duplicato",
                event_id,
            )
            return event_id
        raise CalendarError(
            f"Errore Google Calendar API ({exc.resp.status}): {exc}"
        ) from exc

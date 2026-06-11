"""Orchestrazione di un ciclo di controllo: scraping, diff con lo storico,
analisi scioperi, generazione ICS, Google Calendar, Telegram."""

from __future__ import annotations

import hashlib
import logging

from .config import settings
from .database import Database
from .google_calendar import CalendarError, CalendarNotConfigured, create_strike_event
from .ics_writer import write_ics
from .scraper import NoticeRef, ScrapeError, fetch_detail_text, fetch_listing
from .strike_parser import extract_strike_period, is_strike_text, summarize
from .telegram_notifier import notify_strike

logger = logging.getLogger(__name__)


def _process_notice(db: Database, notice: NoticeRef) -> bool:
    """Elabora un singolo avviso. Restituisce True se è uno sciopero.

    L'avviso viene marcato come elaborato solo se tutti i passi riusciti o
    definitivamente non applicabili sono completati: in caso di errore
    temporaneo (rete, API) resta "pending" e viene ritentato al giro dopo.
    """
    logger.info("Elaboro avviso: %s (%s)", notice.title, notice.url)

    try:
        detail_text = fetch_detail_text(notice.url)
    except ScrapeError:
        logger.exception(
            "Dettaglio non scaricabile, riproverò al prossimo ciclo: %s", notice.url
        )
        return False

    full_text = f"{notice.title} {detail_text}"
    content_hash = hashlib.sha256(detail_text.encode("utf-8")).hexdigest()

    if not is_strike_text(full_text):
        logger.info("Avviso non relativo a scioperi: %s", notice.title)
        db.set_strike_info(notice.url, is_strike=False, content_hash=content_hash)
        db.mark_processed(notice.url)
        return False

    logger.info("AVVISO DI SCIOPERO rilevato: %s", notice.title)

    period = extract_strike_period(detail_text) or extract_strike_period(full_text)
    description = summarize(detail_text)

    db.set_strike_info(
        notice.url,
        is_strike=True,
        content_hash=content_hash,
        strike_start=period.start.isoformat() if period else None,
        strike_end=period.end.isoformat() if period else None,
        all_day=period.all_day if period else False,
    )

    calendar_ok = False
    if period is None:
        logger.warning(
            "Date dello sciopero non estraibili da %s: nessun evento creato, "
            "verrà inviata solo la notifica",
            notice.url,
        )
    else:
        # 1. file .ics locale
        row = db.get_avviso(notice.url)
        if not (row and row["ics_path"]):
            ics_path = write_ics(
                settings.ics_dir, period, notice.title, description, notice.url
            )
            db.set_ics_path(notice.url, str(ics_path))

        # 2. evento Google Calendar
        row = db.get_avviso(notice.url)
        if row and row["gcal_event_id"]:
            calendar_ok = True
        else:
            try:
                event_id = create_strike_event(
                    period, notice.title, description, notice.url
                )
                if event_id:
                    db.set_gcal_event_id(notice.url, event_id)
                    calendar_ok = True
            except CalendarNotConfigured as exc:
                logger.warning("Google Calendar non configurato: %s", exc)
            except CalendarError:
                logger.exception(
                    "Errore Google Calendar, riproverò al prossimo ciclo"
                )
                return True  # resta pending, niente mark_processed

    # 3. notifica Telegram (best effort, non blocca l'elaborazione)
    row = db.get_avviso(notice.url)
    if row and not row["telegram_notified"]:
        if notify_strike(notice.title, notice.url, period, calendar_ok):
            db.set_telegram_notified(notice.url)

    db.mark_processed(notice.url)
    return True


def run_check() -> None:
    """Un ciclo completo di controllo (chiamato dallo scheduler o con --once)."""
    logger.info("=== Avvio controllo avvisi Trenord ===")
    with Database(settings.db_path) as db:
        run_id = db.start_run()
        new_count = 0
        strike_count = 0
        try:
            notices = fetch_listing()

            new_notices = [n for n in notices if not db.is_known(n.url)]
            logger.info(
                "Avvisi in pagina: %d, nuovi: %d", len(notices), len(new_notices)
            )
            for notice in new_notices:
                db.insert_avviso(notice.url, notice.title)
            new_count = len(new_notices)

            # Elabora i nuovi avvisi e ritenta quelli rimasti in sospeso
            # (errori di rete/API nei cicli precedenti).
            pending = db.get_pending()
            for row in pending:
                notice = NoticeRef(title=row["title"], url=row["url"])
                try:
                    if _process_notice(db, notice):
                        strike_count += 1
                except Exception:
                    logger.exception(
                        "Errore imprevisto nell'elaborazione di %s", notice.url
                    )

            db.finish_run(run_id, "ok", new_count, strike_count)
            logger.info(
                "=== Controllo completato: %d nuovi avvisi, %d scioperi ===",
                new_count,
                strike_count,
            )
        except ScrapeError as exc:
            logger.error("Controllo fallito: %s", exc)
            db.finish_run(run_id, "error", new_count, strike_count, str(exc))
        except Exception as exc:
            logger.exception("Errore imprevisto nel ciclo di controllo")
            db.finish_run(run_id, "error", new_count, strike_count, repr(exc))

"""Notifiche Telegram (opzionali) quando viene rilevato uno sciopero."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from .config import settings
from .strike_parser import StrikePeriod

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    return bool(settings.telegram_bot_token and settings.telegram_chat_id)


async def _send(text: str) -> None:
    from telegram import Bot
    from telegram.constants import ParseMode

    bot = Bot(token=settings.telegram_bot_token)
    async with bot:
        await bot.send_message(
            chat_id=settings.telegram_chat_id,
            text=text,
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )


def notify_strike(
    title: str,
    url: str,
    period: Optional[StrikePeriod],
    calendar_ok: bool,
) -> bool:
    """Invia la notifica; restituisce True se inviata con successo."""
    if not is_configured():
        logger.debug("Telegram non configurato, notifica saltata")
        return False

    if period is None:
        when = "⚠️ date non riconosciute automaticamente, controlla l'avviso"
    elif period.all_day:
        when = f"📅 {period.start:%d/%m/%Y} (tutto il giorno)"
    else:
        when = f"📅 dal {period.start:%d/%m/%Y %H:%M} al {period.end:%d/%m/%Y %H:%M}"

    calendar_line = (
        "✅ Evento aggiunto a Google Calendar"
        if calendar_ok
        else "❌ Evento NON aggiunto a Google Calendar"
    )

    text = (
        "🚆 <b>Sciopero Trenord rilevato</b>\n\n"
        f"<b>{title}</b>\n"
        f"{when}\n"
        f"{calendar_line}\n\n"
        f'<a href="{url}">Avviso originale</a>'
    )

    try:
        asyncio.run(_send(text))
        logger.info("Notifica Telegram inviata per: %s", title)
        return True
    except Exception:
        logger.exception("Invio notifica Telegram fallito")
        return False

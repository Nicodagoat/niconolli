"""Scraping della pagina avvisi Trenord e delle pagine di dettaglio.

Il sito è servito da Akamai e il markup può cambiare: il parser usa più
strategie in cascata (link diretti, JSON __NEXT_DATA__, JSON-LD) e solleva
ScrapeError quando nessuna strategia produce risultati, così il problema
viene loggato invece di passare inosservato.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .config import settings

logger = logging.getLogger(__name__)

LISTING_PATH = "/news/trenord-informa/avvisi"


class ScrapeError(Exception):
    """Errore di rete o struttura HTML non riconosciuta."""


@dataclass(frozen=True)
class NoticeRef:
    """Riferimento a un avviso trovato nella pagina elenco."""

    title: str
    url: str


def _build_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=4,
        backoff_factor=2,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update(
        {
            "User-Agent": settings.user_agent,
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;q=0.9,"
                "image/avif,image/webp,*/*;q=0.8"
            ),
            "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
            "Cache-Control": "no-cache",
        }
    )
    return session


_session = _build_session()


def _get(url: str) -> str:
    try:
        response = _session.get(url, timeout=settings.request_timeout)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise ScrapeError(f"Richiesta fallita per {url}: {exc}") from exc
    return response.text


def _make_soup(html: str) -> BeautifulSoup:
    try:
        return BeautifulSoup(html, "lxml")
    except Exception:  # lxml non disponibile
        return BeautifulSoup(html, "html.parser")


def _clean(text: str) -> str:
    return " ".join(text.split())


def _normalize_url(href: str, base_url: str) -> str:
    url = urljoin(base_url, href)
    parts = urlsplit(url)
    path = parts.path.rstrip("/")
    return f"{parts.scheme}://{parts.netloc}{path}"


def _is_detail_path(path: str) -> bool:
    path = path.rstrip("/")
    return path.startswith(LISTING_PATH) and path != LISTING_PATH


# --------------------------------------------------------------- strategie

def _strategy_anchors(soup: BeautifulSoup, base_url: str) -> list[NoticeRef]:
    """Strategia 1: link <a> che puntano alle pagine di dettaglio avviso."""
    found: dict[str, str] = {}
    for anchor in soup.find_all("a", href=True):
        url = _normalize_url(anchor["href"], base_url)
        if not _is_detail_path(urlsplit(url).path):
            continue
        title = _clean(anchor.get_text())
        if not title:
            heading = anchor.find(["h1", "h2", "h3", "h4"])
            if heading is None and anchor.parent is not None:
                heading = anchor.parent.find(["h1", "h2", "h3", "h4"])
            title = _clean(heading.get_text()) if heading else ""
        if not title:
            title = urlsplit(url).path.rsplit("/", 1)[-1].replace("-", " ")
        if url not in found or len(title) > len(found[url]):
            found[url] = title
    return [NoticeRef(title=t, url=u) for u, t in found.items()]


def _walk_json(node, results: list[tuple[str, str]]) -> None:
    if isinstance(node, dict):
        title = node.get("title") or node.get("titolo") or node.get("name")
        slug = (
            node.get("slug")
            or node.get("url")
            or node.get("link")
            or node.get("path")
        )
        if isinstance(title, str) and isinstance(slug, str) and title.strip():
            results.append((title.strip(), slug.strip()))
        for value in node.values():
            _walk_json(value, results)
    elif isinstance(node, list):
        for value in node:
            _walk_json(value, results)


def _strategy_next_data(soup: BeautifulSoup, base_url: str) -> list[NoticeRef]:
    """Strategia 2: dati embedded nel JSON __NEXT_DATA__ (siti Next.js)."""
    script = soup.find("script", id="__NEXT_DATA__")
    if script is None or not script.string:
        return []
    try:
        data = json.loads(script.string)
    except json.JSONDecodeError:
        logger.warning("__NEXT_DATA__ presente ma non è JSON valido")
        return []

    raw: list[tuple[str, str]] = []
    _walk_json(data, raw)

    found: dict[str, str] = {}
    for title, slug in raw:
        if slug.startswith(("http://", "https://", "/")):
            candidate = slug
        else:
            candidate = f"{LISTING_PATH}/{slug}"
        url = _normalize_url(candidate, base_url)
        if _is_detail_path(urlsplit(url).path):
            found.setdefault(url, _clean(title))
    return [NoticeRef(title=t, url=u) for u, t in found.items()]


def _strategy_jsonld(soup: BeautifulSoup, base_url: str) -> list[NoticeRef]:
    """Strategia 3: blocchi JSON-LD (schema.org NewsArticle / ItemList)."""
    found: dict[str, str] = {}
    for script in soup.find_all("script", type="application/ld+json"):
        if not script.string:
            continue
        try:
            data = json.loads(script.string)
        except json.JSONDecodeError:
            continue
        raw: list[tuple[str, str]] = []
        _walk_json(data, raw)
        for title, slug in raw:
            if not slug.startswith(("http://", "https://", "/")):
                continue
            url = _normalize_url(slug, base_url)
            if _is_detail_path(urlsplit(url).path):
                found.setdefault(url, _clean(title))
    return [NoticeRef(title=t, url=u) for u, t in found.items()]


# ------------------------------------------------------------------ API

def fetch_listing() -> list[NoticeRef]:
    """Scarica la pagina elenco e restituisce gli avvisi trovati."""
    html = _get(settings.avvisi_url)
    soup = _make_soup(html)

    for strategy in (_strategy_anchors, _strategy_next_data, _strategy_jsonld):
        notices = strategy(soup, settings.avvisi_url)
        if notices:
            logger.info(
                "Trovati %d avvisi con la strategia %s",
                len(notices),
                strategy.__name__,
            )
            return notices

    raise ScrapeError(
        "Nessun avviso trovato: la struttura HTML della pagina è probabilmente "
        "cambiata. Aggiornare i selettori in src/scraper.py."
    )


def fetch_detail_text(url: str) -> str:
    """Scarica la pagina di dettaglio e ne estrae il testo dell'articolo."""
    html = _get(url)
    soup = _make_soup(html)

    for tag in soup(["script", "style", "nav", "header", "footer", "noscript"]):
        tag.decompose()

    candidates = []
    for selector in ("article", "main", "[class*=detail]", "[class*=content]", "[class*=news]"):
        candidates.extend(soup.select(selector))
    if not candidates and soup.body is not None:
        candidates = [soup.body]

    if not candidates:
        raise ScrapeError(f"Impossibile estrarre il contenuto da {url}")

    best = max(candidates, key=lambda el: len(el.get_text(strip=True)))
    text = _clean(best.get_text(separator=" "))
    if not text:
        raise ScrapeError(f"Pagina di dettaglio vuota: {url}")
    return text

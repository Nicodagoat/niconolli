"""Scraping della pagina avvisi Trenord e delle pagine di dettaglio.

Backend: Playwright (headless Chromium) — supera il bot-protection Akamai
meglio di requests puro. requests viene usato solo come ultima spiaggia.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

from .config import settings

logger = logging.getLogger(__name__)

LISTING_PATH = "/news/trenord-informa/avvisi"


class ScrapeError(Exception):
    """Errore di rete o struttura HTML non riconosciuta."""


@dataclass(frozen=True)
class NoticeRef:
    title: str
    url: str


# ------------------------------------------------------------------ HTTP raw

def _get_raw(url: str) -> str:
    """Scarica via Playwright; fallback su requests se Playwright non disponibile."""
    try:
        return _get_playwright(url)
    except ImportError:
        logger.warning("Playwright non installato, uso requests (potrebbe fallire con Akamai)")
        return _get_requests(url)
    except Exception as exc:
        logger.warning("Playwright fallito (%s), provo con requests", exc)
        return _get_requests(url)


def _get_playwright(url: str) -> str:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--ignore-certificate-errors",
            ],
        )
        context = browser.new_context(
            user_agent=settings.user_agent,
            locale="it-IT",
            viewport={"width": 1280, "height": 800},
            ignore_https_errors=True,
        )
        # evita il rilevamento headless
        context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        page = context.new_page()
        page.goto(url, timeout=45_000, wait_until="domcontentloaded")
        time.sleep(3)
        html = page.content()
        browser.close()

    if len(html) < 500 or "Access Denied" in html:
        raise ScrapeError(
            f"Accesso negato da Akamai/WAF per {url}. "
            "Il sito blocca gli IP datacenter: eseguire il servizio da rete residenziale."
        )
    return html


def _get_requests(url: str) -> str:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry

    s = requests.Session()
    retry = Retry(total=4, backoff_factor=2, status_forcelist=(429, 500, 502, 503, 504))
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.headers.update({
        "User-Agent": settings.user_agent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
    })
    try:
        r = s.get(url, timeout=settings.request_timeout)
        r.raise_for_status()
    except requests.RequestException as exc:
        raise ScrapeError(f"Richiesta fallita per {url}: {exc}") from exc
    return r.text


# ------------------------------------------------------------------ parsing

def _make_soup(html: str):
    from bs4 import BeautifulSoup
    try:
        return BeautifulSoup(html, "lxml")
    except Exception:
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


def _strategy_anchors(soup, base_url: str) -> list[NoticeRef]:
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


def _walk_json(node, results):
    if isinstance(node, dict):
        title = node.get("title") or node.get("titolo") or node.get("name")
        slug = node.get("slug") or node.get("url") or node.get("link") or node.get("path")
        if isinstance(title, str) and isinstance(slug, str) and title.strip():
            results.append((title.strip(), slug.strip()))
        for value in node.values():
            _walk_json(value, results)
    elif isinstance(node, list):
        for value in node:
            _walk_json(value, results)


def _strategy_next_data(soup, base_url: str) -> list[NoticeRef]:
    script = soup.find("script", id="__NEXT_DATA__")
    if script is None or not script.string:
        return []
    try:
        data = json.loads(script.string)
    except json.JSONDecodeError:
        return []
    raw = []
    _walk_json(data, raw)
    found: dict[str, str] = {}
    for title, slug in raw:
        candidate = slug if slug.startswith(("http://", "https://", "/")) else f"{LISTING_PATH}/{slug}"
        url = _normalize_url(candidate, base_url)
        if _is_detail_path(urlsplit(url).path):
            found.setdefault(url, _clean(title))
    return [NoticeRef(title=t, url=u) for u, t in found.items()]


def _strategy_jsonld(soup, base_url: str) -> list[NoticeRef]:
    found: dict[str, str] = {}
    for script in soup.find_all("script", type="application/ld+json"):
        if not script.string:
            continue
        try:
            data = json.loads(script.string)
        except json.JSONDecodeError:
            continue
        raw = []
        _walk_json(data, raw)
        for title, slug in raw:
            if not slug.startswith(("http://", "https://", "/")):
                continue
            url = _normalize_url(slug, base_url)
            if _is_detail_path(urlsplit(url).path):
                found.setdefault(url, _clean(title))
    return [NoticeRef(title=t, url=u) for u, t in found.items()]


# ------------------------------------------------------------------ public API

def fetch_listing() -> list[NoticeRef]:
    html = _get_raw(settings.avvisi_url)
    soup = _make_soup(html)
    for strategy in (_strategy_anchors, _strategy_next_data, _strategy_jsonld):
        notices = strategy(soup, settings.avvisi_url)
        if notices:
            logger.info("Trovati %d avvisi con la strategia %s", len(notices), strategy.__name__)
            return notices
    raise ScrapeError(
        "Nessun avviso trovato: struttura HTML cambiata. "
        "Aggiornare i selettori in src/scraper.py."
    )


def fetch_detail_text(url: str) -> str:
    html = _get_raw(url)
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
    text = " ".join(best.get_text(separator=" ").split())
    if not text:
        raise ScrapeError(f"Pagina di dettaglio vuota: {url}")
    return text

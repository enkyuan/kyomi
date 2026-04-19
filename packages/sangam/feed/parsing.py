"""
Feed parsing module.
Strictly handles CPU-bound parsing and data extraction.
Zero DB dependencies.
"""

import html
import re
import json
import logging
from datetime import datetime, timezone
from time import mktime
from typing import Any, cast, List, Optional, TypedDict
from urllib.parse import urljoin, urlparse

import feedparser
import langcodes
import nh3
from bs4 import BeautifulSoup, Tag, XMLParsedAsHTMLWarning
from dateutil import parser as date_parser
from markdownify import markdownify as md
import warnings

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

logger = logging.getLogger(__name__)

# ==============================================================================
# CONFIGURATION
# ==============================================================================
# HTML sanitization is handled by feedparser's built-in sanitizer
# We use BeautifulSoup/markdownify for text/markdown conversion


class ArticleCreate(TypedDict, total=False):
    title: str
    link: str
    published_at: Optional[datetime]
    summary: Optional[str]
    content: Optional[str]
    content_html: Optional[str]
    author: Optional[str]
    image_url: Optional[str]
    guid: str
    tags: List[str]


class ParsedFeed(TypedDict, total=False):
    title: str
    parsed_description: str  # Renamed from description
    link: str
    language: str
    image_url: Optional[str]
    last_updated_at: Optional[datetime]
    items: List[ArticleCreate]
    parsed_tags: List[str]  # Renamed from tags
    feed_author: Optional[str]  # Added
    bozo: bool


def tag_visible(element: Any) -> bool:
    if element.parent.name in [
        "style",
        "script",
        "head",
        "title",
        "meta",
        "[document]",
    ]:
        return False
    from bs4 import Comment

    if isinstance(element, Comment):
        return False
    return True


def clean_html_text(body: str) -> str:
    """Return plain text from HTML, stripped and unescaped."""
    if not body:
        return ""
    try:
        soup = BeautifulSoup(body, "html.parser")
        texts = soup.findAll(text=True)
        visible_texts = filter(tag_visible, texts)
        text = " ".join(t.strip() for t in visible_texts).strip()

        # If soup extraction yielded nothing but we had content, fallback to nh3
        # This handles cases where soup might be overly aggressive or structure is weird
        if not text and body.strip():
            return html.unescape(nh3.clean(body, tags=set()))

        return html.unescape(text)
    except Exception as e:
        logger.warning(f"Error cleaning HTML text: {e}")
        return html.unescape(nh3.clean(body, tags=set()))


def convert_to_markdown(html_content: str) -> str:
    """Convert HTML content to Markdown."""
    if not html_content:
        return ""
    try:
        # cleanup first? maybe not, markdownify handles html
        return md(html_content, heading_style="ATX").strip()
    except RecursionError:
        logger.warning("RecursionError converting to markdown, falling back to nh3")
        return html.unescape(nh3.clean(html_content, tags=set()))
    except Exception as e:
        logger.warning(f"Error converting to markdown: {e}")
        return clean_html_text(html_content)  # Fallback to plain text


def extract_domain_from_url(url: str) -> str:
    try:
        return urlparse(url).netloc
    except Exception:
        return ""


def _normalize_language(lang_code: str) -> str:
    try:
        return langcodes.standardize_tag(lang_code)
    except Exception:
        return "en"


def find_feed_icon(feed: Any) -> Optional[str]:
    # Atom Icon
    if hasattr(feed, "icon"):
        return feed.icon
    # Atom Logo
    if hasattr(feed, "logo"):
        return feed.logo
    # RSS Image
    if hasattr(feed, "image") and hasattr(feed.image, "href"):
        return feed.image.href
    return None


def parse_feed_content(content: str, url: str) -> ParsedFeed:
    """
    Parse raw feed content into a structured format.
    Handles RSS/Atom/JSON normalization with comprehensive field extraction.
    """

    # 1. JSON Feed Support
    content = content.strip()
    if content.startswith("{"):
        try:
            # logger.info(f"Attempting JSON parse for {url}")
            return _parse_json_feed(content, url)
        except json.JSONDecodeError as e:
            logger.warning(f"JSON decode failed for {url}: {e}")
            pass  # Continue to XML parsing

    # 2. XML (RSS/Atom) parsing
    # logger.info(f"Attempting XML parse for {url}")
    # Enable feedparser's built-in HTML sanitization
    parsed = feedparser.parse(content, sanitize_html=True)

    logger.info(f"Feedparser entries found: {len(parsed.entries)}")

    if parsed.bozo:
        logger.warning(
            f"Feed parsed with errors url={url} error={parsed.bozo_exception}"
        )

    feed: dict[str, Any] = cast(dict[str, Any], parsed.feed)

    # Basic metadata
    title = html.unescape(clean_html_text(feed.get("title", "")))

    # Prefer subtitle over description for the tagline
    description = html.unescape(
        clean_html_text(feed.get("subtitle") or feed.get("description") or "")
    )

    link = feed.get("link") or url
    language = _normalize_language(feed.get("language", None))

    # Rich UI images
    image_url = find_feed_icon(feed)

    # Feed Author
    feed_author = feed.get("author")
    if not feed_author:
        contributors = feed.get("contributors")
        if contributors and isinstance(contributors, list):
            # Try to get the first contributor's name
            for c in contributors:
                if isinstance(c, dict) and c.get("name"):
                    feed_author = c.get("name")
                    break

    # Last updated timestamp
    last_updated_at = None
    if hasattr(feed, "updated_parsed") and feed.updated_parsed:
        try:
            last_updated_at = datetime.fromtimestamp(
                mktime(feed.updated_parsed), tz=timezone.utc
            )
        except (ValueError, TypeError, OverflowError):
            pass
    elif hasattr(feed, "published_parsed") and feed.published_parsed:
        try:
            last_updated_at = datetime.fromtimestamp(
                mktime(feed.published_parsed), tz=timezone.utc
            )
        except (ValueError, TypeError, OverflowError):
            pass

    # Tags/Categories
    tags = []
    if hasattr(feed, "tags"):
        tags = [t.term for t in feed.tags if hasattr(t, "term") and t.term]
    elif hasattr(feed, "categories"):
        tags = [c for c in feed.categories if isinstance(c, str)]

    articles: list[ArticleCreate] = []

    for entry in parsed.entries:
        try:
            item = _parse_entry(entry)
            if item:
                articles.append(item)
        except Exception as e:
            logger.error(f"Error parsing entry: {e}")
            continue

    return {
        "title": title,
        "parsed_description": description,
        "link": link,
        "language": language,
        "image_url": image_url,
        "last_updated_at": last_updated_at,
        "items": articles,
        "parsed_tags": tags,
        "feed_author": feed_author,
        "bozo": parsed.bozo,
    }


def _parse_entry(entry: Any) -> Optional[ArticleCreate]:
    title = html.unescape(clean_html_text(entry.get("title", "Untitled")))
    link = entry.get("link", "")
    guid = entry.get("id", link)

    if not link:
        return None

    published_at = None
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        published_at = datetime.fromtimestamp(
            mktime(entry.published_parsed), tz=timezone.utc
        )
    elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
        published_at = datetime.fromtimestamp(
            mktime(entry.updated_parsed), tz=timezone.utc
        )

    raw_summary = entry.get("summary", "")
    raw_content = ""
    if hasattr(entry, "content"):
        # entry.content is a list of dicts: [{'type': 'text/html', 'value': '...'}]
        raw_content = "".join([c.value for c in entry.content])

    # Fallback content to summary if empty
    if not raw_content:
        raw_content = raw_summary

    # Clean summary (plain text)
    summary_text = html.unescape(clean_html_text(raw_summary or raw_content))

    # Convert content to Markdown
    content_markdown = convert_to_markdown(raw_content)

    return {
        "title": title,
        "link": link,
        "guid": guid,
        "published_at": published_at,
        "summary": summary_text,
        "content": content_markdown,
        "content_html": raw_content,
        "author": entry.get("author"),
        "tags": [t.term for t in entry.get("tags", []) if hasattr(t, "term")],
    }


def _parse_json_feed(content: str, url: str) -> ParsedFeed:
    data = json.loads(content)

    title = data.get("title", extract_domain_from_url(url))
    description = data.get("description", "")
    link = data.get("home_page_url", url)
    image_url = data.get("icon") or data.get("favicon")
    language = _normalize_language(data.get("language", None))
    feed_author = (
        data.get("author", {}).get("name")
        if isinstance(data.get("author"), dict)
        else None
    )

    items = []
    for item in data.get("items", []):
        pub_date = None
        date_str = item.get("date_published") or item.get("date_modified")
        if date_str:
            try:
                # Naive ISO parser
                if date_str.endswith("Z"):
                    date_str = date_str[:-1] + "+00:00"
                pub_date = datetime.fromisoformat(date_str)
            except Exception:
                pass

        raw_title = item.get("title", "Untitled")
        raw_summary = item.get("summary") or item.get("content_text") or ""
        raw_content_html = item.get("content_html")
        raw_content_text = item.get("content_text")

        # Determine content source for markdown
        if raw_content_html:
            content_markdown = convert_to_markdown(raw_content_html)
            # fallback summary if missing
            if not raw_summary:
                raw_summary = raw_content_html
        else:
            content_markdown = raw_content_text or ""
            if not raw_summary:
                raw_summary = raw_content_text or ""

        items.append(
            {
                "title": html.unescape(clean_html_text(raw_title)),
                "link": item.get("url", ""),
                "guid": item.get("id", item.get("url")),
                "published_at": pub_date,
                "summary": html.unescape(clean_html_text(raw_summary)),
                "content": content_markdown,
                "content_html": raw_content_html or raw_content_text,
                "author": (
                    item.get("author", {}).get("name")
                    if isinstance(item.get("author"), dict)
                    else None
                ),
                "image_url": item.get("image"),
                "tags": item.get("tags", []),
            }
        )

    return {
        "title": title,
        "parsed_description": description,
        "link": link,
        "language": language,
        "image_url": image_url,
        "items": items,
        "parsed_tags": [],  # JSON Feed doesn't usually have feed-level tags in main spec
        "feed_author": feed_author,
        "bozo": False,
    }

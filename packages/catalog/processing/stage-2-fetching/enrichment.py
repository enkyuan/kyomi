import statistics
import time
import sys
import os
from typing import List, Dict, Any, Optional

# Add project root to sys.path to allow imports from feed
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
if project_root not in sys.path:
    sys.path.append(project_root)

from feed.language_detection import detect_language
from feed.favicon import extract_favicon_and_canonical_url
from feed.parsing import clean_html_text


class Enricher:
    def calculate_stats(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculate frequency stats from items.
        """
        if not items:
            return {
                "last_post_date": None,
                "posts_per_week": 0,
                "median_post_interval": 0,
            }

        # Filter items with dates
        dates = [item["published_at"] for item in items if item.get("published_at")]
        dates.sort(reverse=True)

        last_post_date = dates[0] if dates else None

        # Calculate intervals
        intervals = []
        if len(dates) >= 2:
            for i in range(len(dates) - 1):
                diff = dates[i] - dates[i + 1]  # Descending order
                if diff > 0:
                    intervals.append(diff)

        median_interval = 0
        posts_per_week = 0

        if intervals:
            median_interval = statistics.median(intervals)
            if median_interval > 0:
                posts_per_week = (7 * 24 * 3600) / median_interval

        return {
            "last_post_date": last_post_date,
            "posts_per_week": round(posts_per_week, 2),
            "median_post_interval": int(median_interval),
        }

    def detect_feed_language(
        self, feed_title: str, feed_desc: str, items: List[Dict[str, Any]]
    ) -> Optional[str]:
        """
        Detect language using feed.language_detection.
        """
        text_parts = [feed_title or "", feed_desc or ""]
        for item in items[:5]:
            text_parts.append(item.get("title", ""))

            # Use stripped content_html if available, otherwise summary
            content_html = item.get("content_html")
            if content_html:
                text_parts.append(clean_html_text(content_html))
            else:
                text_parts.append(item.get("summary", ""))

        full_text = " ".join(text_parts).strip()
        return detect_language(full_text)

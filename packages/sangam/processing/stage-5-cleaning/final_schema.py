from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field


class Followers(BaseModel):
    facebook: Optional[int] = None
    twitter: Optional[int] = None
    instagram: Optional[int] = None


class FrequencyStats(BaseModel):
    last_post_date: float
    posts_per_week: float
    median_post_interval: int


class Article(BaseModel):
    title: str
    link: str
    published_at: Optional[float]
    summary: str
    content_html: str
    author: Optional[str]
    guid: str
    image_url: Optional[str]
    tags: List[str]


class FinalFeed(BaseModel):
    # IDs and URLs (Http -> Https conversion applied)
    feed_url: str
    website_url: str

    # Core Metadata (From LLM)
    title: str  # Renamed from clean_title
    summary: str  # Renamed from curated_description
    language: str  # Renamed from language_code

    # Enrichment (From LLM)
    category: Literal[
        "news_current_events",
        "society_law_history",
        "regional_local",
        "travel_geography",
        "industry_professions",
        "business_finance",
        "software_engineering",
        "consumer_tech_digital",
        "automotive_transport",
        "science_nature",
        "health_wellness",
        "sports",
        "gaming",
        "entertainment",
        "arts_culture",
        "home_hobbies",
        "food_drink",
        "family_relationships",
        "identity_community",
        "style_shopping",
    ] = Field(..., description="The single most appropriate category for the feed.")

    content_type: Literal[
        "news_outlet",
        "magazine_editorial",
        "indie_blog",
        "corporate_blog",
        "newsletter",
        "aggregator",
        "forum_community",
        "podcast_feed",
        "video_channel",
        "documentation_wiki",
        "status_changelog",
        "marketplace_listings",
        "government_institutional",
        "open_source_activity",
        "education_research",
    ] = Field(..., description="The type of the content publisher.")
    author: Optional[str]
    tags: List[str]  # From tags_en (lowercased)
    tags_native: List[str]  # From tags_native (lowercased)
    popularity_score: int

    # Media & Social (From Original)
    image_url: Optional[str]
    image_type: Optional[str]
    followers: Optional[Followers]

    # Stats (From Original)
    # stats: FrequencyStats

    # Lineage (From Original)
    source_dataset: str
    original_source_file: str

    # Optional: items for the "with articles" dataset
    items: Optional[List[Article]] = None

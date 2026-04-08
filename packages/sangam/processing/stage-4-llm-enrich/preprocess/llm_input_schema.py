from typing import List, Optional, Dict
from pydantic import BaseModel


class Followers(BaseModel):
    facebook: Optional[str]  # e.g., "19.4M"
    twitter: Optional[str]  # e.g., "8.9M"
    instagram: Optional[str]  # e.g., "6.9M"


class Feed(BaseModel):
    title: str
    feed_url: str
    domain: str
    summary: Optional[str]
    language: Optional[str]
    category: Optional[str]
    subcategory: Optional[str]
    tags: List[str]
    author: Optional[str]
    website_url: str
    followers: Optional[Followers]
    parsed_description: str
    parsed_tags: List[str]


class Article(BaseModel):
    title: str
    link: str
    published_at: Optional[str]  # e.g., "2025-12-08 01:05:45"
    summary: str
    author: Optional[str]
    tags: List[str]
    content_markdown: Optional[str]


class Stats(BaseModel):
    posts_per_week: float
    median_post_interval: Optional[str]  # e.g., "21m"


class LLMInputRecord(BaseModel):
    feed: Feed
    items: List[Article]
    stats: Stats

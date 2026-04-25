""" """

from typing import List, Optional, Union
from pydantic import BaseModel


class Followers(BaseModel):
    facebook: int
    twitter: int
    instagram: int


class Feed(BaseModel):
    title: str
    author: Optional[str]

    website_url: str
    feed_url: str
    domain: str

    summary: Optional[str]
    parsed_description: str  # from rss

    image_url: str  # favicons/<domain or md5 hash>
    image_type: str  # mimetype

    language: str  # detected

    popularity_score: Optional[float]
    followers: Followers

    source_dataset: "opml" | "feedspot" | "feeeed"
    original_source_file: str

    category: Optional[str]
    subcategory: str

    tags: List[str]
    parsed_tags: List[str]  # from rss

    content_hash: str


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


class FetchDetails(BaseModel):
    fetch_date: float
    http_status: int
    http_etag: Optional[str]
    http_last_modified: Optional[str]
    content_hash: str
    server_header: Optional[str]
    final_url: str
    permanent_redirect: bool


class FrequencyStats(BaseModel):
    last_post_date: float
    posts_per_week: float
    median_post_interval: int


class Record(BaseModel):
    feed: Feed
    items: List[Article]
    fetch_details: FetchDetails
    stats: FrequencyStats


class Experiment(BaseModel):
    segment: str
    description: str
    why: str
    record: Record


class RootModel(BaseModel):
    experiment_set: List[Experiment]

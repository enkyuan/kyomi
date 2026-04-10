import os
import json
from typing import List, Optional, Type, Dict, Any, Literal
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

# --- Pydantic Models ---


class EnrichmentResult(BaseModel):
    """
    Unified result model for the feed enrichment process.
    """

    feed_url: str = Field(
        ..., description="The original URL of the feed being processed."
    )

    # Part 1: Curator
    language_code: str = Field(
        ...,
        description="The 2-letter ISO code (e.g., 'en', 'zh', 'ja', 'de') based on content.",
    )
    clean_title: str = Field(
        ...,
        description="The Core Brand Name. Clean, short, without emojis, taglines, or separators.",
    )
    author: Optional[str] = Field(
        None,
        description="The individual author's name if applicable. Null for organizational blogs or general news.",
    )
    curated_description: str = Field(
        ...,
        description="A high-signal, editorial logline in the DETECTED LANGUAGE. No 'Welcome to...'.",
    )

    # Part 2: Popularity Score
    popularity_score: int = Field(
        ...,
        description="A score 0-100 indicating popularity/authority. 90-100 for global titans, 20-49 for niche blogs.",
    )

    # Part 3: Taxonomy & Tagging
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

    tags_en: List[str] = Field(
        ...,
        description="5-10 lowercase tags in English. Specific 'leaf node' topics (e.g., 'rust' not 'programming').",
    )
    tags_native: List[str] = Field(
        ...,
        description="5-10 tags in the feed's native language. Empty list [] if the content is in English.",
    )


class EnrichmentResponse(BaseModel):
    results: List[EnrichmentResult]


# --- LLM Processor Class ---


class LLMProcessor:
    def __init__(self, model_name: str = "gemini-2.5-flash-lite"):
        """
        Initialize the LLM Processor with the Google GenAI client.
        Assumes GOOGLE_API_KEY is set in the environment.
        """
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set.")

        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name

    def _load_prompt(self, prompt_path: str) -> str:
        """Reads the markdown prompt file."""
        with open(prompt_path, "r") as f:
            return f.read()

    def process_batch(
        self,
        prompt_path: str,
        records: List[Dict[str, Any]],
        response_model: Type[BaseModel],
    ) -> BaseModel:
        """
        Executes a prompt against a batch of records using structured output.

        Args:
            prompt_path: Path to the markdown prompt file.
            records: List of dictionaries containing feed data.
            response_model: The Pydantic model class for the expected output.

        Returns:
            An instance of response_model containing the results.
        """
        system_instruction = self._load_prompt(prompt_path)

        # Prepare the input payload
        user_content = (
            f"**Input:**\n{json.dumps(records, indent=2, ensure_ascii=False)}"
        )

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[user_content],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=response_model,
                temperature=0.1,
            ),
        )

        # The response.parsed field should contain the Pydantic object
        return response.parsed

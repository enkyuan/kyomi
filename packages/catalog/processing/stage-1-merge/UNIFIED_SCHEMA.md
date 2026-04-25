# Unified Feed Schema

This schema is designed to merge data from `feeeed`, `opml_feeds.json`, and `feedspot`.

## Schema Definition

```typescript
interface UnifiedFeed {
  // Core Identity
  title: string;            // Display title
  feed_url: string;         // The RSS/Atom feed URL (canonical)
  website_url?: string;     // Homepage URL (from Feedspot or inferred)
  domain: string;           // Domain name extracted from feed_url or website_url
  
  // Content Info
  summary?: string;         // Description or summary of the feed
  language: string;         // ISO 639-1 code (default: "en")
  kind: 'feed' | 'youtube' | 'reddit' | 'bluesky' | 'podcast';
  
  // Categorization
  category: Category;       // One of the 20 fixed categories
  subcategory?: string;     // Original category from source (e.g., "Visual Arts", "London")
  
  // Discovery Tags
  tags?: string[];          // High-level tags from feeeed (e.g., "Tech", "AI")
  keywords?: string[];      // Granular keywords from feeeed (e.g., "machine learning", "startups")
  
  // Metadata & Metrics
  popularity_score?: number; // Internal popularity score (from feeeed)
  tranco_rank?: number;      // Tranco rank for the domain (lower is better)
  followers?: {             // Social follower counts (from Feedspot)
    facebook?: number;
    twitter?: number;
    instagram?: number;
    youtube?: number;
  };
  
  // Media
  image_url?: string;       // Merged field for Feed logo, YouTube thumbnail, etc.
  
  // Source Tracking
  source_dataset: 'feeeed' | 'opml' | 'feedspot'; // Primary source dataset
  original_source_file?: string; // Specific filename (e.g., "RobinFeedlyExport.xml")
  
  // Platform Specific
  channel_id?: string;      // YouTube Channel ID
  subreddit?: string;       // Reddit Subreddit
  bluesky_did?: string;     // Bluesky DID
  
  // Author Info
  author?: string;          // Author name
}

enum Category {
  IndustryAndProfessions = "Industry & Professions",
  SocietyLawAndHistory = "Society, Law & History",
  TravelAndGeography = "Travel & Geography",
  ConsumerTechAndDigital = "Consumer Tech & Digital",
  ArtsAndCulture = "Arts & Culture",
  ScienceAndNature = "Science & Nature",
  AutomotiveAndTransport = "Automotive & Transport",
  SoftwareAndEngineering = "Software & Engineering",
  Sports = "Sports",
  StyleAndShopping = "Style & Shopping",
  RegionalAndLocal = "Regional & Local",
  Entertainment = "Entertainment",
  FoodAndDrink = "Food & Drink",
  HomeAndHobbies = "Home & Hobbies",
  NewsAndCurrentEvents = "News & Current Events",
  BusinessAndFinance = "Business & Finance",
  HealthAndWellness = "Health & Wellness",
  IdentityAndCommunity = "Identity & Community",
  FamilyAndRelationships = "Family & Relationships",
  Gaming = "Gaming"
}
```

## Field Mapping Strategy

| Unified Field | feeeed Field | OPML Field | Feedspot Field | Notes |
|Data Source| `feeeed/*.json` | `opml_feeds.json` | `scraper.py` | |
|---|---|---|---|---|
| **title** | `title` / `cleaned_title` | `title` > `text` | `title` | Prefer `cleaned_title` if avail. Prefer `title` over `text` in OPML. |
| **feed_url** | `feed_url` | `xmlUrl` | `feed_url` | Normalize |
| **website_url** | - | `htmlUrl` (if exists) | `website_url` | |
| **domain** | Derived | Derived | Derived | Extract from URL |
| **summary** | `summary` | `description` | `description` | |
| **category** | `top_level_category` | Map via `category_map` | Map via `category_map` | Must match `Category` enum |
| **subcategory** | `details` | `category` | `category` | Preserve original string |
| **tags** | `tags` | - | - | Keep for filtering |
| **keywords** | `keywords` | - | - | Keep for search |
| **kind** | `kind` | "feed" (default) | "feed" | |
| **popularity_score** | `popularity_score` | - | - | |
| **tranco_rank** | - | - | - | Lookup domain in Tranco list |
| **followers** | - | - | `followers` | Preserve exact counts |
| **image_url** | `thumbnail_url` | - | `image_url` | Merge: Feedspot `image_url` > `thumbnail_url` |
| **source_dataset** | "feeeed" | "opml" | "feedspot" | |
| **original_source_file** | Filename | `source_opml` | Filename | |
| **author** | `cleaned_author` | - | - | |

**Merge Rules:**
1.  **Deduplication**: Key = Normalized `feed_url`.
2.  **Priority**: `feedspot` > `feeeed` > `opml` for shared fields (like `title`, `summary`, `image_url`).
3.  **Collections**: Merge unique items for lists like `topics` or `sources`.
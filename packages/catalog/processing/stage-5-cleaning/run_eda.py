import pandas as pd
import json
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import sys
import os

# Set style
sns.set_theme(style="whitegrid")

# Load data
file_path = "feeds_final.jsonl"
if not os.path.exists(file_path):
    print(f"Error: {file_path} not found.")
    sys.exit(1)

print(f"Loading {file_path}...")
data = []
with open(file_path, "r") as f:
    for line in f:
        try:
            data.append(json.loads(line))
        except json.JSONDecodeError:
            continue

df = pd.json_normalize(data)

print(f"Loaded {len(df)} records.")
print("-" * 50)
print("Columns:", df.columns.tolist())
print("-" * 50)

# Basic Stats
# Select only numeric columns for describe() to avoid clutter
numeric_cols = df.select_dtypes(include=[np.number]).columns
print("Numeric Statistics:")
print(df[numeric_cols].describe())
print("-" * 50)

# --- Analysis 1: Category Distribution ---
if "category" in df.columns:
    plt.figure(figsize=(12, 6))
    cat_counts = df["category"].value_counts()
    sns.barplot(x=cat_counts.index, y=cat_counts.values, palette="viridis")
    plt.title("Number of Feeds per Category")
    plt.xlabel("Category")
    plt.ylabel("Count")
    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()
    plt.savefig("eda_category_distribution.png")
    print("\n[Saved] eda_category_distribution.png")

# --- Analysis 2: Popularity Score Distribution ---
if "popularity_score" in df.columns:
    plt.figure(figsize=(10, 6))
    sns.histplot(df["popularity_score"], bins=20, kde=True, color="skyblue")
    plt.title("Distribution of Popularity Scores")
    plt.xlabel("Score")
    plt.tight_layout()
    plt.savefig("eda_popularity_dist.png")
    print("[Saved] eda_popularity_dist.png")

# --- Analysis 3: Language Distribution (Top 10) ---
if "language" in df.columns:
    plt.figure(figsize=(10, 6))
    lang_counts = df["language"].value_counts().head(10)
    sns.barplot(x=lang_counts.index, y=lang_counts.values, palette="magma")
    plt.title("Top 10 Languages")
    plt.xlabel("Language Code")
    plt.tight_layout()
    plt.savefig("eda_language_dist.png")
    print("[Saved] eda_language_dist.png")

# --- Analysis 4: Top Feeds Overall ---
if "popularity_score" in df.columns and "title" in df.columns:
    print("\n=== TOP 20 FEEDS BY POPULARITY SCORE ===")
    cols_to_show = ["title", "category", "popularity_score", "website_url"]
    # Filter columns that exist
    cols_to_show = [c for c in cols_to_show if c in df.columns]
    top_feeds = df.nlargest(20, "popularity_score")[cols_to_show]
    print(top_feeds.to_string(index=False))

# --- Analysis 5: Top Feeds Per Category ---
if "category" in df.columns and "popularity_score" in df.columns:
    print("\n=== TOP 5 FEEDS PER CATEGORY ===")
    categories = df["category"].dropna().unique()
    for cat in categories:
        print(f"\n-- {cat} --")
        cat_df = df[df["category"] == cat]
        if not cat_df.empty:
            cols_to_show = ["title", "popularity_score", "website_url"]
            cols_to_show = [c for c in cols_to_show if c in df.columns]
            top_cat = cat_df.nlargest(5, "popularity_score")[cols_to_show]
            print(top_cat.to_string(index=False))

# --- Analysis 6: Correlation with Followers ---
follower_cols = ["followers.twitter", "followers.facebook", "followers.instagram"]
if all(c in df.columns for c in follower_cols):
    df["total_followers"] = df[follower_cols].fillna(0).sum(axis=1)

    # Simple correlation
    print("\nCorrelation between Total Followers and Popularity Score:")
    print(df[["total_followers", "popularity_score"]].corr())

    # Plot
    plt.figure(figsize=(10, 8))
    # Filter out 0 followers for log scale if desirable, or add 1
    subset = df.copy()
    subset["total_followers"] = subset["total_followers"] + 1

    sns.scatterplot(
        data=subset,
        x="total_followers",
        y="popularity_score",
        hue="category",
        alpha=0.6,
    )
    plt.xscale("log")
    plt.title("Popularity Score vs Total Followers (Log Scale)")
    plt.tight_layout()
    plt.savefig("eda_popularity_vs_followers.png")
    print("[Saved] eda_popularity_vs_followers.png")
else:
    print(
        "\nFollower columns not fully found, skipping correlation analysis regarding followers."
    )

# --- Analysis 7: Posts Freq Correlation ---
if "stats.posts_per_week" in df.columns and "popularity_score" in df.columns:
    print("\nCorrelation between Posts Per Week and Popularity Score:")
    # Clean posts_per_week?
    df["posts_per_week"] = pd.to_numeric(
        df["stats.posts_per_week"], errors="coerce"
    ).fillna(0)
    print(df[["posts_per_week", "popularity_score"]].corr())

    plt.figure(figsize=(10, 6))
    subset = df.copy()
    subset = subset[
        subset["posts_per_week"] < 1000
    ]  # Remove potential outliers for plotting
    sns.scatterplot(data=subset, x="posts_per_week", y="popularity_score", alpha=0.5)
    plt.title("Popularity Score vs Posts Per Week")
    plt.xlabel("Posts Per Week")
    plt.ylabel("Popularity Score")
    plt.tight_layout()
    plt.savefig("eda_popularity_vs_frequency.png")
    print("[Saved] eda_popularity_vs_frequency.png")

print("\nEDA Complete.")

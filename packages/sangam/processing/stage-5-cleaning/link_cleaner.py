import json
from urllib.parse import urlparse, urljoin
import os
import re
import sys
from collections import Counter


class WebsiteLinkValidator:
    # Django's URL validation regex (simplified/adapted)
    # We want stricter checking for http/https at the start.

    BLOCKED_DOMAINS = {
        "icons.duckduckgo.com",
        "t2.gstatic.com",
        "www.blogger.com",  # often a login or dashboard link
        "draft.blogger.com",
        "drive.google.com",  # usually not a site homepage
        "dropbox.com",
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "feeds.feedburner.com",
        "images.squarespace-cdn.com",
        "backend.deviantart.com",
        "public-api.wordpress.com",
        "api.flickr.com",
        "gh-card.dev",
        "github-readme-stats.vercel.app",
        "i1.feedspot.com",
        "lh3.googleusercontent.com",
        "64.media.tumblr.com",
        "media.tumblr.com",  # Block exact match, careful with subdomains
    }

    @staticmethod
    def is_valid(url):
        """
        Checks if the URL has a valid structure, is HTTP/HTTPS, and is not a file URL,
        and is not in the blocklist.
        """
        if not isinstance(url, str):
            return False

        url = url.strip()
        if not url:
            return False

        # 1. Blocklist check
        if WebsiteLinkValidator._is_blocked(url):
            return False

        # 2. Scheme check
        # Must start with http:// or https://
        if not (url.startswith("http://") or url.startswith("https://")):
            return False

        # 3. Structure check
        if not WebsiteLinkValidator._is_valid_structure(url):
            return False

        # 4. File extension check
        if WebsiteLinkValidator._is_file_url(url):
            return False

        return True

    @staticmethod
    def _is_blocked(url):
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            # Remove port if present
            if ":" in domain:
                domain = domain.split(":")[0]

            if domain in WebsiteLinkValidator.BLOCKED_DOMAINS:
                return True

            # Block tumblr media but allow legitimate subdomains
            # Policy: if exact match "media.tumblr.com" or "64.media.tumblr.com", or ends with ".media.tumblr.com"
            # But "navigame-media.tumblr.com" should be ALLOWED.
            # navigame-media.tumblr.com ends with .tumblr.com. 'media' is part of subdomain name.
            # So check strictly for blocked ones.
            # BLOCKED_DOMAINS already contains "media.tumblr.com"
            # But we must be careful not to substring match indiscriminately.
            # If domain == "media.tumblr.com" or domain.endswith(".media.tumblr.com")
            # But wait, does tumblr used *.media.tumblr.com for user sites? No.
            # So strict match against BLOCKED_DOMAINS should suffice if the list is correct?
            # 64.media.tumblr.com is in BLOCKED_DOMAINS.
            pass

        except:
            pass
        return False

    @staticmethod
    def _is_valid_structure(x):
        try:
            result = urlparse(x)
            if result.scheme not in ("http", "https"):
                return False
            return bool(result.netloc)
        except AttributeError:
            return False
        except ValueError:
            return False

    @staticmethod
    def _is_file_url(url):
        # 1. Parse the URL to get the path (ignoring ?v=233, #hash, etc)
        try:
            parsed = urlparse(url)
            path = parsed.path
        except:
            return False

        # Check for favicon explicitly
        if "favicon" in path.lower():
            return True

        # 2. Extract the extension from the path
        root, ext = os.path.splitext(path)

        # 3. Check if an extension exists
        if (
            ext and len(ext) <= 5
        ):  # Limit check to short extensions to avoid marking /foo.bar/ as file
            # We don't want to flag actual web pages as "files"
            safe_exts = {
                ".html",
                ".htm",
                ".php",
                ".asp",
                ".aspx",
                ".jsp",
                ".shtml",
            }
            if ext.lower() in safe_exts:
                return False
            # Assume other extensions are files (images, pdfs, etc)
            return True

        return False


# Hardcoded fixes map for specific broken strings -> correct logic or replacement
HARDCODED_REPLACEMENTS = {
    "http://": None,
    "https://": None,
    "None": None,
    "index.xml": None,
    "/rss": None,
    "/blog/": None,
    "/en/": None,
    "/wp": None,
    "/post/": None,
    "/": None,
    "{{": None,
}

# Manually verified fixes for specific feed URLs that have broken website_urls
FEED_TO_WEBSITE_MAP = {
    "https://navigame-media.tumblr.com/rss": "https://navigame-media.tumblr.com/",
    "http://feeds.feedburner.com/TheGolfTravelGuru": "http://www.thegolftravelguru.com/",
    "https://feeds.feedburner.com/blogspot/lVlMf": "http://truecrimediscussion.blogspot.com/",
    "http://feeds.feedburner.com/statsblogs": "https://statsblogs.com/",
    "http://feeds.feedburner.com/BreitbartFeed": "https://www.breitbart.com/",
    "https://feeds.feedburner.com/android/lUne": "https://developer.android.com/jetpack/androidx/releases",
    "https://feeds.feedburner.com/Crimeblogger1983": "http://crimeblogger1983.blogspot.com/",
    "http://feeds.feedburner.com/rgcd": "http://www.rgcd.co.uk/",
    "https://feeds.feedburner.com/WhenCanIUse": "https://caniuse.com/",
    "https://backend.deviantart.com/rss.xml?type=gallery&q=by%3Aalexiuss": "https://www.deviantart.com/alexiuss",
    "https://backend.deviantart.com/rss.xml?type=gallery&q=by%3Amattforsyth": "https://www.deviantart.com/mattforsyth",
    "https://backend.deviantart.com/rss.xml?type=gallery&q=by%3Ael-ly": "https://www.deviantart.com/el-ly",
    "https://backend.deviantart.com/rss.xml?type=gallery&q=by%3Aantifan-real": "https://www.deviantart.com/antifan-real",
    "https://backend.deviantart.com/rss.xml?type=gallery&q=by%3Akariliimatainen": "https://www.deviantart.com/kariliimatainen",
    "https://backend.deviantart.com/rss.xml?type=gallery&q=by%3Amariannainsomnia": "https://www.deviantart.com/mariannainsomnia",
    "https://backend.deviantart.com/rss.xml?type=gallery&q=by%3Aryoko-demon": "https://www.deviantart.com/ryoko-demon",
    "https://feeds.feedburner.com/migrantgolfer": "http://migrantgolfer.com/",
    "https://feeds.feedburner.com/sg-en/smart-nation-voices-blog": "https://www.smartnation.gov.sg/",
    "https://feeds.feedburner.com/slyvinyl": "https://slyvinyl.com/",
    "http://feeds.feedburner.com/trendhunter/Auto-and-Motor-Trends": "https://www.trendhunter.com/auto",
    "https://feeds.feedburner.com/Android_Arsenal": "https://android-arsenal.com/",
    "https://backend.deviantart.com/rss.xml?type=gallery&q=by%3Akirawinter": "https://www.deviantart.com/kirawinter",
    "https://feeds.feedburner.com/android/lUne?format=xml": "https://developer.android.com/jetpack/androidx/releases",  # Added query param version
    "http://feeds.feedburner.com/Blog-WillHawkes": "http://willhawkes.blogspot.com/",  # Best effort
    "http://feeds.feedburner.com/zerotao": "http://zerotao.blogspot.com/",  # Best effort
    "http://feeds.feedburner.com/adobe_developer_center_html5": "https://www.adobe.com/devnet/html5.html",  # Best effort
}

# If these domains appear, they are junk/placeholders, map to None (will trigger fallback to feed_url)
BAD_DOMAINS_TO_NUKE = {
    "icons.duckduckgo.com",
    "t2.gstatic.com",
    "www.blogger.com",
    "draft.blogger.com",
    "drive.google.com",
    "dropbox.com",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "feeds.feedburner.com",
    "images.squarespace-cdn.com",
    "backend.deviantart.com",
    "public-api.wordpress.com",
    "api.flickr.com",
    "gh-card.dev",
    "github-readme-stats.vercel.app",
    "i1.feedspot.com",
    "lh3.googleusercontent.com",
    "64.media.tumblr.com",
    "media.tumblr.com",
}


def fix_url(url, feed_url):
    if not isinstance(url, str):
        url = ""

    url = url.strip()
    if feed_url:
        feed_url = feed_url.strip()

    # 0a. Check Feed URL specific fixes first!
    if feed_url in FEED_TO_WEBSITE_MAP:
        return FEED_TO_WEBSITE_MAP[feed_url]

    # 0b. Check Hardcoded exact matches that imply "Invalid" or "Ignore"
    if url in HARDCODED_REPLACEMENTS:
        rep = HARDCODED_REPLACEMENTS[url]
        if rep:
            return rep
        url = ""

    # 1. Detect Garbage Schemas/Prefixes that are unrecoverable -> Nuke them to allow feed_url fallback
    if any(
        url.startswith(p)
        for p in ["tag:", "urn:", "uuid:", "yt:playlist:", "mailto:", "tel:", "{{"]
    ):
        url = ""

    # helper to get clean base from feed_url
    def get_feed_base(f_url):
        if not f_url:
            return None
        try:
            p = urlparse(f_url)
            if p.scheme in ("http", "https") and p.netloc:
                return f"{p.scheme}://{p.netloc}/"
        except:
            pass
        return None

    # 2. Typos and formatting (Ordered carefully)
    if url.startswith("hhttps://"):
        url = "https://" + url[7:]
    if url.startswith("htttp://"):
        url = "http://" + url[6:]
    if url.startswith("//"):
        url = "https:" + url

    # 3. Domain only (no scheme) regex or simple check
    # e.g. "lemonfold.io" or "www.distrotube.com"
    # Matches "something.something" that doesn't start with / or http
    if not url.startswith("http") and not url.startswith("/") and "." in url:
        # crude check
        url = "https://" + url

    # 4. Relative paths
    if url.startswith("/"):
        base = get_feed_base(feed_url)
        if base:
            try:
                url = urljoin(base, url)
            except:
                pass
        else:
            url = ""

    # 5. Domain Blocklist Check
    try:
        p = urlparse(url)
        if p.netloc.lower() in BAD_DOMAINS_TO_NUKE:
            url = ""
        if "media.tumblr.com" in p.netloc.lower():
            # Strict check: exact or subdomain
            # navigame-media.tumblr.com is OK.
            # 64.media.tumblr.com is BAD.
            # media.tumblr.com is BAD.
            d = p.netloc.lower()
            if d == "media.tumblr.com" or d.endswith(".media.tumblr.com"):
                url = ""
    except:
        pass

    validator = WebsiteLinkValidator()
    if validator.is_valid(url):
        return url

    # If we are here, url is empty or invalid.
    # Fallback: Derive from feed_url
    base = get_feed_base(feed_url)
    if base and validator.is_valid(base):
        return base

    return None


def process_file():
    file_path = sys.argv[1] if len(sys.argv) > 1 else "feeds_final.jsonl"
    temp_path = file_path + ".tmp"

    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    print(f"Processing {file_path}...")

    validator = WebsiteLinkValidator()
    fixed_count = 0
    total_count = 0

    # For suspicion analysis
    url_counts = Counter()

    try:
        with open(file_path, "r") as f_in, open(temp_path, "w") as f_out:
            for line in f_in:
                total_count += 1
                try:
                    data = json.loads(line)
                    w_url = data.get("website_url")
                    f_url = data.get("feed_url")

                    # Always try to fix if invalid OR if it matches our junk list logic
                    # We want to be aggressive. Even "valid" URLs like icons.duckduckgo.com need fixing.

                    # 1. Custom validation (includes blocklist)
                    current_is_valid = validator.is_valid(w_url)

                    # 1b. Special check: if feed_url is in our MAP, force update even if w_url is 'valid'
                    # (because w_url might be valid but wrong, e.g. feedburner link)
                    if f_url and f_url.strip() in FEED_TO_WEBSITE_MAP:
                        current_is_valid = False

                    if not current_is_valid:
                        fixed_w_url = fix_url(w_url, f_url)

                        # Apply fix if valid
                        if fixed_w_url and validator.is_valid(fixed_w_url):
                            data["website_url"] = fixed_w_url
                            fixed_count += 1
                        else:
                            # If fix extraction failed (returned None), explicit Null
                            data["website_url"] = None
                            fixed_count += 1

                    f_out.write(json.dumps(data) + "\n")
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        print(f"Error processing file: {e}")
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return

    print(f"Processed {total_count} lines.")
    print(f"Fixed {fixed_count} URLs.")

    # Replace original file
    print(f"Overwriting {file_path} with fixed data...")
    os.replace(temp_path, file_path)
    print("Done.")

    # Suspicious analysis (User asked for this)
    print("\n=== Suspicious Website URLs (Mapped to > 50 feeds) ===")
    suspicious_found = False
    for url, count in url_counts.most_common():
        if count > 50:
            print(f"{count} occurences: {url}")
            suspicious_found = True
        else:
            break

    if not suspicious_found:
        print("No suspicious high-frequency URLs found (> 50).")


if __name__ == "__main__":
    process_file()

"""
Test script for scraping ultimate-guitar.com tab data.

WHY the original joncardasis/ultimate-api (2017) no longer works:
  1. UG sits behind Cloudflare — plain HTTP requests (requests / curl_cffi)
     get a 403 "Just a moment..." challenge page.
  2. The HTML is now fully React-rendered; there's no <pre> in the
     initial HTML response, and the old `div.js-store[data-content]`
     element no longer exists.

WORKING APPROACH (2024+):
  - Use nodriver (Chrome DevTools Protocol, harder to fingerprint than
    Playwright headless) with headless=False so Cloudflare's JS challenge
    can execute in a real browser environment.
  - Warm up session on www.ultimate-guitar.com first to get the
    Cloudflare clearance cookie, then navigate to the tab page.
  - Wait ~5 s for React to hydrate, then read window.UGAPP.store —
    the full tab data is embedded there in the same structure the
    original library used (tab, tab_view, wiki_tab.content).

NOTE: requires a display (runs a visible Chrome window briefly).

Run:
    cd backend && source .venv/bin/activate && cd ..
    python test_ultimate_api.py
"""

import sys
import asyncio
import json
import re

# ── 1. Dependency check ──────────────────────────────────────────────────────

try:
    import nodriver as uc
except ImportError:
    print("[FAIL] nodriver not installed. Run: pip install nodriver")
    sys.exit(1)

print("[OK]   nodriver available")

# ── 2. Core fetch function ───────────────────────────────────────────────────

async def _fetch_tab_async(url: str, warmup_wait: float = 4.0, tab_wait: float = 5.0) -> dict:
    """
    Fetch and parse an ultimate-guitar.com tab page using a real Chrome window.

    Strategy:
      1. Boot Chrome via nodriver (headless=False bypasses Cloudflare's JS check).
      2. Hit www.ultimate-guitar.com first so we collect the CF clearance cookie.
      3. Navigate to the tab URL on tabs.ultimate-guitar.com.
      4. Wait for React to hydrate, then read window.UGAPP.store.page.data.

    Returns a dict: title, artist, type, rating, votes, content (raw UG notation),
    and optional: difficulty, tuning, key, capo.
    """
    browser = await uc.start(headless=False)
    try:
        # Warm up: get Cloudflare clearance cookie from www
        warmup = await browser.get("https://www.ultimate-guitar.com")
        await asyncio.sleep(warmup_wait)

        # Navigate to the actual tab
        page = await browser.get(url)
        await asyncio.sleep(tab_wait)

        # Read the app state injected by React
        raw = await page.evaluate(
            "(typeof window.UGAPP !== 'undefined' && window.UGAPP.store && window.UGAPP.store.page)"
            " ? JSON.stringify(window.UGAPP.store.page.data)"
            " : null"
        )
        if not raw or raw == "null":
            raise ValueError("window.UGAPP.store.page.data is null — page may not have loaded or the URL is 404.")

        data = json.loads(raw)
    finally:
        browser.stop()

    tab_meta = data.get("tab", {})
    tab_view = data.get("tab_view", {})
    wiki_tab = tab_view.get("wiki_tab", {})
    content  = wiki_tab.get("content", "")

    if not content:
        raise ValueError("wiki_tab.content is empty — tab may be paywalled or not found.")

    result = {
        "title":    tab_meta.get("song_name", "UNKNOWN"),
        "artist":   tab_meta.get("artist_name", "UNKNOWN"),
        "type":     tab_meta.get("type_name", "UNKNOWN"),
        "rating":   tab_meta.get("rating"),
        "votes":    tab_meta.get("votes"),
        "content":  content,
    }

    for field in ("difficulty", "tuning", "key", "capo"):
        val = tab_meta.get(field) or tab_view.get(field)
        if val:
            result[field] = val

    return result


def fetch_tab(url: str) -> dict:
    return asyncio.run(_fetch_tab_async(url))


# ── 3. Helper to render a content preview ───────────────────────────────────

def preview(content: str, n: int = 8) -> str:
    """Return first n non-empty lines, stripping UG notation tags."""
    clean = re.sub(r'\[/?(?:ch|tab|verse|chorus|bridge|intro|outro)[^\]]*\]', '', content, flags=re.IGNORECASE)
    lines = [l for l in clean.splitlines() if l.strip()]
    return "\n          ".join(lines[:n])


# ── 4. Tests ─────────────────────────────────────────────────────────────────
#
# NOTE: these are fresh URLs pulled from UG search results (Apr 2026).
# Old IDs from 2017 return 404s — the IDs have been renumbered.

TEST_URLS = [
    ("Ed Sheeran - Perfect",   "https://tabs.ultimate-guitar.com/tab/ed-sheeran/perfect-chords-2608713"),
    ("Jason Mraz - I'm Yours", "https://tabs.ultimate-guitar.com/tab/jason-mraz/im-yours-chords-392130"),
    ("Passenger - Let Her Go", "https://tabs.ultimate-guitar.com/tab/passenger/let-her-go-chords-1196760"),
]

PASS = FAIL = 0

for label, url in TEST_URLS:
    print(f"\n── {label}")
    print(f"   {url}")
    try:
        tab = fetch_tab(url)
        print(f"   [OK]   Title:    {tab['title']}")
        print(f"          Artist:   {tab['artist']}")
        print(f"          Type:     {tab['type']}")
        if tab.get("rating"):
            print(f"          Rating:   {tab['rating']:.2f}  ({tab.get('votes', '?')} votes)")
        for field in ("difficulty", "tuning", "key", "capo"):
            if tab.get(field):
                print(f"          {field.capitalize():<10}{tab[field]}")
        n = len(tab["content"])
        print(f"          Content:  {n} chars")
        print(f"          Preview:")
        print(f"          {preview(tab['content'])}")
        print(f"   [PASS]")
        PASS += 1
    except Exception as e:
        print(f"   [FAIL] {type(e).__name__}: {e}")
        FAIL += 1

# ── 5. Summary ───────────────────────────────────────────────────────────────

print(f"\n{'='*55}")
print(f"Results: {PASS} passed, {FAIL} failed out of {len(TEST_URLS)} tests")
sys.exit(0 if FAIL == 0 else 1)

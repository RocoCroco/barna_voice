"""Content recommendation over a unified catalog (movies + TV shows + football).

Three content sources are normalized into one catalog:
- movie   : TMDB CSV (ranked by vote_count)
- show    : tv_schedule.csv (channel programming)
- sport   : matchday.csv (live football matches)

User logs and explicit preferences decide which items to surface. Every item
carries a content_type so the frontend can render movies, channels and matches.
"""
import re
from functools import lru_cache
from collections import defaultdict
from pathlib import Path
from typing import Optional

import pandas as pd

from db import database

BASE_DIR = Path(__file__).resolve().parents[1] / "data"
MOVIE_CSV = str(BASE_DIR / "movie_dataset.csv")
TV_SCHEDULE_CSV = str(BASE_DIR / "tv_schedule.csv")
MATCHDAY_CSV = str(BASE_DIR / "matchday.csv")

MOVIE_COLUMNS = [
    "title", "genres", "runtime", "vote_average",
    "vote_count", "popularity", "overview", "keywords", "release_date",
    "poster_path", "backdrop_path",
]

# Rank scores keep genre-specific pools sensible: live sport first, then shows,
# then movies by their real vote_count.
SPORT_SCORE = 1_000_000.0
SHOW_SCORE = 1_000.0

# Persona/log genres mapped to the genre labels used in the TMDB catalog.
GENRE_MAP = {
    "Drama": "Drama",
    "Thriller": "Thriller",
    "Indie": "Drama",
    "Action": "Action",
    "Sci-Fi": "Science Fiction",
    "Animation": "Animation",
    "Family": "Family",
    "Anime": "Animation",
    "Comedy": "Comedy",
    "Sitcom": "Comedy",
}

# Loose mood -> catalog search terms (matched against overview/synopsis/keywords).
MOOD_TERMS = {
    "cozy": ["family", "friendship", "romance", "holiday", "feel good"],
    "happy": ["comedy", "fun", "friendship", "adventure"],
    "sad": ["drama", "loss", "grief", "tragedy"],
    "intense": ["thriller", "suspense", "survival", "war", "crime"],
    "scary": ["horror", "supernatural", "monster", "haunting"],
    "romantic": ["romance", "love", "relationship"],
    "adventurous": ["adventure", "quest", "journey", "expedition"],
    "thoughtful": ["philosophy", "mystery", "dystopia", "science"],
}

# Natural subject requests should not be forced into a genre. These aliases
# make common sofa-language useful against the catalogue's synopsis/keywords.
TOPIC_TERMS = {
    "animal": ["animal", "animals", "dog", "cat", "pet", "wildlife", "horse", "bird"],
    "animals": ["animal", "animals", "dog", "cat", "pet", "wildlife", "horse", "bird"],
    "maze": ["maze", "labyrinth"],
    "dinosaurs": ["dinosaur", "dinosaurs", "jurassic"],
}

ALL_CONTENT_TYPES = ("movie", "show", "sport")


def _norm_movies() -> pd.DataFrame:
    df = pd.read_csv(MOVIE_CSV, usecols=MOVIE_COLUMNS)
    df = df.dropna(subset=["title", "genres"]).copy()
    out = pd.DataFrame({
        "content_type": "movie",
        "title": df["title"],
        "genres": df["genres"],
        "runtime": pd.to_numeric(df["runtime"], errors="coerce").fillna(0),
        "rank_score": pd.to_numeric(df["vote_count"], errors="coerce").fillna(0),
        "search_text": (
            df["title"].fillna("") + " " + df["genres"].fillna("") + " "
            + df["overview"].fillna("") + " " + df["keywords"].fillna("")
        ).str.lower(),
    })
    out["vote_average"] = df["vote_average"]
    out["release_year"] = pd.to_datetime(df["release_date"], errors="coerce").dt.year
    out["poster_path"] = df["poster_path"]
    out["backdrop_path"] = df["backdrop_path"]
    out["synopsis"] = df["overview"]
    return out


def _norm_shows() -> pd.DataFrame:
    df = pd.read_csv(TV_SCHEDULE_CSV)
    out = pd.DataFrame({
        "content_type": "show",
        "title": df["Show_Title"],
        "genres": df["Genre"].fillna(""),
        "runtime": pd.to_numeric(df["Duration_Minutes"], errors="coerce").fillna(0),
        "rank_score": SHOW_SCORE,
        "search_text": (
            df["Show_Title"].fillna("") + " " + df["Episode_Synopsis"].fillna("")
            + " " + df["Genre"].fillna("") + " " + df["Channel_Name"].fillna("")
        ).str.lower(),
    })
    out["channel"] = df["Channel_Name"]
    out["start_time"] = df["Start_Time"]
    out["end_time"] = df["End_Time"]
    out["air_date"] = df["Date"]
    out["rating"] = df["Rating"]
    out["synopsis"] = df["Episode_Synopsis"]
    return out


def _norm_sports() -> pd.DataFrame:
    df = pd.read_csv(MATCHDAY_CSV)
    out = pd.DataFrame({
        "content_type": "sport",
        "title": df["Home_Team"] + " vs " + df["Away_Team"] + " (" + df["League"] + ")",
        "genres": "Sports, Football, " + df["League"],
        "runtime": 120,
        "rank_score": SPORT_SCORE,
        "search_text": (
            df["Home_Team"] + " " + df["Away_Team"] + " " + df["League"] + " "
            + df["Country"] + " " + df["City"].fillna("") + " football soccer"
        ).str.lower(),
    })
    out["league"] = df["League"]
    out["home_team"] = df["Home_Team"]
    out["away_team"] = df["Away_Team"]
    out["kickoff_cet"] = df["Kickoff_Time_CET"]
    out["match_date"] = df["Date"]
    out["broadcaster_uk"] = df["Broadcaster_UK"]
    out["broadcaster_es"] = df["Broadcaster_ES"]
    out["broadcaster_it"] = df["Broadcaster_IT"]
    out["broadcaster_us"] = df["Broadcaster_US"]
    return out


@lru_cache(maxsize=1)
def get_catalog() -> pd.DataFrame:
    """Loads and caches the unified movies + shows + sports catalog once."""
    return pd.concat([_norm_movies(), _norm_shows(), _norm_sports()], ignore_index=True)


def _resolve_types(content_types: Optional[list[str]]) -> list[str]:
    if not content_types:
        return list(ALL_CONTENT_TYPES)
    return [t for t in content_types if t in ALL_CONTENT_TYPES] or list(ALL_CONTENT_TYPES)


def _pool(content_types: Optional[list[str]]) -> pd.DataFrame:
    catalog = get_catalog()
    return catalog[catalog["content_type"].isin(_resolve_types(content_types))]


def _to_item(row, matched_genre: Optional[str] = None) -> dict:
    item = {
        "content_type": row["content_type"],
        "title": row["title"],
        "genres": [g.strip() for g in str(row["genres"]).split(",") if g.strip()],
        "runtime_minutes": int(row["runtime"]) if row["runtime"] else None,
        "matched_genre": matched_genre,
    }
    if "synopsis" in row.index and pd.notna(row["synopsis"]):
        item["synopsis"] = str(row["synopsis"])
    if row["content_type"] == "movie":
        item["vote_average"] = float(row["vote_average"]) if pd.notna(row["vote_average"]) else None
        item["release_year"] = int(row["release_year"]) if pd.notna(row["release_year"]) else None
        item["poster_path"] = row["poster_path"] if pd.notna(row["poster_path"]) else None
        item["backdrop_path"] = row["backdrop_path"] if pd.notna(row["backdrop_path"]) else None
    elif row["content_type"] == "show":
        item["channel"] = row["channel"]
        item["start_time"] = row["start_time"]
        item["end_time"] = row["end_time"]
        item["air_date"] = row["air_date"]
        item["rating"] = row["rating"]
    elif row["content_type"] == "sport":
        item["league"] = row["league"]
        item["home_team"] = row["home_team"]
        item["away_team"] = row["away_team"]
        item["kickoff_cet"] = row["kickoff_cet"]
        item["match_date"] = row["match_date"]
        item["broadcasters"] = {
            "UK": row["broadcaster_uk"], "ES": row["broadcaster_es"],
            "IT": row["broadcaster_it"], "US": row["broadcaster_us"],
        }
    return item


def _mood_to_terms(mood: Optional[str]) -> list[str]:
    if not mood:
        return []
    words = [w.strip().lower() for w in re.split(r"[ ,]+", mood) if w.strip()]
    terms: list[str] = []
    for word in words:
        terms.extend(MOOD_TERMS.get(word, [word]))
    return terms


def _topic_to_terms(query: Optional[str]) -> list[str]:
    if not query:
        return []
    words = [w.strip().lower() for w in re.split(r"[^\w]+", query) if len(w.strip()) > 2]
    terms: list[str] = []
    for word in words:
        terms.extend(TOPIC_TERMS.get(word, [word[:-1] if word.endswith("s") else word]))
    return list(dict.fromkeys(terms))


def _filter_search_text(df: pd.DataFrame, terms: list[str]) -> pd.DataFrame:
    if not terms:
        return df
    pattern = "|".join(rf"\b{re.escape(term)}\b" for term in terms)
    return df[df["search_text"].str.contains(pattern, na=False)]


def _apply_filters(
    df: pd.DataFrame,
    max_runtime: Optional[int],
    mood: Optional[str],
    query: Optional[str] = None,
) -> pd.DataFrame:
    out = df
    if max_runtime:
        out = out[(out["runtime"] > 0) & (out["runtime"] <= max_runtime)]
    out = _filter_search_text(out, _mood_to_terms(mood))
    out = _filter_search_text(out, _topic_to_terms(query))
    return out


def _allocate(weights: dict[str, float], k: int) -> dict[str, int]:
    """Splits k slots across genres proportionally to their weights."""
    if not weights:
        return {}
    total = sum(weights.values()) or 1
    normalized = {g: w / total for g, w in weights.items()}
    slots = {g: int(w * k) for g, w in normalized.items()}
    while sum(slots.values()) < k:
        # Hand the next slot to the genre with the largest unmet fraction.
        best = max(normalized, key=lambda g: normalized[g] * k - slots[g])
        slots[best] += 1
    return slots


def _select_by_weights(weights: dict[str, float], k: int, base: pd.DataFrame,
                       seen: Optional[set[str]] = None) -> list[dict]:
    slots = _allocate(weights, k)
    chosen: list[dict] = []
    seen = set(seen or set())

    for genre, n in sorted(slots.items(), key=lambda x: -x[1]):
        if n <= 0:
            continue
        sub = base[base["genres"].str.contains(re.escape(genre), na=False)]
        sub = sub[~sub["title"].isin(seen)].sort_values("rank_score", ascending=False).head(n)
        for _, row in sub.iterrows():
            chosen.append(_to_item(row, matched_genre=genre))
            seen.add(row["title"])

    if len(chosen) < k:
        fill = base[~base["title"].isin(seen)].sort_values("rank_score", ascending=False)
        for _, row in fill.head(k - len(chosen)).iterrows():
            chosen.append(_to_item(row))
            seen.add(row["title"])

    return chosen[:k]


def _log_weights(user_id: str) -> dict[str, float]:
    """Genre weights (mapped to catalog genres) from a user's completed history."""
    weights: dict[str, float] = defaultdict(float)
    for stat in database.get_user_genre_stats(user_id):
        catalog_genre = GENRE_MAP.get(stat["genre"], stat["genre"])
        weights[catalog_genre] += stat["count"]
    return dict(weights)


def _normalized_pref_weights(user_id: Optional[str], genre: Optional[str]) -> dict[str, float]:
    """One participant's genre weights, summing to 1 so everyone has equal say."""
    if user_id:
        weights = _log_weights(user_id)
        total = sum(weights.values())
        if total:
            return {g: w / total for g, w in weights.items()}
    if genre:
        return {GENRE_MAP.get(genre, genre): 1.0}
    return {}


def _top_of_type(content_type: str, seen: set[str], n: int = 1) -> list[dict]:
    pool = get_catalog()
    pool = pool[(pool["content_type"] == content_type) & (~pool["title"].isin(seen))]
    pool = pool.sort_values("rank_score", ascending=False).head(n)
    items = []
    for _, row in pool.iterrows():
        items.append(_to_item(row))
        seen.add(row["title"])
    return items


def decide_for_me(
    user_id: str,
    k: int = 8,
    content_types: Optional[list[str]] = None,
    randomize: bool = False,
) -> dict:
    """Logs-only: rank by learned genre preference, with a bit of live variety."""
    types = _resolve_types(content_types)
    weights = _log_weights(user_id)

    if randomize:
        pool = _pool(types)
        if weights:
            pattern = "|".join(re.escape(genre) for genre in weights)
            preferred = pool[pool["genres"].str.contains(pattern, na=False)]
            if not preferred.empty:
                pool = preferred
        sample = pool.sample(n=min(k, len(pool))) if not pool.empty else pool
        return {
            "mode": "decide_for_me", "user_id": user_id,
            "status": "success" if not sample.empty else "no_matches",
            "genre_weights": weights,
            "items": [_to_item(row) for _, row in sample.iterrows()],
        }

    items: list[dict] = []
    seen: set[str] = set()
    # A live match and a channel show add "movie / sport / channel" variety.
    if "sport" in types:
        items += _top_of_type("sport", seen, 1)
    if "show" in types:
        items += _top_of_type("show", seen, 1)

    movie_pool = _pool(["movie"]) if "movie" in types else _pool(types)
    remaining = k - len(items)
    if weights:
        status = "success"
        items += _select_by_weights(weights, remaining, movie_pool, seen=seen)
    else:
        status = "cold_start"
        fill = movie_pool[~movie_pool["title"].isin(seen)].sort_values("rank_score", ascending=False)
        items += [_to_item(r) for _, r in fill.head(remaining).iterrows()]

    return {"mode": "decide_for_me", "user_id": user_id, "status": status,
            "genre_weights": weights, "items": items[:k]}


def recommend_by_preference(
    genre: Optional[str] = None,
    duration: Optional[int] = None,
    mood: Optional[str] = None,
    query: Optional[str] = None,
    k: int = 8,
    content_types: Optional[list[str]] = None,
) -> dict:
    """Explicit preferences: filter the catalog by genre, duration and mood."""
    base = _pool(content_types)
    catalog_genre = GENRE_MAP.get(genre, genre) if genre else None
    if catalog_genre:
        genre_matches = base[base["genres"].str.contains(re.escape(catalog_genre), na=False)]
        if genre_matches.empty:
            query = " ".join(part for part in [query, genre] if part)
            catalog_genre = None
        else:
            base = genre_matches
    base = _apply_filters(base, duration, mood, query)

    ranked = base.sort_values("rank_score", ascending=False).head(k)
    items = [_to_item(row, matched_genre=catalog_genre) for _, row in ranked.iterrows()]

    return {"mode": "preference", "genre": genre, "duration": duration, "mood": mood,
            "query": query, "status": "success" if items else "no_matches", "items": items[:k]}


def recommend_for_room(participants: list[dict], k: int = 8,
                       content_types: Optional[list[str]] = None) -> dict:
    """Room mode: merge every participant's preferences into one list of k items."""
    merged: dict[str, float] = defaultdict(float)
    durations: list[int] = []
    moods: list[str] = []
    queries: list[str] = []

    for person in participants:
        for genre, weight in _normalized_pref_weights(
            person.get("user_id"), person.get("genre")
        ).items():
            merged[genre] += weight
        if person.get("duration"):
            durations.append(person["duration"])
        if person.get("mood"):
            moods.append(person["mood"])
        if person.get("query"):
            queries.append(person["query"])

    # Everyone must fit their time budget -> use the tightest one.
    max_runtime = min(durations) if durations else None
    mood = " ".join(moods) if moods else None
    query = " ".join(queries) if queries else None
    base = _apply_filters(_pool(content_types), max_runtime, mood, query)

    if merged:
        items = _select_by_weights(dict(merged), k, base)
    else:
        items = [_to_item(r) for _, r in base.sort_values("rank_score", ascending=False).head(k).iterrows()]

    return {"mode": "room", "participants": len(participants), "status": "success",
            "merged_genre_weights": dict(merged), "max_runtime": max_runtime,
            "items": items}


def catalog_genres() -> list[str]:
    """Distinct genres available across every content type in the catalog."""
    catalog = get_catalog()
    genres: set[str] = set()
    for value in catalog["genres"].dropna():
        genres.update(g.strip() for g in str(value).split(",") if g.strip())
    return sorted(genres)

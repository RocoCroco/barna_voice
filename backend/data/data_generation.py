import json
import random
from pathlib import Path
from datetime import datetime, timedelta
import pandas as pd

# Real movie catalog used to give each log an authentic title per genre.
DATA_DIR = Path(__file__).resolve().parent
MOVIE_CSV = str(DATA_DIR / "movie_dataset.csv")

# Persona genres mapped to the genre labels used in the TMDB dataset.
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

# How many of the most-voted titles to keep per genre (keeps names recognizable).
TITLES_PER_GENRE = 400


def build_title_pools():
    """Returns {persona_genre: [real titles]} sourced from the TMDB catalog."""
    df = pd.read_csv(MOVIE_CSV, usecols=["title", "genres", "vote_count"])
    df = df.dropna(subset=["title", "genres"])

    pools = {}
    for persona_genre, tmdb_genre in GENRE_MAP.items():
        if persona_genre in pools:
            continue
        matches = df[df["genres"].str.contains(tmdb_genre, na=False)]
        matches = matches.sort_values("vote_count", ascending=False)
        titles = matches["title"].drop_duplicates().head(TITLES_PER_GENRE).tolist()
        pools[persona_genre] = titles or ["Untitled"]
    return pools


TITLE_POOLS = build_title_pools()

# Expanded extreme hackathon personas with complex behavioral rules
PROFILES = {
    "user_1_cinephile": {
        "genres": ["Drama", "Thriller", "Indie"], 
        "apps": ["Max", "Criterion"], 
        "durations": [120, 150, 180], 
        "completion_rate": 0.9,  # Usually finishes long movies
        "weekend_only": True     # Binge watcher
    },
    "user_2_skipper": {
        "genres": ["Action", "Sci-Fi"], 
        "apps": ["Netflix", "Prime"], 
        "durations": [2, 5, 8], 
        "completion_rate": 0.1,  # Skips constantly
        "weekend_only": False
    },
    "user_3_morning_parent": {
        "genres": ["Animation", "Family"], 
        "apps": ["Disney+", "YouTube Kids"], 
        "durations": [20, 30], 
        "completion_rate": 0.85,
        "weekend_only": False
    },
    "user_4_anime_fan": {
        "genres": ["Anime", "Action"], 
        "apps": ["Crunchyroll", "Netflix"], 
        "durations": [24, 24], 
        "completion_rate": 0.95,
        "weekend_only": False
    },
    "user_5_comfort_watcher": {
        "genres": ["Comedy", "Sitcom"], 
        "apps": ["Hulu", "Peacock"], 
        "durations": [22, 22], 
        "completion_rate": 0.9,
        "weekend_only": False
    }
}

# Broader OS-level interactions
ACTIONS = ["app_opened", "content_started", "content_skipped", "content_completed", "dwell_time_10m"]

def generate_logs(events_per_user=500):
    logs = []
    # Expanded window to 90 days to fit 500 events logically
    base_time = datetime.utcnow() - timedelta(days=90)
    
    for user_id, prefs in PROFILES.items():
        current_time = base_time
        for _ in range(events_per_user):
            # Time jumps forward in smaller increments to simulate daily TV usage
            current_time += timedelta(hours=random.randint(0, 4), minutes=random.randint(5, 59))
            
            # Force time-of-day constraints for specific profiles
            if "parent" in user_id:
                current_time = current_time.replace(hour=random.randint(6, 9))
            elif "anime" in user_id:
                current_time = current_time.replace(hour=random.choice([22, 23, 0, 1]))
            elif prefs.get("weekend_only"):
                # Force to a weekend (Friday=4, Saturday=5, Sunday=6)
                while current_time.weekday() not in [4, 5, 6]:
                    current_time += timedelta(days=1)
                current_time = current_time.replace(hour=random.randint(19, 23))

            # Complex action logic based on the user's completion rate
            if random.random() > prefs["completion_rate"]:
                action = random.choice(["app_opened", "content_skipped", "dwell_time_10m", "content_started"])
            else:
                action = "content_completed"
                
            # Overwrite for the 'Skipper' to ensure high friction metrics
            if "skipper" in user_id:
                action = "content_skipped" if random.random() < 0.8 else random.choice(ACTIONS)

            genre = random.choice(prefs["genres"])
            log = {
                "timestamp": current_time.isoformat() + "Z",
                "user_id": user_id,
                "action_type": action,
                "metadata": {
                    "app": random.choice(prefs["apps"]),
                    "genre": genre,
                    "duration_watched_minutes": random.choice(prefs["durations"]),
                    "title": random.choice(TITLE_POOLS[genre]),
                    "day_of_week": current_time.strftime('%A')
                }
            }
            logs.append(log)
            
    return logs

if __name__ == "__main__":
    dataset = generate_logs(events_per_user=500)
    with open(DATA_DIR / "tv_logs.json", "w") as f:
        json.dump(dataset, f, indent=2)
    print(f"Generated {len(dataset)} historical logs for {len(PROFILES)} demo users.")

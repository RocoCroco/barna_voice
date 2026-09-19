import json
import random
from datetime import datetime, timedelta
from faker import Faker

fake = Faker()

# Define 5 extreme hackathon personas for distinct demo outcomes
PROFILES = {
    "user_1_cinephile": {"genres": ["Drama", "Thriller", "Indie"], "apps": ["Max", "Criterion"], "durations": [120, 150, 180], "action": "content_completed"},
    "user_2_skipper": {"genres": ["Action", "Sci-Fi"], "apps": ["Netflix", "Prime"], "durations": [2, 5, 8], "action": "content_skipped"},
    "user_3_morning_parent": {"genres": ["Animation", "Family"], "apps": ["Disney+", "YouTube Kids"], "durations": [20, 30], "action": "content_completed"},
    "user_4_anime_fan": {"genres": ["Anime", "Action"], "apps": ["Crunchyroll", "Netflix"], "durations": [24, 24], "action": "content_completed"},
    "user_5_comfort_watcher": {"genres": ["Comedy", "Sitcom"], "apps": ["Hulu", "Peacock"], "durations": [22, 22], "action": "content_completed"}
}

def generate_logs(events_per_user=100):
    logs = []
    base_time = datetime.utcnow() - timedelta(days=30)
    
    for user_id, prefs in PROFILES.items():
        current_time = base_time
        for _ in range(events_per_user):
            # Time jumps forward randomly
            current_time += timedelta(hours=random.randint(1, 12), minutes=random.randint(0, 59))
            
            # Force time-of-day constraints for specific profiles
            if "parent" in user_id:
                current_time = current_time.replace(hour=random.randint(6, 9))
            elif "anime" in user_id:
                current_time = current_time.replace(hour=random.choice([22, 23, 0, 1]))

            log = {
                "timestamp": current_time.isoformat() + "Z",
                "user_id": user_id,
                "action_type": prefs["action"],
                "metadata": {
                    "app": random.choice(prefs["apps"]),
                    "genre": random.choice(prefs["genres"]),
                    "duration_watched_minutes": random.choice(prefs["durations"]),
                    "mock_title": fake.catch_phrase()
                }
            }
            logs.append(log)
            
    return logs

if __name__ == "__main__":
    dataset = generate_logs()
    with open("tv_logs.json", "w") as f:
        json.dump(dataset, f, indent=2)
    print(f"Generated {len(dataset)} historical logs for {len(PROFILES)} demo users.")

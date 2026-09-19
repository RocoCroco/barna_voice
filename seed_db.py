import json
from database import init_db, insert_log

def seed_database():
    init_db()
    try:
        with open("tv_logs.json", "r") as f:
            logs = json.load(f)
            
        for log in logs:
            insert_log(
                user_id=log["user_id"],
                action_type=log["action_type"],
                metadata=log["metadata"]
            )
        print(f"Loaded {len(logs)} mock events into tv_logs.db.")
    except FileNotFoundError:
        print("Error: tv_logs.json not found. Run your mock generator script first.")

if __name__ == "__main__":
    seed_database()

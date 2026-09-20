import os
from pathlib import Path

from db import database


def initialize_database() -> None:
    seed = os.environ.get("SEED_DEMO_DATA", "false").lower()
    if seed not in {"true", "false"}:
        raise ValueError("SEED_DEMO_DATA must be true or false.")
    Path(database.DB_NAME).parent.mkdir(parents=True, exist_ok=True)
    database.init_db()
    with database.get_db() as connection:
        has_logs = connection.execute("SELECT 1 FROM activity_logs LIMIT 1").fetchone()
    if seed == "true" and not has_logs:
        source = Path(__file__).resolve().parents[1] / "data" / "tv_logs.json"
        count = database.update_db_from_json(str(source))
        print(f"Initialized empty database with {count} demo events.")


if __name__ == "__main__":
    initialize_database()

import sqlite3
import json
import os
from pathlib import Path
from typing import List, Dict, Any

DB_NAME = os.environ.get("COMPASS_DB_PATH", str(Path(__file__).resolve().parent / "tv_logs.db"))

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row  # Access columns by name
    return conn

def init_db():
    """Initializes the database schema."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                user_id TEXT NOT NULL,
                action_type TEXT NOT NULL,
                metadata TEXT NOT NULL
            );
        """)
        # Index on user_id and timestamp for rapid LLM context lookups
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_timestamp 
            ON activity_logs (user_id, timestamp DESC);
        """)
        conn.commit()

def insert_log(user_id: str, action_type: str, metadata: Dict[str, Any]):
    """Saves a new user event received from the UI."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO activity_logs (user_id, action_type, metadata)
            VALUES (?, ?, ?)
            """,
            (user_id, action_type, json.dumps(metadata))
        )
        conn.commit()

def get_recent_user_logs(user_id: str, limit: int = 30) -> List[Dict[str, Any]]:
    """Fetches the latest activity logs formatted for the LLM prompt."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT timestamp, action_type, metadata 
            FROM activity_logs 
            WHERE user_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
            """,
            (user_id, limit)
        )
        rows = cursor.fetchall()
        
    return [
        {
            "timestamp": row["timestamp"],
            "action_type": row["action_type"],
            "metadata": json.loads(row["metadata"])
        }
        for row in rows
    ]


def query_logs(
    user_id: str | None = None,
    genre: str | None = None,
    action_type: str | None = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """Returns activity logs filtered by any combination of user, genre and action."""
    clauses: List[str] = []
    params: List[Any] = []
    if user_id:
        clauses.append("user_id = ?")
        params.append(user_id)
    if genre:
        clauses.append("json_extract(metadata, '$.genre') = ?")
        params.append(genre)
    if action_type:
        clauses.append("action_type = ?")
        params.append(action_type)

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    sql = (
        "SELECT timestamp, user_id, action_type, metadata "
        f"FROM activity_logs {where} ORDER BY timestamp DESC LIMIT ?"
    )
    params.append(max(1, min(int(limit), 1000)))

    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()

    return [
        {
            "timestamp": row["timestamp"],
            "user_id": row["user_id"],
            "action_type": row["action_type"],
            "metadata": json.loads(row["metadata"]),
        }
        for row in rows
    ]


def get_distinct_users() -> List[str]:
    """Returns every user_id present in the logs."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT user_id FROM activity_logs ORDER BY user_id"
        ).fetchall()
    return [row["user_id"] for row in rows]


def get_distinct_genres() -> List[str]:
    """Returns every genre found in the logs' metadata."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT DISTINCT json_extract(metadata, '$.genre') AS genre
            FROM activity_logs
            WHERE genre IS NOT NULL
            ORDER BY genre
            """
        ).fetchall()
    return [row["genre"] for row in rows]


def get_user_genre_stats(user_id: str) -> List[Dict[str, Any]]:
    """Returns how many completed items a user has per genre, most watched first."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT json_extract(metadata, '$.genre') AS genre, COUNT(*) AS count
            FROM activity_logs
            WHERE user_id = ?
              AND action_type = 'content_completed'
              AND genre IS NOT NULL
            GROUP BY genre
            ORDER BY count DESC
            """,
            (user_id,),
        ).fetchall()
    return [{"genre": row["genre"], "count": row["count"]} for row in rows]


def update_db_from_json(json_file_path: str) -> int:
    """Loads activity logs from a JSON file and inserts them into the database.

    The JSON file may contain either a single log object or a list of log objects.
    Each log object should include: timestamp, user_id, action_type, and metadata.

    Returns the number of rows inserted.
    """
    with open(json_file_path, "r", encoding="utf-8") as file:
        payload = json.load(file)

    records = payload if isinstance(payload, list) else [payload]
    inserted = 0

    with get_db() as conn:
        cursor = conn.cursor()
        for record in records:
            if not isinstance(record, dict):
                continue

            timestamp = record.get("timestamp")
            user_id = record.get("user_id")
            action_type = record.get("action_type")
            metadata = record.get("metadata", {})

            # Validate required fields
            if user_id is None or action_type is None:
                continue

            # Ensure metadata is serialized as a JSON string
            metadata_str = json.dumps(metadata) if isinstance(metadata, (dict, list)) else json.dumps({})

            if timestamp:
                cursor.execute(
                    """
                    INSERT INTO activity_logs (timestamp, user_id, action_type, metadata)
                    VALUES (?, ?, ?, ?)
                    """,
                    (timestamp, user_id, action_type, metadata_str),
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO activity_logs (user_id, action_type, metadata)
                    VALUES (?, ?, ?)
                    """,
                    (user_id, action_type, metadata_str),
                )
            inserted += 1

        conn.commit()

    return inserted


if __name__ == "__main__":
    init_db()
    update_db_from_json(str(Path(__file__).resolve().parents[1] / "data" / "tv_logs.json"))
    print("Database initialized successfully.")

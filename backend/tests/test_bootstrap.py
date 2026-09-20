import os
import subprocess
import sys

import pytest

from app.bootstrap import initialize_database
from db import database


@pytest.fixture
def isolated_database(tmp_path, monkeypatch):
    path = tmp_path / "storage" / "tv_logs.db"
    monkeypatch.setattr(database, "DB_NAME", str(path))
    return path


def test_seed_is_idempotent_and_preserves_history(isolated_database, monkeypatch):
    monkeypatch.setenv("SEED_DEMO_DATA", "true")
    initialize_database()
    with database.get_db() as connection:
        count = connection.execute("SELECT COUNT(*) FROM activity_logs").fetchone()[0]
    assert count > 0
    database.insert_log("deployment-viewer", "content_completed", {"title": "Arrival"})
    initialize_database()
    with database.get_db() as connection:
        assert connection.execute("SELECT COUNT(*) FROM activity_logs").fetchone()[0] == count + 1
    assert "deployment-viewer" in database.get_distinct_users()


def test_seed_can_be_disabled(isolated_database, monkeypatch):
    monkeypatch.setenv("SEED_DEMO_DATA", "false")
    initialize_database()
    assert isolated_database.exists()
    assert database.get_distinct_users() == []


def test_invalid_seed_setting_fails_before_writing(isolated_database, monkeypatch):
    monkeypatch.setenv("SEED_DEMO_DATA", "tru")
    with pytest.raises(ValueError, match="true or false"):
        initialize_database()
    assert not isolated_database.exists()


def test_database_path_is_read_from_environment(tmp_path):
    path = tmp_path / "persisted.db"
    result = subprocess.run(
        [sys.executable, "-c", "from db.database import DB_NAME; print(DB_NAME)"],
        env={**os.environ, "COMPASS_DB_PATH": str(path)},
        capture_output=True, text=True, check=True,
    )
    assert result.stdout.strip() == str(path)

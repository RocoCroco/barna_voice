from db import database


def test_distinct_users_present():
    users = database.get_distinct_users()
    assert "user_1_cinephile" in users
    assert len(users) >= 5


def test_distinct_genres_present():
    genres = database.get_distinct_genres()
    assert genres  # non-empty
    assert "Drama" in genres


def test_query_logs_filter_by_user():
    logs = database.query_logs(user_id="user_1_cinephile", limit=25)
    assert logs
    assert all(row["user_id"] == "user_1_cinephile" for row in logs)


def test_query_logs_filter_by_genre():
    logs = database.query_logs(genre="Drama", limit=25)
    assert logs
    assert all(row["metadata"].get("genre") == "Drama" for row in logs)


def test_query_logs_combined_filters():
    logs = database.query_logs(
        user_id="user_1_cinephile", genre="Thriller", action_type="content_completed", limit=10
    )
    for row in logs:
        assert row["user_id"] == "user_1_cinephile"
        assert row["action_type"] == "content_completed"
        assert row["metadata"].get("genre") == "Thriller"


def test_query_logs_limit_respected():
    logs = database.query_logs(limit=5)
    assert len(logs) <= 5


def test_query_logs_limit_capped():
    # limit above the hard cap should not exceed 1000
    logs = database.query_logs(limit=999999)
    assert len(logs) <= 1000


def test_query_logs_unknown_user_empty():
    assert database.query_logs(user_id="does_not_exist") == []


def test_user_genre_stats_sorted_desc():
    stats = database.get_user_genre_stats("user_1_cinephile")
    assert stats
    counts = [s["count"] for s in stats]
    assert counts == sorted(counts, reverse=True)
    assert all(s["count"] > 0 for s in stats)


def test_user_genre_stats_unknown_user_empty():
    assert database.get_user_genre_stats("does_not_exist") == []

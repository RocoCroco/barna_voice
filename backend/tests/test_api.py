KNOWN_USER = "user_1_cinephile"


def test_root_lists_models_and_endpoints(client):
    body = client.get("/").json()
    assert set(body["models_loaded"]) == {
        "predict_genre", "predict_movie", "predict_user_preference"
    }
    assert "POST /api/content/decide" in body["endpoints"]


def test_users_endpoint(client):
    users = client.get("/api/users").json()["users"]
    assert KNOWN_USER in users


def test_genres_endpoint(client):
    genres = client.get("/api/genres").json()["genres"]
    assert "Drama" in genres


def test_catalog_genres_endpoint(client):
    genres = client.get("/api/catalog/genres").json()["genres"]
    assert "Football" in genres
    assert "News" in genres


def test_logs_filter(client):
    body = client.get(
        "/api/logs", params={"user_id": KNOWN_USER, "genre": "Drama", "limit": 5}
    ).json()
    assert body["count"] <= 5
    for row in body["logs"]:
        assert row["user_id"] == KNOWN_USER
        assert row["metadata"]["genre"] == "Drama"


def test_logs_limit_validation(client):
    # limit above the allowed max is rejected by FastAPI query validation.
    resp = client.get("/api/logs", params={"limit": 5000})
    assert resp.status_code == 422


def test_stats_known_user(client):
    body = client.get(f"/api/stats/{KNOWN_USER}").json()
    assert body["user_id"] == KNOWN_USER
    assert body["genre_breakdown"]


def test_stats_unknown_user_404(client):
    assert client.get("/api/stats/ghost_user").status_code == 404


def test_predict_genre_success(client):
    body = client.post("/api/predict/genre", json={
        "user_id": KNOWN_USER, "app": "Criterion", "hour": 22, "day_of_week": "Sunday"
    }).json()
    assert body["status"] == "success"
    assert 0.0 <= body["confidence"] <= 1.0


def test_predict_genre_cold_start(client):
    body = client.post("/api/predict/genre", json={
        "user_id": "ghost_user", "app": "Criterion"
    }).json()
    assert body["status"] == "cold_start"


def test_predict_user_preference_success(client):
    body = client.post("/api/predict/user-preference", json={
        "user_id": "user_2_skipper", "hour": 9, "day_of_week": "Monday"
    }).json()
    assert body["status"] == "success"
    assert body["predicted_genre"]


def test_predict_movie_success(client):
    body = client.post("/api/predict/movie", json={
        "user_id": "user_4_anime_fan", "genre": "Anime", "hour": 1
    }).json()
    assert body["status"] in {"success", "cold_start"}


def test_recommend_pipeline(client):
    body = client.post("/api/recommend", json={
        "user_id": KNOWN_USER, "app": "Criterion", "hour": 22, "day_of_week": "Sunday"
    }).json()
    assert body["status"] == "success"
    assert body["predicted_genre"]
    assert body["genre_source"] in {"predict_genre", "predict_user_preference"}


def test_slng_tool(client):
    body = client.post("/api/tool/predict-genre", json={"user_id": KNOWN_USER}).json()
    assert body["status"] == "success"


def test_content_decide(client):
    body = client.post("/api/content/decide", json={"user_id": KNOWN_USER}).json()
    assert body["mode"] == "decide_for_me"
    assert len(body["items"]) == 8


def test_content_preference(client):
    body = client.post("/api/content/preference", json={
        "genre": "Sci-Fi", "duration": 150, "mood": "intense"
    }).json()
    assert body["mode"] == "preference"
    assert len(body["items"]) == 8


def test_content_room(client):
    body = client.post("/api/content/room", json={"participants": [
        {"user_id": KNOWN_USER}, {"genre": "Animation", "duration": 120}, {"mood": "happy"}
    ]}).json()
    assert body["mode"] == "room"
    assert len(body["items"]) == 8
    assert body["max_runtime"] == 120


def test_content_room_empty_400(client):
    assert client.post("/api/content/room", json={"participants": []}).status_code == 400


def test_content_type_filter_via_api(client):
    body = client.post("/api/content/preference", json={
        "genre": "News", "content_types": ["show"]
    }).json()
    assert body["items"]
    assert all(i["content_type"] == "show" for i in body["items"])

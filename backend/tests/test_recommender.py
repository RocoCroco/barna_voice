from recommender import recommender

KNOWN_USER = "user_1_cinephile"


def test_catalog_has_all_content_types():
    catalog = recommender.get_catalog()
    types = set(catalog["content_type"].unique())
    assert types == {"movie", "show", "sport"}


def test_catalog_genres_span_sources():
    genres = recommender.catalog_genres()
    assert "Action" in genres          # movie
    assert "News" in genres            # show
    assert "Football" in genres        # sport


def test_decide_for_me_returns_eight():
    result = recommender.decide_for_me(KNOWN_USER, k=8)
    assert result["status"] == "success"
    assert len(result["items"]) == 8
    assert result["genre_weights"]


def test_decide_for_me_default_mixes_types():
    items = recommender.decide_for_me(KNOWN_USER, k=8)["items"]
    types = {i["content_type"] for i in items}
    # Default reserves a sport + a show slot alongside movies.
    assert "sport" in types
    assert "show" in types
    assert "movie" in types


def test_decide_movies_only_filter():
    items = recommender.decide_for_me(KNOWN_USER, k=8, content_types=["movie"])["items"]
    assert all(i["content_type"] == "movie" for i in items)


def test_decide_random_returns_one_movie():
    items = recommender.decide_for_me(
        KNOWN_USER, k=1, content_types=["movie"], randomize=True,
    )["items"]
    assert len(items) == 1
    assert items[0]["content_type"] == "movie"


def test_decide_cold_start_unknown_user():
    result = recommender.decide_for_me("ghost_user", k=8, content_types=["movie"])
    assert result["status"] == "cold_start"
    assert len(result["items"]) == 8


def test_preference_sports_returns_matches():
    items = recommender.recommend_by_preference(genre="Sports", k=8)["items"]
    assert items
    assert items[0]["content_type"] == "sport"


def test_preference_news_shows_only():
    items = recommender.recommend_by_preference(
        genre="News", content_types=["show"], k=5
    )["items"]
    assert items
    assert all(i["content_type"] == "show" for i in items)
    assert all(i.get("channel") for i in items)


def test_preference_duration_cap():
    items = recommender.recommend_by_preference(genre="Sci-Fi", duration=120, k=8)["items"]
    for item in items:
        if item["runtime_minutes"] is not None:
            assert item["runtime_minutes"] <= 120


def test_preference_mood_returns_results():
    items = recommender.recommend_by_preference(mood="intense", k=8)["items"]
    assert len(items) == 8


def test_preference_topic_matches_animals_without_unrelated_fill():
    items = recommender.recommend_by_preference(
        query="animals", content_types=["movie"], k=8,
    )["items"]
    assert items
    returned = {item["title"] for item in items}
    matching = recommender._filter_search_text(
        recommender.get_catalog(), recommender._topic_to_terms("animals"),
    )
    assert returned <= set(matching["title"])


def test_unknown_genre_is_treated_as_a_topic():
    items = recommender.recommend_by_preference(
        genre="maze", content_types=["movie"], k=8,
    )["items"]
    assert items
    assert any("Maze" in item["title"] for item in items)


def test_preference_genre_mapping_scifi():
    # Persona genre 'Sci-Fi' should map onto TMDB 'Science Fiction'.
    items = recommender.recommend_by_preference(
        genre="Sci-Fi", content_types=["movie"], k=5
    )["items"]
    assert items
    assert any("Science Fiction" in i["genres"] for i in items)


def test_room_merges_participants():
    result = recommender.recommend_for_room(
        [{"user_id": KNOWN_USER}, {"genre": "Sci-Fi"}, {"genre": "Sports"}], k=8
    )
    assert result["status"] == "success"
    assert len(result["items"]) == 8
    assert result["merged_genre_weights"]


def test_room_uses_tightest_duration():
    result = recommender.recommend_for_room(
        [{"genre": "Action", "duration": 150}, {"genre": "Comedy", "duration": 90}], k=8
    )
    assert result["max_runtime"] == 90
    for item in result["items"]:
        if item["runtime_minutes"] is not None:
            assert item["runtime_minutes"] <= 90


def test_room_content_types_filter():
    result = recommender.recommend_for_room(
        [{"genre": "Sports"}], content_types=["sport"], k=5
    )
    assert all(i["content_type"] == "sport" for i in result["items"])


def test_sport_item_shape():
    item = recommender.recommend_by_preference(
        genre="Sports", content_types=["sport"], k=1
    )["items"][0]
    assert item["content_type"] == "sport"
    assert item["home_team"] and item["away_team"]
    assert set(item["broadcasters"]) == {"UK", "ES", "IT", "US"}


def test_show_item_shape():
    item = recommender.recommend_by_preference(
        genre="News", content_types=["show"], k=1
    )["items"][0]
    assert item["content_type"] == "show"
    assert item["channel"]
    assert item["start_time"] and item["end_time"]


def test_movie_item_includes_available_artwork():
    items = recommender.recommend_by_preference(content_types=["movie"], k=20)["items"]
    assert any(item.get("poster_path") or item.get("backdrop_path") for item in items)

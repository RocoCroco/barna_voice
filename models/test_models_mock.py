# models/test_models_mock.py
# Runs the trained models against hand-written mock requests.
import joblib
import pandas as pd

MOCK_REQUESTS = [
    {"user_id": "user_1_cinephile", "hour": 22, "day_of_week": "Sunday", "app": "Criterion"},
    {"user_id": "user_2_skipper", "hour": 9, "day_of_week": "Monday", "app": "Netflix"},
    {"user_id": "user_3_morning_parent", "hour": 8, "day_of_week": "Saturday", "app": "YouTube Kids"},
    {"user_id": "user_4_anime_fan", "hour": 1, "day_of_week": "Wednesday", "app": "Crunchyroll"},
    {"user_id": "user_5_comfort_watcher", "hour": 20, "day_of_week": "Thursday", "app": "Hulu"},
    {"user_id": "user_unknown", "hour": 12, "day_of_week": "Friday", "app": "Netflix"},
]


def encode(encoder, value):
    """Returns the encoded value, or None when the label was never seen in training."""
    if value not in encoder.classes_:
        return None
    return int(encoder.transform([value])[0])


def test_predict_genre(request):
    model = joblib.load("predict_genre_model.pkl")
    user_encoder = joblib.load("predict_genre_user_encoder.pkl")
    app_encoder = joblib.load("predict_genre_app_encoder.pkl")
    day_encoder = joblib.load("predict_genre_day_encoder.pkl")

    user = encode(user_encoder, request["user_id"])
    app = encode(app_encoder, request["app"])
    day = encode(day_encoder, request["day_of_week"])
    if None in (user, app, day):
        return "cold_start (unseen label)", None

    features = pd.DataFrame(
        [[user, request["hour"], day, app]],
        columns=["user_encoded", "hour", "day_encoded", "app_encoded"],
    )
    probabilities = model.predict_proba(features)[0]
    return model.predict(features)[0], max(probabilities)


def test_predict_movie(request, genre):
    model = joblib.load("predict_movie_model.pkl")
    user_encoder = joblib.load("predict_movie_user_encoder.pkl")
    genre_encoder = joblib.load("predict_movie_genre_encoder.pkl")

    user = encode(user_encoder, request["user_id"])
    genre_encoded = encode(genre_encoder, genre)
    if None in (user, genre_encoded):
        return "cold_start (unseen label)", None

    features = pd.DataFrame(
        [[user, genre_encoded, request["hour"]]],
        columns=["user_encoded", "genre_encoded", "hour"],
    )
    probabilities = model.predict_proba(features)[0]
    return model.predict(features)[0], max(probabilities)


def test_predict_user_preference(request):
    model = joblib.load("predict_user_preference_model.pkl")
    user_encoder = joblib.load("predict_user_preference_user_encoder.pkl")
    day_encoder = joblib.load("predict_user_preference_day_encoder.pkl")

    user = encode(user_encoder, request["user_id"])
    day = encode(day_encoder, request["day_of_week"])
    if None in (user, day):
        return "cold_start (unseen label)", None

    features = pd.DataFrame(
        [[user, request["hour"], day]],
        columns=["user_encoded", "hour", "day_encoded"],
    )
    probabilities = model.predict_proba(features)[0]
    return model.predict(features)[0], max(probabilities)


def format_result(prediction, confidence):
    if confidence is None:
        return prediction
    return f"{prediction} (p={confidence:.2f})"


def main():
    for request in MOCK_REQUESTS:
        print(
            f"\n{request['user_id']} | {request['day_of_week']} {request['hour']}:00 "
            f"| app={request['app']}"
        )
        genre, genre_confidence = test_predict_genre(request)
        print(f"  predict_genre           -> {format_result(genre, genre_confidence)}")

        preference, preference_confidence = test_predict_user_preference(request)
        print(
            "  predict_user_preference -> "
            f"{format_result(preference, preference_confidence)}"
        )

        target_genre = genre if genre_confidence is not None else preference
        movie, movie_confidence = test_predict_movie(request, target_genre)
        print(f"  predict_movie           -> {format_result(movie, movie_confidence)}")


if __name__ == "__main__":
    main()

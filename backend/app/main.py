from pathlib import Path
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd

from db import database
from recommender import recommender

app = FastAPI(title="CTV ML Recommender")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Profile-Id"],
)

BASE_DIR = Path(__file__).resolve().parents[1] / "models"

# Each model is a bundle: the classifier plus the LabelEncoders it needs.
MODEL_SPECS = {
    "predict_genre": {
        "model": "predict_genre_model.pkl",
        "encoders": {
            "user": "predict_genre_user_encoder.pkl",
            "app": "predict_genre_app_encoder.pkl",
            "day": "predict_genre_day_encoder.pkl",
        },
    },
    "predict_user_preference": {
        "model": "predict_user_preference_model.pkl",
        "encoders": {
            "user": "predict_user_preference_user_encoder.pkl",
            "day": "predict_user_preference_day_encoder.pkl",
        },
    },
    "predict_movie": {
        "model": "predict_movie_model.pkl",
        "encoders": {
            "user": "predict_movie_user_encoder.pkl",
            "genre": "predict_movie_genre_encoder.pkl",
        },
    },
}

LOADED: dict[str, dict] = {}


@app.on_event("startup")
def load_ml_assets():
    database.init_db()
    for name, spec in MODEL_SPECS.items():
        try:
            bundle = {"model": joblib.load(BASE_DIR / spec["model"])}
            for key, filename in spec["encoders"].items():
                bundle[key] = joblib.load(BASE_DIR / filename)
            LOADED[name] = bundle
            print(f"Loaded model '{name}'.")
        except FileNotFoundError:
            print(f"Warning: model '{name}' not found. Run models/train_models.py first.")


def _require(name: str) -> dict:
    if name not in LOADED:
        raise HTTPException(
            status_code=503,
            detail=f"Model '{name}' is not available. Train it with models/train_models.py.",
        )
    return LOADED[name]


def _encode(encoder, value):
    """Encodes a label, or returns None when it was never seen during training."""
    if value is None or value not in encoder.classes_:
        return None
    return int(encoder.transform([value])[0])


def _resolve_time(hour: Optional[int], day_of_week: Optional[str], iso: Optional[str] = None):
    if iso:
        moment = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    else:
        moment = datetime.utcnow()
    resolved_hour = hour if hour is not None else moment.hour
    resolved_day = day_of_week or moment.strftime("%A")
    return resolved_hour, resolved_day


def _run(bundle: dict, features: pd.DataFrame):
    model = bundle["model"]
    probabilities = model.predict_proba(features)[0]
    return model.predict(features)[0], float(max(probabilities))


# --- Inference helpers -------------------------------------------------------

def infer_genre(user_id: str, hour: int, day_of_week: str, app: str):
    bundle = _require("predict_genre")
    user = _encode(bundle["user"], user_id)
    app_code = _encode(bundle["app"], app)
    day = _encode(bundle["day"], day_of_week)
    if None in (user, app_code, day):
        return None, None
    features = pd.DataFrame(
        [[user, hour, day, app_code]],
        columns=["user_encoded", "hour", "day_encoded", "app_encoded"],
    )
    return _run(bundle, features)


def infer_preference(user_id: str, hour: int, day_of_week: str):
    bundle = _require("predict_user_preference")
    user = _encode(bundle["user"], user_id)
    day = _encode(bundle["day"], day_of_week)
    if None in (user, day):
        return None, None
    features = pd.DataFrame(
        [[user, hour, day]],
        columns=["user_encoded", "hour", "day_encoded"],
    )
    return _run(bundle, features)


def infer_movie(user_id: str, genre: str, hour: int):
    bundle = _require("predict_movie")
    user = _encode(bundle["user"], user_id)
    genre_code = _encode(bundle["genre"], genre)
    if None in (user, genre_code):
        return None, None
    features = pd.DataFrame(
        [[user, genre_code, hour]],
        columns=["user_encoded", "genre_encoded", "hour"],
    )
    return _run(bundle, features)


# --- Request models ----------------------------------------------------------

class GenreRequest(BaseModel):
    user_id: str
    app: str
    hour: Optional[int] = None
    day_of_week: Optional[str] = None


class PreferenceRequest(BaseModel):
    user_id: str
    hour: Optional[int] = None
    day_of_week: Optional[str] = None


class MovieRequest(BaseModel):
    user_id: str
    genre: str
    hour: Optional[int] = None


class RecommendRequest(BaseModel):
    user_id: str
    app: Optional[str] = None
    hour: Optional[int] = None
    day_of_week: Optional[str] = None


class SlngToolRequest(BaseModel):
    user_id: str
    current_time_iso: Optional[str] = None


class DecideRequest(BaseModel):
    user_id: str
    count: int = 8
    content_types: Optional[list[str]] = None  # movie | show | sport


class PreferenceContentRequest(BaseModel):
    genre: Optional[str] = None
    duration: Optional[int] = None  # max runtime in minutes
    mood: Optional[str] = None
    count: int = 8
    content_types: Optional[list[str]] = None  # movie | show | sport


class RoomParticipant(BaseModel):
    user_id: Optional[str] = None
    genre: Optional[str] = None
    duration: Optional[int] = None
    mood: Optional[str] = None


class RoomRequest(BaseModel):
    participants: list[RoomParticipant]
    count: int = 8
    content_types: Optional[list[str]] = None  # movie | show | sport


# --- Meta / data endpoints ---------------------------------------------------

@app.get("/")
def root():
    return {
        "service": "CTV ML Recommender",
        "models_loaded": sorted(LOADED.keys()),
        "endpoints": [
            "GET /api/users",
            "GET /api/genres",
            "GET /api/catalog/genres",
            "GET /api/logs",
            "GET /api/stats/{user_id}",
            "POST /api/predict/genre",
            "POST /api/predict/user-preference",
            "POST /api/predict/movie",
            "POST /api/recommend",
            "POST /api/content/decide",
            "POST /api/content/preference",
            "POST /api/content/room",
        ],
    }


@app.get("/api/users")
def list_users():
    return {"users": database.get_distinct_users()}


@app.get("/api/genres")
def list_genres():
    return {"genres": database.get_distinct_genres()}


@app.get("/api/catalog/genres")
def list_catalog_genres():
    return {"genres": recommender.catalog_genres()}


@app.get("/api/logs")
def list_logs(
    user_id: Optional[str] = Query(None, description="Filter by user_id"),
    genre: Optional[str] = Query(None, description="Filter by genre"),
    action_type: Optional[str] = Query(None, description="Filter by action_type"),
    limit: int = Query(100, ge=1, le=1000),
):
    logs = database.query_logs(
        user_id=user_id, genre=genre, action_type=action_type, limit=limit
    )
    return {"count": len(logs), "logs": logs}


@app.get("/api/stats/{user_id}")
def user_stats(user_id: str):
    stats = database.get_user_genre_stats(user_id)
    if not stats:
        raise HTTPException(status_code=404, detail=f"No completed history for '{user_id}'.")
    return {"user_id": user_id, "genre_breakdown": stats}


# --- Model endpoints ---------------------------------------------------------

@app.post("/api/predict/genre")
def predict_genre(req: GenreRequest):
    hour, day = _resolve_time(req.hour, req.day_of_week)
    genre, confidence = infer_genre(req.user_id, hour, day, req.app)
    if genre is None:
        return {"status": "cold_start", "predicted_genre": "Action",
                "reason": "Unseen user/app/day, reverting to popular catalog."}
    return {"status": "success", "user_id": req.user_id, "context_hour": hour,
            "day_of_week": day, "predicted_genre": genre, "confidence": confidence}


@app.post("/api/predict/user-preference")
def predict_user_preference(req: PreferenceRequest):
    hour, day = _resolve_time(req.hour, req.day_of_week)
    genre, confidence = infer_preference(req.user_id, hour, day)
    if genre is None:
        return {"status": "cold_start", "predicted_genre": "Action",
                "reason": "Unseen user, reverting to popular catalog."}
    return {"status": "success", "user_id": req.user_id, "context_hour": hour,
            "day_of_week": day, "predicted_genre": genre, "confidence": confidence}


@app.post("/api/predict/movie")
def predict_movie(req: MovieRequest):
    hour, _ = _resolve_time(req.hour, None)
    title, confidence = infer_movie(req.user_id, req.genre, hour)
    if title is None:
        return {"status": "cold_start",
                "reason": "Unseen user/genre combination."}
    return {"status": "success", "user_id": req.user_id, "genre": req.genre,
            "context_hour": hour, "predicted_title": title, "confidence": confidence}


@app.post("/api/recommend")
def recommend(req: RecommendRequest):
    """Full pipeline: pick a genre for the user's context, then a movie for it."""
    hour, day = _resolve_time(req.hour, req.day_of_week)

    # Prefer contextual genre (needs an app); fall back to time-only preference.
    genre, genre_confidence = (None, None)
    source = None
    if req.app:
        genre, genre_confidence = infer_genre(req.user_id, hour, day, req.app)
        source = "predict_genre"
    if genre is None:
        genre, genre_confidence = infer_preference(req.user_id, hour, day)
        source = "predict_user_preference"

    if genre is None:
        return {"status": "cold_start", "predicted_genre": "Action",
                "recommended_title": None,
                "reason": "Unseen user, reverting to popular catalog."}

    title, title_confidence = infer_movie(req.user_id, genre, hour)
    return {
        "status": "success",
        "user_id": req.user_id,
        "context_hour": hour,
        "day_of_week": day,
        "genre_source": source,
        "predicted_genre": genre,
        "genre_confidence": genre_confidence,
        "recommended_title": title,
        "title_confidence": title_confidence,
    }


@app.post("/api/tool/predict-genre")
def slng_predict_genre(req: SlngToolRequest):
    """SLNG voice tool: time + user only, no interaction (predict_user_preference)."""
    hour, day = _resolve_time(None, None, req.current_time_iso)
    genre, confidence = infer_preference(req.user_id, hour, day)
    if genre is None:
        return {"status": "cold_start", "predicted_genre": "Action",
                "reason": "New user, reverting to popular catalog."}
    return {"status": "success", "user_id": req.user_id, "context_hour": hour,
            "predicted_genre": genre, "confidence": confidence}


# --- Content recommendation (8-item lists over the movie catalog) ------------

@app.post("/api/content/decide")
def content_decide(req: DecideRequest):
    """'Decide for me': choose content from the user's own logs."""
    return recommender.decide_for_me(
        req.user_id, k=req.count, content_types=req.content_types
    )


@app.post("/api/content/preference")
def content_preference(req: PreferenceContentRequest):
    """User states genre / duration / mood; propose matching content."""
    return recommender.recommend_by_preference(
        genre=req.genre, duration=req.duration, mood=req.mood,
        k=req.count, content_types=req.content_types,
    )


@app.post("/api/content/room")
def content_room(req: RoomRequest):
    """Room mode: merge every participant's preferences into one shared list."""
    if not req.participants:
        raise HTTPException(status_code=400, detail="At least one participant is required.")
    participants = [p.model_dump() for p in req.participants]
    return recommender.recommend_for_room(
        participants, k=req.count, content_types=req.content_types
    )
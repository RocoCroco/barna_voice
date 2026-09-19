# Backend

The backend is a FastAPI service that provides catalogue data, activity
logging and ML-based recommendations for Compass. It is the "Product backend"
box in the architecture diagram in the [README](./README.md#architecture): the
voice agent and frontend will call it over HTTP once the integration lands.

## Responsibilities

- Store and query viewer activity logs (what was watched, skipped, completed).
- Serve a unified content catalogue: movies, TV schedule shows and live
  football matches.
- Train and serve three small ML models that predict genre/movie preference
  from user history and context (time of day, day of week, app).
- Produce ranked recommendation lists for three modes: "decide for me",
  explicit preference (genre/duration/mood), and shared "room" mode across
  multiple participants.

## Directory layout

```text
backend/
  app/
    main.py                FastAPI routes and startup/model loading
  db/
    database.py            SQLite access layer
    seed_db.py             Loads the activity seed into SQLite
    tv_logs.db             Generated database (ignored by Git)
  recommender/
    recommender.py         Catalog loading, filtering and ranking logic
  data/
    data_generation.py     Generates mock activity logs / datasets
    movie_dataset.csv      Sample movie catalog data
    tv_schedule.csv        TV channel programming schedule
    matchday.csv           Live football fixtures
    tv_logs.json           Mock activity log seed data
  requirements.txt         Python dependencies
  pytest.ini               Discovers automated tests under tests/
  models/
    train_models.py        Runs every model-training script in this folder
    predict_genre.py        Trains the genre-prediction model
    predict_movie.py        Trains the movie-prediction model
    predict_user_preference.py  Trains the context-only preference model
    README.md               One-line description of each of the 3 models
    test_models_mock.py      Standalone mock inference check (not a pytest suite)
    *.pkl                   Generated model/encoder bundles (ignored by Git)
  tests/
    conftest.py
    test_api.py             Endpoint tests (FastAPI TestClient)
    test_database.py        SQLite layer tests
    test_recommender.py     Catalog/ranking logic tests
```

## Data model

`db/database.py` manages a single SQLite database, `db/tv_logs.db`, with one table:

```sql
activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  metadata TEXT NOT NULL   -- JSON blob (e.g. genre, title, duration)
)
```

An index on `(user_id, timestamp DESC)` keeps per-user history lookups fast for
the LLM/recommendation context. `db/seed_db.py` loads the mock events in
`data/tv_logs.json` into this table for local development.

## Catalog

`recommender/recommender.py` builds one unified catalog `DataFrame` (cached with
`lru_cache`) by normalizing three sources into a common shape
(`content_type`, `title`, `genres`, `runtime`, `rank_score`, `search_text`,
plus type-specific fields):

| Source | File | `content_type` | Ranking |
| --- | --- | --- | --- |
| Movies | `data/movie_dataset.csv` | `movie` | `vote_count` |
| TV shows | `data/tv_schedule.csv` | `show` | fixed high score (always near top) |
| Football | `data/matchday.csv` | `sport` | fixed highest score (always top) |

Genre and mood are mapped to catalog terms via `GENRE_MAP` and `MOOD_TERMS`,
so persona/log genres (e.g. `Sci-Fi`, `Indie`) and free-text moods (e.g.
`cozy`, `intense`) resolve to actual catalog genres or search keywords.

Data, database and model paths resolve from their source files, independently of
the working directory. The catalogue uses the movie dataset shipped in this repo.

## ML models

Three scikit-learn classifiers live in `backend/models/`, trained from
`db/tv_logs.db` history and loaded by `app/main.py` at startup (see
[models/README.md](./backend/models/README.md)):

| Model | Predicts | Inputs |
| --- | --- | --- |
| `predict_genre` | Genre | user, hour, day of week, app |
| `predict_user_preference` | Genre | user, hour, day of week (no interaction/app needed) |
| `predict_movie` | Movie title | user, genre, hour |

Each model is saved as a `.pkl` bundle (classifier + `LabelEncoder`s for its
categorical inputs). Train (or retrain) all of them with:

```bash
python backend/models/train_models.py
```

This runs every training script in `models/`, reading `db/tv_logs.db` and writing
the classifier and encoder bundles to `models/`. If a `.pkl` file is missing,
`app/main.py` logs a
warning at startup and the corresponding endpoints return `503`. Unseen
users/genres/apps fall back to a `cold_start` response recommending the
`Action` genre.

## API

`app/main.py` exposes:

**Meta / data**
- `GET /` — service info and loaded models.
- `GET /api/users` — distinct user IDs seen in the logs.
- `GET /api/genres` — distinct genres seen in the logs.
- `GET /api/catalog/genres` — distinct genres across the full catalog.
- `GET /api/logs` — activity logs, filterable by `user_id`, `genre`, `action_type`.
- `GET /api/stats/{user_id}` — a user's completed-content genre breakdown.

**ML predictions**
- `POST /api/predict/genre` — genre prediction from user + app + time.
- `POST /api/predict/user-preference` — genre prediction from user + time only.
- `POST /api/predict/movie` — movie title prediction from user + genre + time.
- `POST /api/recommend` — full pipeline (genre, then movie), preferring the
  app-aware model and falling back to the time-only one.
- `POST /api/tool/predict-genre` — SLNG/voice-agent tool variant: only
  `user_id` and `current_time_iso` are required.

**Content recommendation lists (used by the frontend catalogue/UI)**
- `POST /api/content/decide` — "decide for me": ranks the unified catalog by
  the user's learned genre weights from their own history.
- `POST /api/content/preference` — ranks the catalog by an explicit
  genre/duration/mood the user states out loud.
- `POST /api/content/room` — merges multiple participants' preferences
  (by user history and/or stated genre) into one shared ranked list,
  respecting the tightest duration constraint.

All three content endpoints accept an optional `content_types` filter
(`movie`, `show`, `sport`) and return a `k`-sized (default 8) list of items,
each tagged with its `content_type` and type-specific fields (e.g. `channel`
and `start_time` for shows, `league` and `broadcasters` for sport matches).

Profiles in the frontend are these `/api/users` usernames: both profile `id` and
`name` equal the username. Subsequent frontend API requests carry that username
as `X-Profile-Id`; recommendation requests requiring `user_id` must also include
it in their JSON body. There is no separate profiles resource. Development CORS
allows `http://localhost:5173`, including the profile header. Set frontend
`VITE_API_URL=http://localhost:8000`; provider credentials stay on the server.

## Run locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m db.database             # initialize and import seed with original timestamps
python models/train_models.py     # optional: train the ML models
uvicorn app.main:app --reload --port 8000
```

## Tests

```bash
cd backend
python -m db.database             # once on a fresh checkout, before training
python models/train_models.py
pytest
python models/test_models_mock.py # standalone inference check
```

Import the seed only once per database; repeating it inserts duplicate events.
`python -m db.seed_db` is the alternative seed command that assigns current
timestamps, retaining its previous behaviour. Automated tests expect a seeded
database and trained models. Pytest discovery excludes the standalone manual
inference script in `models/`.

`tests/test_api.py`, `tests/test_database.py` and `tests/test_recommender.py`
cover the HTTP endpoints, the SQLite access layer and the catalog/ranking
logic respectively.

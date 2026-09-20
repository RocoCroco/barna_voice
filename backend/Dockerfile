# syntax=docker/dockerfile:1
FROM python:3.12.12-slim-bookworm AS build
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.lock ./
RUN python -m venv /opt/venv && \
    /opt/venv/bin/pip install --require-hashes -r requirements.lock
ENV PATH="/opt/venv/bin:$PATH"
COPY app/ ./app/
COPY db/ ./db/
COPY models/ ./models/
COPY recommender/ ./recommender/
COPY data/ ./data/
RUN python -m db.database && \
    python models/train_models.py && \
    python -c "from app.main import load_ml_assets, LOADED, MODEL_SPECS; load_ml_assets(); assert set(LOADED) == set(MODEL_SPECS)"

FROM python:3.12.12-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    COMPASS_DB_PATH=/data/tv_logs.db
WORKDIR /app
RUN useradd --uid 10001 --create-home compass && \
    mkdir /data && chown compass:compass /data
COPY --from=build /opt/venv /opt/venv
COPY app/ ./app/
COPY db/ ./db/
COPY recommender/ ./recommender/
COPY data/ ./data/
COPY --from=build /app/models/*.pkl ./models/
COPY --chmod=755 entrypoint.sh /usr/local/bin/compass-backend
USER compass
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 \
    CMD python -c "import json, urllib.request; data=json.load(urllib.request.urlopen('http://127.0.0.1:8000/', timeout=3)); assert len(data['models_loaded']) == 3; urllib.request.urlopen('http://127.0.0.1:8000/api/users', timeout=3)"
ENTRYPOINT ["compass-backend"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

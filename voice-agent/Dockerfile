# syntax=docker/dockerfile:1
FROM ghcr.io/astral-sh/uv:0.10.12 AS uv
FROM python:3.12.12-slim-bookworm AS build
ARG TARGETARCH
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    NLTK_DATA=/opt/nltk_data
COPY --from=uv /uv /usr/local/bin/uv
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
RUN case "$TARGETARCH" in \
      amd64) checksum=49a8d7a78e7cd680e1140573013ba1bf865283c4c0e816cd7739152d5f554b92 ;; \
      arm64) checksum=4525dddcacb882920a426fbf2da9982bf777b84043a4f3322ae36ac41c91dcfe ;; \
      *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac && \
    curl -fsSL "https://github.com/slng-ai/unmute/releases/download/v0.4.2/unmute_0.4.2_linux_${TARGETARCH}.tar.gz" -o /opt/unmute.tar.gz && \
    echo "$checksum  /opt/unmute.tar.gz" | sha256sum -c - && \
    tar -xzf /opt/unmute.tar.gz -C /usr/local/bin unmute && rm /opt/unmute.tar.gz
WORKDIR /source
COPY requirements.lock ./
RUN uv venv /opt/venv && \
    uv pip sync --python /opt/venv/bin/python --require-hashes requirements.lock
ENV PATH="/opt/venv/bin:$PATH"
RUN python -c "import nltk; nltk.download('punkt_tab', download_dir='/opt/nltk_data', raise_on_error=True); nltk.data.find('tokenizers/punkt_tab')" && \
    python -c "from pipecat.audio.vad.silero import SileroVADAnalyzer; from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3; SileroVADAnalyzer(); LocalSmartTurnAnalyzerV3()"
COPY agent.yaml targets.yaml instructions.md run.py ./
COPY tools/ ./tools/
COPY runtime/ ./runtime/
COPY scripts/ ./scripts/
RUN python run.py --compile-only && \
    uv pip check --python /opt/venv/bin/python

FROM python:3.12.12-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    NLTK_DATA=/opt/nltk_data
RUN useradd --uid 10001 --create-home compass
WORKDIR /app
COPY --from=build /opt/venv /opt/venv
COPY --from=build /opt/nltk_data /opt/nltk_data
COPY --from=build /source/build/pipecat/bot.py /source/build/pipecat/dev_metrics.py \
    /source/build/pipecat/compass_session.py /source/build/pipecat/slng_stt_batched.py ./
COPY --from=build /source/build/pipecat/tools/ ./tools/
USER compass
EXPOSE 7860
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=6 \
    CMD python -c "import json, urllib.request; data=json.load(urllib.request.urlopen('http://127.0.0.1:7860/status', timeout=3)); assert data['status'] == 'ready' and data['transports'] == ['webrtc']"
CMD ["python", "bot.py", "--transport", "webrtc", "--host", "0.0.0.0", "--port", "7860"]

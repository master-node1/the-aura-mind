# ─────────────────────────────────────────────────────────────────────────────
# ai-service — Python (FastAPI + uvicorn) Redis-pub/sub worker + HTTP /health.
# Multi-stage to keep build tools (gcc, libffi, etc.) out of the runtime image.
# ─────────────────────────────────────────────────────────────────────────────

# ---------- Stage 1: build deps ----------
FROM python:3.11-slim AS builder

# chromadb + scikit-learn need OpenBLAS, build tools, and OpenSSL at build time.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        g++ \
        libffi-dev \
        libssl-dev \
        libopenblas-dev \
        curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps into a relocatable prefix we can copy to the runner.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt


# ---------- Stage 2: runtime ----------
FROM python:3.11-slim AS runner

# Runtime shared libs for chromadb/scikit-learn (no compilers).
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libopenblas0 \
        libssl3 \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Non-root runtime user
RUN groupadd --system app && useradd --system --gid app --home /app --shell /sbin/nologin app

WORKDIR /app

# Bring in the pre-built Python packages
COPY --from=builder /install /usr/local

# Application code (layered: small/frequent files last for cache reuse)
COPY --chown=app:app main.py ./
COPY --chown=app:app config.py ./
COPY --chown=app:app pipeline.py ./
COPY --chown=app:app agents ./agents
COPY --chown=app:app services ./services

USER app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request,sys; \
        sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:3000/health', timeout=3).status == 200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000", "--workers", "1"]

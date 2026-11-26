FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    SQLITE_PATH=/data/terminal.db

WORKDIR /app

RUN addgroup --system appgroup \
    && adduser --system --ingroup appgroup --no-create-home appuser \
    && mkdir -p /data \
    && chown -R appuser:appgroup /app /data

COPY backend/pyproject.toml ./
COPY backend/app ./app

RUN pip install --upgrade pip \
    && pip install . \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; r = urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=4); assert r.status == 200"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

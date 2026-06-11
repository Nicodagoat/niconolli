FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TZ=Europe/Rome \
    PLAYWRIGHT_BROWSERS_PATH=/pw-browsers

WORKDIR /app

# Dipendenze sistema per Playwright/Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libpangocairo-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    playwright install chromium

COPY main.py .
COPY src/ src/
COPY scripts/ scripts/

RUN mkdir -p data/ics logs secrets

VOLUME ["/app/data", "/app/logs", "/app/secrets"]

CMD ["python", "main.py"]

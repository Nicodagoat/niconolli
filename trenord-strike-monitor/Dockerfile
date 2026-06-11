FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TZ=Europe/Rome

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY src/ src/
COPY scripts/ scripts/

RUN mkdir -p data/ics logs secrets

VOLUME ["/app/data", "/app/logs", "/app/secrets"]

CMD ["python", "main.py"]

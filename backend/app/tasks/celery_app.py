from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "ghg_emissions",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "update-emission-factors": {
            "task": "app.tasks.factor_tasks.update_emission_factors",
            "schedule": crontab(
                hour=settings.FACTOR_UPDATE_CRON_HOUR,
                minute=settings.FACTOR_UPDATE_CRON_MINUTE,
                day_of_week="1",  # Weekly on Monday
            ),
        },
    },
)

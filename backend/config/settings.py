import os
from pathlib import Path

from .config import CVE_LOOKBACK_MIN, CVE_POLL_SEC, VM_SCAN_SEC

BASE_DIR = Path(__file__).resolve().parent.parent

# ponytail: dashboard is localhost-only (compose binds 127.0.0.1), so a dev default key is acceptable; set DJANGO_SECRET_KEY otherwise
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-not-secret")
DEBUG = False
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

INSTALLED_APPS = ["eleven0zero"]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # serves the built React app from /static
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3",
                         "NAME": os.getenv("DB_PATH", BASE_DIR / "eleven0zero.sqlite3"),
                         "OPTIONS": {"timeout": 30, "init_command": "PRAGMA journal_mode=WAL"}}}  # web + workers write concurrently
# ponytail: SQLite with several writer processes is the ceiling; move to Postgres if contention shows

WHITENOISE_ROOT = BASE_DIR / "static"
WHITENOISE_INDEX_FILE = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.AutoField"

# Celery + Redis: replays, new-CVE evaluation, remediation. CELERY_EAGER=1 runs tasks inline (no Redis needed locally).
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
CELERY_TASK_ALWAYS_EAGER = os.getenv("CELERY_EAGER") == "1"
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_ROUTES = {"eleven0zero.tasks.remediate_finding": {"queue": "remediation"}}
CELERY_BEAT_SCHEDULE = {"watch-feed": {"task": "eleven0zero.tasks.watch_feed", "schedule": float(CVE_POLL_SEC)}}

import sys

from django.apps import AppConfig


class Eleven0zeroConfig(AppConfig):
    name = "eleven0zero"

    def ready(self):
        # only the real server runs the feed watcher / inventory loops (not migrate, test, shell...)
        # ponytail: needs a single process, so run `runserver --noreload`; use a management command + gunicorn if you scale out
        if "runserver" in sys.argv:
            from . import engine
            engine.start()

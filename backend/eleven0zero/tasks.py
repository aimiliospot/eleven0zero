from celery import shared_task

from . import engine
from .models import Cve


@shared_task
def evaluate_cve(cve_id):
    engine.evaluate(Cve.objects.get(id=cve_id).record)


@shared_task
def replay_cve(cve_id):
    if engine.replay(cve_id):
        evaluate_cve.delay(cve_id)


@shared_task
def watch_feed():
    for cve_id in engine.new_cve_ids():
        evaluate_cve.delay(cve_id)


@shared_task
def remediate_finding(cve_id, host):  # routed to the single-concurrency "remediation" queue
    engine.remediate(cve_id, host)

from celery import chord, shared_task

from . import engine
from .models import Cve


@shared_task
def evaluate_cve(cve_id):
    """Fan out one evaluate_host task per VM; finish_cve runs once all of them are done."""
    hosts = engine.start_evaluation(Cve.objects.get(id=cve_id).record)
    if hosts:
        chord(evaluate_host.si(cve_id, h) for h in hosts)(finish_cve.si(cve_id))


@shared_task
def evaluate_host(cve_id, host):
    engine.evaluate_host(Cve.objects.get(id=cve_id).record, host)


@shared_task
def finish_cve(cve_id):
    engine.finish_evaluation(cve_id)


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

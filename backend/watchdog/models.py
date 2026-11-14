from django.db import models
from django.utils import timezone


class Setting(models.Model):
    """Singleton (pk=1). API keys are not stored here: they come from GOOGLE_API_KEY / VENICE_API_KEY."""
    remediation_model = models.CharField(max_length=72, blank=True)  # writes the fix commands run on the snapshot clone; empty -> first of models
    exploitation_model = models.CharField(max_length=72, blank=True)  # writes the exploit PoC run against the patched clone; empty -> VENICE_MODEL
    models = models.JSONField(default=list)  # model ids to ask ("venice:" prefix -> Venice AI); empty -> GEMINI_MODEL env default
    # ponytail: remediation_model and exploitation_model must stay above `models`, the field name shadows the django module in this class body


class Vm(models.Model):
    host = models.CharField(max_length=255, primary_key=True)
    collected_at = models.DateTimeField(null=True)
    inventory = models.JSONField(null=True)
    error = models.TextField(null=True)


class Cve(models.Model):
    id = models.CharField(max_length=32, primary_key=True)
    published = models.CharField(max_length=40, null=True)
    title = models.TextField(blank=True)
    record = models.JSONField()
    status = models.CharField(max_length=16, default="new")  # new | skipped | evaluating | evaluated
    seen_at = models.DateTimeField(default=timezone.now)


class Finding(models.Model):
    cve = models.ForeignKey(Cve, on_delete=models.CASCADE, related_name="findings")
    vm = models.ForeignKey(Vm, on_delete=models.CASCADE, related_name="findings")  # removing a VM drops its findings
    verdict = models.CharField(max_length=16)  # affected | likely | not_affected | error
    confidence = models.FloatField(default=0)
    evidence = models.TextField(blank=True)
    actions = models.JSONField(default=list)
    votes = models.JSONField(default=list)  # per-model results behind the aggregated verdict
    remediation = models.JSONField(null=True, default=None)  # snapshot-clone fix test: {status: queued|running|passed|failed|error|skipped, ...}
    exploit = models.JSONField(null=True, default=None)  # PoC generation + verification against the patched clone
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["cve", "vm"], name="one_finding_per_cve_vm")]

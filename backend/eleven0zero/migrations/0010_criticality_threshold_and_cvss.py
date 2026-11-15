from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("eleven0zero", "0009_event"),
    ]

    operations = [
        migrations.AddField(
            model_name="setting",
            name="criticality_threshold",
            field=models.FloatField(blank=True, default=9.0, null=True),
        ),
        migrations.AddField(
            model_name="setting",
            name="shutdown_hosts",
            field=models.JSONField(blank=True, default=None, null=True),
        ),
        migrations.AddField(
            model_name="cve",
            name="cvss",
            field=models.FloatField(blank=True, null=True),
        ),
    ]

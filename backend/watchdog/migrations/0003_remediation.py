from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('watchdog', '0002_setting_finding_votes'),
    ]

    operations = [
        migrations.AddField(
            model_name='finding',
            name='remediation',
            field=models.JSONField(default=None, null=True),
        ),
        migrations.AddField(
            model_name='setting',
            name='remediation_model',
            field=models.CharField(blank=True, max_length=64),
        ),
    ]

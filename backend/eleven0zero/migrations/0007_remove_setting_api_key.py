from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('eleven0zero', '0006_remove_setting_exploit_model_and_more'),
    ]

    operations = [
        migrations.RemoveField(model_name='setting', name='api_key'),  # keys come from env only
        migrations.AlterField(model_name='setting', name='remediation_model',
                              field=models.CharField(blank=True, max_length=72)),  # room for the "venice:" prefix
    ]

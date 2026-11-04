from django.db import migrations


DRAFT_NOTICE = "**Draft — replace with Kleandeck's final terms before launch.**\n\n"
DRAFT_REFUND = "[To be confirmed by Kleandeck: notice period, refunds and fees.]"
CONFIRMED_REFUND = (
    "Payments are non-refundable once a booking is confirmed. If Kleandeck does not attend at the agreed date and time, "
    "you may choose either a rescheduled service or a refund of the affected booking payment.\n\n"
    "Contact us as soon as possible if you need to request a change. A requested reschedule is not confirmed until "
    "Kleandeck agrees the new date and time in writing."
)
DRAFT_CLAIMS = "[To be confirmed by Kleandeck: how to report an issue, time limits and liability.]"
CLAIMS_PROCESS = (
    "Report any damage or service concern promptly with your booking reference and supporting details. "
    "We will review the information and respond with the next steps."
)


def confirm_policy(apps, schema_editor):
    SiteSettings = apps.get_model("core", "SiteSettings")
    for settings in SiteSettings.objects.all():
        content = settings.terms_content or ""
        if DRAFT_REFUND not in content:
            continue
        settings.terms_content = (
            content.replace(DRAFT_NOTICE, "")
            .replace(DRAFT_REFUND, CONFIRMED_REFUND)
            .replace(DRAFT_CLAIMS, CLAIMS_PROCESS)
        )
        settings.save(update_fields=["terms_content"])


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0002_sitesettings_setup_done"),
    ]

    operations = [
        migrations.RunPython(confirm_policy, migrations.RunPython.noop),
    ]

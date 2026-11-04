from django.db import migrations


FAQ_UPDATES = [
    (
        "Which areas do you cover?",
        "We work across Lagos. Choose your area when you book. If it isn't listed, message us on WhatsApp and we'll confirm.",
        "We work across Lagos. Tell us the location on WhatsApp and we'll confirm coverage, access and any travel charge.",
    ),
    (
        "How is the price worked out?",
        "It depends on the service, the size of the space (rooms or floor area) and how often you want us. The calculator shows the full price, including VAT, before you pay.",
        "It depends on the service, the size of the space (rooms or floor area) and how often you want us. We show starting prices on the website, then confirm the final scope and VAT with you on WhatsApp.",
    ),
    (
        "Is VAT included?",
        "Prices on service cards are before VAT. 7.5% VAT is added and shown separately before you pay.",
        "Prices on service cards are before VAT. 7.5% VAT is added and shown separately in the price we confirm with you.",
    ),
    (
        "How do I pay?",
        "Standard jobs are paid online through Paystack by card, bank transfer or USSD. For custom jobs we agree the price on WhatsApp and send you a Paystack payment link.",
        "For now, we agree the service scope, final price and payment arrangement with you directly on WhatsApp.",
    ),
    (
        "What happens after I pay?",
        "You'll get a confirmation email, and our team will message you on WhatsApp to confirm who is coming and when.",
        "Once the booking and payment arrangement are confirmed, our team will message you on WhatsApp to confirm who is coming and when.",
    ),
    (
        "Can you clean outside office hours?",
        "Yes. Choose the after-hours slot when you book, or tell us your preferred time on WhatsApp.",
        "Yes. Tell us your preferred time on WhatsApp and we'll confirm the available schedule.",
    ),
]


def update_default_faq_copy(apps, schema_editor):
    FAQ = apps.get_model("core", "FAQ")
    for question, old_answer, new_answer in FAQ_UPDATES:
        FAQ.objects.filter(question=question, answer=old_answer).update(answer=new_answer)


class Migration(migrations.Migration):
    dependencies = [("core", "0003_confirm_refund_policy")]

    operations = [migrations.RunPython(update_default_faq_copy, migrations.RunPython.noop)]

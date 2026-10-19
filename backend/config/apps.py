from django.contrib.admin.apps import AdminConfig


class KleandeckAdminConfig(AdminConfig):
    default_site = "config.admin_site.KleandeckAdminSite"

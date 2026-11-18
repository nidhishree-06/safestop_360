"""WSGI config for SafeStop 360."""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "safestop.settings")
application = get_wsgi_application()

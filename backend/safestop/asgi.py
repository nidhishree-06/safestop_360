"""ASGI config for SafeStop 360."""
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "safestop.settings")
application = get_asgi_application()

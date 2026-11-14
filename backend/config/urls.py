from django.urls import path

from watchdog import views

urlpatterns = [
    path("api/state", views.state),
    path("api/hosts", views.hosts),
    path("api/settings", views.settings),
    path("api/models", views.models),
    path("api/replay/<str:cve_id>", views.replay),
]

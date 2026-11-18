"""Canonical HelpRequest state-machine service and location-ping cleanup."""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from accounts.models import Notification
from accounts.views import log_audit
from assistance.models import HelpRequest
from journeys.models import LocationPing
from safestop.exceptions import ConflictError

PENDING_EXPIRY_MINUTES = 10


def delete_request_location_data(help_request: HelpRequest) -> int:
    """Delete all LocationPing rows and clear cached coordinates for a HelpRequest."""
    deleted_count, _ = LocationPing.objects.filter(help_request=help_request).delete()
    if (
        help_request.requester_latitude is not None
        or help_request.requester_longitude is not None
        or help_request.share_live_location
    ):
        help_request.requester_latitude = None
        help_request.requester_longitude = None
        help_request.share_live_location = False
        help_request.save(
            update_fields=[
                "requester_latitude",
                "requester_longitude",
                "share_live_location",
                "updated_at",
            ]
        )
    return deleted_count


def expire_stale_pending_requests() -> int:
    """Auto-expire PENDING requests older than 10 minutes and purge their location pings."""
    now = timezone.now()
    stale = list(
        HelpRequest.objects.filter(
            status=HelpRequest.Status.PENDING,
            expires_at__isnull=False,
            expires_at__lt=now,
        )
    )
    if not stale:
        return 0
    stale_ids = [item.id for item in stale]
    LocationPing.objects.filter(help_request_id__in=stale_ids).delete()
    HelpRequest.objects.filter(id__in=stale_ids).update(
        status=HelpRequest.Status.EXPIRED,
        share_live_location=False,
        requester_latitude=None,
        requester_longitude=None,
        updated_at=now,
    )
    return len(stale_ids)


@transaction.atomic
def transition_help_request(
    help_request: HelpRequest,
    next_status: str,
    *,
    actor,
    response_note: str | None = None,
    request=None,
) -> HelpRequest:
    """Single canonical state-machine function for HelpRequest transitions.

    Enforces:
    - Strict actor permissions:
      * CANCELLED / ARRIVED -> owner (requester) only
      * ACCEPTED / DECLINED / CLOSED -> assigned partner owner only
    - Allowed transition graph (invalid transitions raise HTTP 409 Conflict)
    - Automatic deletion of all LocationPing rows on CLOSED / CANCELLED / DECLINED / EXPIRED
    """
    expire_stale_pending_requests()
    help_request.refresh_from_db()

    is_owner = help_request.requester_id == actor.id
    is_assigned_partner = help_request.partner.owner_id == actor.id

    if next_status in (HelpRequest.Status.CANCELLED, HelpRequest.Status.ARRIVED):
        if not is_owner:
            raise PermissionDenied(
                detail="Only the request owner can perform this action.",
                code="forbidden_owner_only",
            )
    elif next_status in (
        HelpRequest.Status.ACCEPTED,
        HelpRequest.Status.DECLINED,
        HelpRequest.Status.CLOSED,
    ):
        if not is_assigned_partner:
            raise PermissionDenied(
                detail="Only the assigned partner establishment can perform this action.",
                code="forbidden_partner_only",
            )
    elif next_status != HelpRequest.Status.EXPIRED:
        raise ConflictError(
            detail=f"Unsupported target status: {next_status}.",
            code="invalid_transition",
        )

    if not help_request.can_transition_to(next_status):
        raise ConflictError(
            detail=f"Invalid assistance status transition: {help_request.status} -> {next_status}.",
            code="invalid_transition",
        )

    now = timezone.now()
    help_request.status = next_status
    if response_note is not None:
        help_request.partner_response_note = response_note
    if next_status == HelpRequest.Status.ACCEPTED:
        help_request.accepted_at = now
    elif next_status == HelpRequest.Status.ARRIVED:
        help_request.arrived_at = now
    elif next_status == HelpRequest.Status.CLOSED:
        help_request.closed_at = now
    help_request.save()

    if next_status in HelpRequest.TERMINAL_STATUSES:
        delete_request_location_data(help_request)

    notify_recipient = (
        help_request.requester if is_assigned_partner else help_request.partner.owner
    )
    Notification.objects.create(
        recipient=notify_recipient,
        title=f"Assistance Request {next_status.title()}",
        body=f"Request at {help_request.partner.name} is now {next_status}.",
        category=Notification.Category.ASSISTANCE,
        metadata={"help_request_id": str(help_request.id), "status": next_status},
    )
    log_audit(
        actor=actor,
        action=f"HELP_REQUEST_{next_status}",
        target_type="HELP_REQUEST",
        target_id=str(help_request.id),
        summary=f"Transitioned request at {help_request.partner.name} to {next_status}",
        request=request,
    )
    return help_request


def default_pending_expiry():
    return timezone.now() + timedelta(minutes=PENDING_EXPIRY_MINUTES)

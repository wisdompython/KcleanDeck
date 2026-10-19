"""Team roles for the Kleandeck admin.

Owner: everything, including rates, site settings and team accounts.
Staff: bookings, cleaners and applications; can read (not change) pricing and settings.

Roles are Django groups. Superusers always count as owners.
"""

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import SAFE_METHODS, BasePermission

OWNER = "owner"
STAFF = "staff"
GROUP_NAMES = {OWNER: "Owner", STAFF: "Staff"}


def role_of(user) -> str | None:
    if not user or not user.is_authenticated or not user.is_active:
        return None
    if user.is_superuser:
        return OWNER
    names = set(user.groups.values_list("name", flat=True))
    if GROUP_NAMES[OWNER] in names:
        return OWNER
    if GROUP_NAMES[STAFF] in names:
        return STAFF
    return None


class IsTeamMember(BasePermission):
    message = "Please sign in to the Kleandeck admin."

    def has_permission(self, request, view):
        return role_of(request.user) is not None


class IsOwner(BasePermission):
    message = "Only owners can do this."

    def has_permission(self, request, view):
        return role_of(request.user) == OWNER


class OwnerCanEdit(BasePermission):
    """Any team member can read; only owners can change."""

    message = "Only owners can change this."

    def has_permission(self, request, view):
        role = role_of(request.user)
        if role is None:
            return False
        return request.method in SAFE_METHODS or role == OWNER


class TeamAPIMixin:
    """Session-authenticated (with CSRF), team members only."""

    authentication_classes = [SessionAuthentication]
    permission_classes = [IsTeamMember]

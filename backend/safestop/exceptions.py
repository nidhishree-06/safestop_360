"""Consistent JSON error responses with {"detail", "code"} shape."""

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler


class ConflictError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "The requested action conflicts with the current resource state."
    default_code = "conflict"


def safestop_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    code = getattr(exc, "default_code", "error")
    if hasattr(exc, "get_codes"):
        raw_codes = exc.get_codes()
        if isinstance(raw_codes, str):
            code = raw_codes
        elif isinstance(raw_codes, dict):
            code = "validation_error"

    data = response.data
    if isinstance(data, dict):
        if "detail" in data:
            detail_val = data["detail"]
            detail_code = getattr(detail_val, "code", None) or code
            payload = {"detail": str(detail_val), "code": str(detail_code)}
            for key, value in data.items():
                if key not in ("detail", "code"):
                    payload[key] = value
            response.data = payload
        else:
            # Field validation errors
            first_msg = "Invalid input."
            for field, msgs in data.items():
                if isinstance(msgs, list) and msgs:
                    first_msg = f"{field}: {msgs[0]}"
                    break
                if isinstance(msgs, str):
                    first_msg = f"{field}: {msgs}"
                    break
            response.data = {
                "detail": first_msg,
                "code": str(code),
                "errors": data,
            }
    elif isinstance(data, list) and data:
        response.data = {"detail": str(data[0]), "code": str(code)}
    else:
        response.data = {"detail": str(data), "code": str(code)}

    return response


def error_response(detail: str, code: str, http_status: int) -> Response:
    return Response({"detail": detail, "code": code}, status=http_status)

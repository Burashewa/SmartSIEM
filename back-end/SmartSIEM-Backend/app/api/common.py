"""Common API utilities."""

from typing import Any

from pymongo import ASCENDING, DESCENDING


def build_sort(sort: str | None, default_field: str = "timestamp") -> list[tuple[str, int]]:
    if not sort:
        return [(default_field, DESCENDING)]
    direction = DESCENDING
    field = sort
    if sort.startswith("-"):
        field = sort[1:]
        direction = DESCENDING
    elif sort.startswith("+"):
        field = sort[1:]
        direction = ASCENDING
    return [(field, direction)]


def paginated_response(data: list[dict[str, Any]], total: int, page: int, limit: int) -> dict[str, Any]:
    return {"data": data, "total": total, "page": page, "limit": limit}

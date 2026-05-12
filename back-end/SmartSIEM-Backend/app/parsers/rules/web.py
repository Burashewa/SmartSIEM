"""Web/API access log parsing rules."""

from __future__ import annotations

import re

from app.parsers.rules.base import RegexRule

_APACHE_COMBINED = re.compile(
    r"^(?P<client_ip>\S+)\s+"
    r"(?P<ident>\S+)\s+"
    r"(?P<user>\S+)\s+"
    r"\[(?P<timestamp>[^\]]+)\]\s+"
    r'"(?P<method>\S+)\s+(?P<path>\S+)\s+(?P<protocol>\S+)"\s+'
    r"(?P<status>\d+)\s+"
    r"(?P<size>-|\d+)\s+"
    r'"(?P<referer>[^"]*)"\s+'
    r'"(?P<user_agent>[^"]*)"\s*$',
)

WEB_RULES: tuple[RegexRule, ...] = (
    RegexRule("apache_combined", _APACHE_COMBINED, priority=100),
)

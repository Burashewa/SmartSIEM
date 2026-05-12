"""Parser rule exports."""

from app.parsers.rules.base import RegexRule
from app.parsers.rules.linux import LINUX_RULES
from app.parsers.rules.web import WEB_RULES

__all__ = ["RegexRule", "LINUX_RULES", "WEB_RULES"]

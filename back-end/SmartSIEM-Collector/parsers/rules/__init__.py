"""Modular parser rule sets."""

from parsers.rules.base import RegexRule
from parsers.rules.linux import LINUX_RULES
from parsers.rules.web import WEB_RULES

__all__ = ["RegexRule", "LINUX_RULES", "WEB_RULES"]

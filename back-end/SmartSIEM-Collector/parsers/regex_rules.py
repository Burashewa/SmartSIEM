"""Entry point for modular regex rule loading and prioritization."""

from parsers.rules import LINUX_RULES, WEB_RULES, RegexRule

LOG_RULES: tuple[RegexRule, ...] = (*WEB_RULES, *LINUX_RULES)

# Line-level rules (match full input), highest priority first
LINE_RULES: tuple[RegexRule, ...] = tuple(
    sorted((r for r in LOG_RULES if r.scope == "line"), key=lambda r: -r.priority)
)

# Message-level rules (match syslog message part), highest priority first
MESSAGE_RULES: tuple[RegexRule, ...] = tuple(
    sorted((r for r in LOG_RULES if r.scope == "message"), key=lambda r: -r.priority)
)


def get_line_rules() -> tuple[RegexRule, ...]:
    """Return line-level rules for full input matching."""
    return LINE_RULES


def get_message_rules() -> tuple[RegexRule, ...]:
    """Return message-level rules for syslog message content."""
    return MESSAGE_RULES


def get_rules() -> tuple[RegexRule, ...]:
    """Return all rules ordered by priority (highest first)."""
    return tuple(sorted(LOG_RULES, key=lambda r: -r.priority))

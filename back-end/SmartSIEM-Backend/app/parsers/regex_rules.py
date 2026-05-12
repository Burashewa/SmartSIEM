"""Entry point for modular regex rule loading and prioritization."""

from app.parsers.rules import LINUX_RULES, WEB_RULES, RegexRule

LOG_RULES: tuple[RegexRule, ...] = (*WEB_RULES, *LINUX_RULES)
LINE_RULES: tuple[RegexRule, ...] = tuple(
    sorted((r for r in LOG_RULES if r.scope == "line"), key=lambda r: -r.priority)
)
MESSAGE_RULES: tuple[RegexRule, ...] = tuple(
    sorted((r for r in LOG_RULES if r.scope == "message"), key=lambda r: -r.priority)
)


def get_line_rules() -> tuple[RegexRule, ...]:
    return LINE_RULES


def get_message_rules() -> tuple[RegexRule, ...]:
    return MESSAGE_RULES

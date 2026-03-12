"""Regex patterns for log type identification and field extraction."""

import re
from dataclasses import dataclass
from typing import Pattern


@dataclass(frozen=True)
class RegexRule:
    """
    A single parsing rule: log type, compiled pattern, and match priority.

    scope: "line" = match full input (default); "message" = match only
           the message part after a syslog header (used by base_parser
           for ssh/sudo etc. embedded in syslog).
    """

    log_type: str
    pattern: Pattern[str]
    priority: int = 0
    scope: str = "line"

    def match(self, text: str) -> re.Match[str] | None:
        """Return match object if text matches, else None."""
        return self.pattern.match(text)


# ---------------------------------------------------------------------------
# Syslog formats
# ---------------------------------------------------------------------------

# RFC 3164: <PRI>TIMESTAMP HOST TAG: MESSAGE
# e.g. <34>Oct 11 22:14:15 machine su: 'su root' failed
_SYSLOG_RFC3164 = re.compile(
    r"^<(?P<priority>\d+)>"
    r"(?P<timestamp>\w{3}\s+\d{1,2}\s+\S+)"
    r"\s+(?P<hostname>\S+)"
    r"\s+(?P<program>\S+?)(?:\[(?P<pid>\d+)\])?:\s*"
    r"(?P<message>.*)$",
    re.DOTALL,
)

# RFC 5424 (simplified): VERSION timestamp host app pid msgid [structured] message
# e.g. <34>1 2003-10-11T22:14:15.003Z mymachine evntslog - ID47 [sd] msg
_SYSLOG_RFC5424 = re.compile(
    r"^<(?P<priority>\d+)>"
    r"(?P<version>\d+)\s+"
    r"(?P<timestamp>\S+)\s+"
    r"(?P<hostname>\S+)\s+"
    r"(?P<app_name>\S+)\s+"
    r"(?P<pid>-|\d+)\s+"
    r"(?P<msgid>-|\S+)\s+"
    r"(?P<structured>\[.*?\])?\s*"
    r"(?P<message>.*)$",
    re.DOTALL,
)

# ---------------------------------------------------------------------------
# Web server access logs
# ---------------------------------------------------------------------------

# Apache / Nginx combined: IP ident user [date] "request" status size "referer" "ua"
# e.g. 192.168.1.1 - - [11/Oct/2023:22:14:15 +0000] "GET /index.html HTTP/1.1" 200 1234 "-" "Mozilla/5.0"
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

# ---------------------------------------------------------------------------
# Security / auth logs
# ---------------------------------------------------------------------------

# SSH failed password (message part; often inside syslog)
# Failed password for (invalid user )?user from ip port
_SSH_FAILED_PASSWORD = re.compile(
    r"^Failed\s+password\s+for\s+"
    r"(?:invalid\s+user\s+)?(?P<username>\S+)\s+"
    r"from\s+(?P<client_ip>\S+)\s+"
    r"port\s+(?P<port>\d+)\s+"
    r"(?P<protocol>\S+)\s*$",
)

# SSH accepted (message part)
_SSH_ACCEPTED = re.compile(
    r"^Accepted\s+(?P<method>\S+)\s+for\s+(?P<username>\S+)\s+"
    r"from\s+(?P<client_ip>\S+)\s+port\s+(?P<port>\d+)\s+"
    r"(?P<protocol>\S+)\s*$",
)

# Sudo (message part)
# user : TTY=tty ; PWD=path ; USER=root ; COMMAND=cmd
_SUDO = re.compile(
    r"^(?P<user>\S+)\s+:\s+"
    r"TTY=(?P<tty>\S+)\s+;\s+"
    r"PWD=(?P<pwd>\S+)\s+;\s+"
    r"USER=(?P<runas_user>\S+)\s+;\s+"
    r"COMMAND=(?P<command>.*)$",
)

# ---------------------------------------------------------------------------
# Rule set (ordered by priority: higher = tried first)
# ---------------------------------------------------------------------------

LOG_RULES: tuple[RegexRule, ...] = (
    # Full-line formats
    RegexRule("apache_combined", _APACHE_COMBINED, priority=100),
    RegexRule("syslog_rfc5424", _SYSLOG_RFC5424, priority=50),
    RegexRule("syslog_rfc3164", _SYSLOG_RFC3164, priority=50),
    # Message-level (tried on syslog message part by base_parser)
    RegexRule("ssh_failed_password", _SSH_FAILED_PASSWORD, priority=90, scope="message"),
    RegexRule("ssh_accepted", _SSH_ACCEPTED, priority=90, scope="message"),
    RegexRule("sudo", _SUDO, priority=90, scope="message"),
)

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

"""Linux/Kali/syslog/auth parsing rules."""

from __future__ import annotations

import re

from app.parsers.rules.base import RegexRule

_SYSLOG_RFC3164 = re.compile(
    r"^<(?P<priority>\d+)>"
    r"(?P<timestamp>\w{3}\s+\d{1,2}\s+\S+)"
    r"\s+(?P<hostname>\S+)"
    r"\s+(?P<program>\S+?)(?:\[(?P<pid>\d+)\])?:\s*"
    r"(?P<message>.*)$",
    re.DOTALL,
)

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

_KALI_SYSLOG = re.compile(
    r"^(?P<timestamp>"
    r"\d{4}-\d{2}-\d{2}T"
    r"\d{2}:\d{2}:\d{2}"
    r"(?:\.\d{1,6})?"
    r"(?:Z|[+-]\d{2}:\d{2})"
    r")\s+"
    r"(?P<hostname>\S+)\s+"
    r"(?P<program>[^\s:\[]+)(?:\[(?P<pid>\d+)\])?:\s*"
    r"(?P<message>.*)$",
    re.DOTALL,
)

_SSH_FAILED_PASSWORD = re.compile(
    r"^Failed\s+password\s+for\s+"
    r"(?:invalid\s+user\s+)?(?P<username>\S+)\s+"
    r"from\s+(?P<client_ip>\S+)\s+"
    r"port\s+(?P<port>\d+)\s+"
    r"(?P<protocol>\S+)\s*$",
)
_SSH_ACCEPTED = re.compile(
    r"^Accepted\s+(?P<method>\S+)\s+for\s+(?P<username>\S+)\s+"
    r"from\s+(?P<client_ip>\S+)\s+port\s+(?P<port>\d+)\s+"
    r"(?P<protocol>\S+)\s*$",
)
_SUDO = re.compile(
    r"^(?P<user>\S+)\s+:\s+"
    r"(?:.*?\s+;\s+)?"
    r"TTY=(?P<tty>\S+)\s+;\s+"
    r"PWD=(?P<pwd>\S+)\s+;\s+"
    r"USER=(?P<runas_user>\S+)\s+;\s+"
    r"COMMAND=(?P<command>.*)$",
)
_SUDO_INCORRECT_PASSWORD = re.compile(
    r"^(?P<user>\S+)\s+:\s+"
    r"(?P<attempts>\d+)\s+incorrect\s+password\s+attempt\s*;\s+"
    r"TTY=(?P<tty>\S+)\s+;\s+"
    r"PWD=(?P<pwd>\S+)\s+;\s+"
    r"USER=(?P<runas_user>\S+)\s+;\s+"
    r"COMMAND=(?P<command>.*)$",
)
_PAM_SUDO_AUTH_FAILURE = re.compile(
    r"^pam_unix\(sudo\):\s+authentication\s+failure;\s+"
    r"logname=(?P<logname>\S+)\s+uid=\d+\s+euid=\d+\s+"
    r"tty=(?P<tty>\S+)\s+ruser=(?P<ruser>\S+)\s+"
    r"rhost=(?P<rhost>\S*)\s+user=(?P<user>\S+)",
)
_UNIX_CHKPWD = re.compile(
    r"^password\s+check\s+failed\s+for\s+user\s+\((?P<user>\w+)\)\s*$",
)
_DHCP_LEASE = re.compile(
    r"^[^\]]*\]\s+dhcp4\s*\([^)]*\):\s+.*?\baddress=(?P<dhcp_ip>(?:\d{1,3}\.){3}\d{1,3})\b",
)
_SYSTEMD_STARTED = re.compile(r"^Started\s+(?P<service>\S+)\s+-")
_SYSTEMD_FINISHED = re.compile(r"^Finished\s+(?P<service>\S+)\s+-")
_PAM_SESSION = re.compile(
    r"^pam_unix\([^\)]*\):\s+session\s+(?P<action>opened|closed)\s+for\s+user\s+(?P<user>\S+)\s*$",
)

LINUX_RULES: tuple[RegexRule, ...] = (
    RegexRule("kali_syslog", _KALI_SYSLOG, priority=60),
    RegexRule("syslog_rfc5424", _SYSLOG_RFC5424, priority=50),
    RegexRule("syslog_rfc3164", _SYSLOG_RFC3164, priority=50),
    RegexRule("dhcp_lease", _DHCP_LEASE, priority=85, scope="message"),
    RegexRule("systemd_started", _SYSTEMD_STARTED, priority=82, scope="message"),
    RegexRule("systemd_finished", _SYSTEMD_FINISHED, priority=82, scope="message"),
    RegexRule("pam_sudo_auth_failure", _PAM_SUDO_AUTH_FAILURE, priority=94, scope="message"),
    RegexRule("sudo_incorrect_password", _SUDO_INCORRECT_PASSWORD, priority=96, scope="message"),
    RegexRule("ssh_failed_password", _SSH_FAILED_PASSWORD, priority=90, scope="message"),
    RegexRule("ssh_accepted", _SSH_ACCEPTED, priority=90, scope="message"),
    RegexRule("sudo", _SUDO, priority=93, scope="message"),
    RegexRule("unix_chkpwd", _UNIX_CHKPWD, priority=91, scope="message"),
    RegexRule("pam_session", _PAM_SESSION, priority=90, scope="message"),
)

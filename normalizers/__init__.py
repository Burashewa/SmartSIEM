"""Normalization package: maps parsed logs to OCSF."""

from normalizers.ocsf_mapper import LogToOCSFMapper, normalize
from normalizers.ocsf_model import SIEMEvent

__all__ = ["SIEMEvent", "normalize", "LogToOCSFMapper"]

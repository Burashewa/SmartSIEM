"""Normalization package: maps parsed logs to standard SIEM schema."""

from normalizers.schema import SIEMEvent, normalize

__all__ = ["SIEMEvent", "normalize"]

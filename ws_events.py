"""
ws_events.py — WebSocket event name constants for SmartSIEM.

Import these in both server code and front-end documentation to keep
the event contract stable.
"""

# Emitted by the server to all connected clients when a new alert is stored
EVENT_NEW_ALERT = "new_alert"

# Emitted to a client immediately after it connects
EVENT_CONNECTED = "connected"

# Periodic stats snapshot (optional, can be emitted by a background thread)
EVENT_STATS_UPDATE = "stats_update"

# Emitted when a batch ingestion job finishes processing
EVENT_BATCH_DONE = "batch_done"

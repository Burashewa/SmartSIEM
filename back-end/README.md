## 📁 Project Folder Structure

The **SmartSIEM Collector** is organized into modular components that handle ingestion, parsing, enrichment, normalization, validation, and output.

## 📁 Folder Structure

```text
SmartSIEM-Collector/
│
├── main.py
├── database.py
├── requirements.txt
├── test_payload.json
├── logs.ndjson
├── logs_test.ndjson
├── dead_letter_test.ndjson
│
├── config/
│   ├── __init__.py
│   └── settings.py
│
├── listeners/
│   ├── __init__.py
│   ├── syslog_server.py
│   └── http_api.py
│
├── parsers/
│   ├── __init__.py
│   ├── base_parser.py
│   ├── regex_rules.py
│   └── rules/
│       ├── __init__.py
│       ├── base.py
│       ├── linux.py
│       └── web.py
│
├── normalizers/
│   ├── __init__.py
│   ├── ocsf_mapper.py
│   └── ocsf_model.py
│
├── enrichment/
│   ├── __init__.py
│   ├── asset_db.py
│   ├── dns.py
│   ├── engine.py
│   ├── geoip.py
│   ├── manager.py
│   ├── maxmind_geo.py
│   └── threat_intel.py
│
├── validators/
│   ├── __init__.py
│   └── event_validators.py
│
├── outputs/
│   ├── __init__.py
│   ├── kafka_writer.py
│   ├── queue_writer.py
│   └── ssl_diag.py
│
├── certs/
│   └── service.cert
│
└── scripts/
    ├── fetch_geolite2_city.sh
    ├── run_collector.sh
    └── setup_venv.sh
```

## 🔄 Processing Pipeline

The collector processes logs in **six main stages**:

1. **Ingestion**
   Logs are received through:
   - Syslog (UDP/TCP)
   - HTTP API from agents

2. **Parsing**
   Raw log messages are analyzed using regex rules to extract structured fields.

3. **Enrichment**
   Events are augmented with asset data, DNS, GeoIP, and threat intel where available.

4. **Normalization**
   Parsed logs are mapped into the OCSF model for consistent downstream handling.

5. **Validation**
   Normalized events are checked for required fields and schema consistency.

6. **Output**
   Valid events are sent to:
   - Message queues (Kafka or other queue backends)
   - File-based outputs for testing and diagnostics

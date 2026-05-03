## 📁 Project Folder Structure

The **SmartSIEM Collector** is organized into modular components that handle log ingestion, parsing, normalization, and output processing.

## 📁 Folder Structure

```text
smartsiem-collector/
│
├── main.py
├── requirements.txt
├── .env
│
├── config/
│   └── settings.py
│
├── listeners/
│   ├── __init__.py
│   ├── syslog_server.py
│   └── http_api.py
│
├── parsers/
│   ├── __init__.py
│   ├── regex_rules.py
│   └── base_parser.py
│
├── normalizers/
│   ├── __init__.py
│   └── schema.py
│
└── outputs/
    ├── __init__.py
    └── queue_writer.py
```
# Sends processed logs to a message queue or file storage

## Run

Install once: `python -m venv venv` then `.\venv\Scripts\pip install -r requirements.txt`.  
Start the collector with the venv interpreter (not a global `python`, or you get missing modules):

`.\venv\Scripts\python.exe main.py` or `.\run.ps1`

End-to-end (HTTP → collector → Kafka → detection worker): with collector and worker running, run `python send_test_logs_to_collector.py` or `python scripts/send_test_logs_to_collector.py` (optional `--base-url` / `--worker-url`).

## 🔄 Processing Pipeline

The collector processes logs in **four main stages**:

1. **Ingestion**  
   Logs are received through:
   - Syslog (UDP/TCP)
   - HTTP API from agents

2. **Parsing**  
   Raw log messages are analyzed using predefined **regex rules** to extract structured fields.

3. **Normalization**  
   Parsed logs are converted into a **standard JSON schema** to ensure consistency.

4. **Output**  
   The normalized logs are sent to:
   - Message queues (e.g., Kafka, RabbitMQ)
   - Files
   - Downstream SIEM components

# SmartSIEM Rule Engine

A high-performance Python Flask microservice designed for real-time security log analysis and threat detection. It processes incoming JSON log events, evaluates them against a sophisticated rule set, and generates alerts with high-throughput and low-latency.

## 🚀 Key Features

- **Real-Time Detection**: Evaluates logs against 20 security rules using three distinct detection mechanisms.
- **High-Throughput Architecture**: Uses a bounded async queue and thread-pool for non-blocking ingestion.
- **MongoDB Integration**: Persists raw logs and triggered alerts into a MongoDB backend.
- **Real-Time Alerts**: Broadcasts alerts instantly via WebSockets (SocketIO) to connected clients.
- **Intelligent Deduplication**: Suppresses redundant alerts for the same source/rule within a 30-second window.
- **API-First Design**: Fully documented REST API for ingestion, alert retrieval, and health monitoring.

## 🏗️ Architecture

1.  **Ingestion**: Logs are received via POST requests (single or batch) and immediately mirrored to MongoDB.
2.  **Queueing**: Events are pushed to an internal worker queue to ensure the API remains responsive under heavy load.
3.  **Evaluation**: Background workers pull events and run them through the **Rule Engine**.
4.  **Action**: Triggered alerts are deduped, saved to the database, and pushed via WebSockets.

## 🛡️ Detection Rules

The engine includes 20 predefined rules covering common attack vectors:

| ID | Rule Name | Severity | Type |
| :--- | :--- | :--- | :--- |
| **R01** | Brute-force login | HIGH | Threshold |
| **R02** | Credential stuffing | CRITICAL | Threshold |
| **R03** | Account takeover | CRITICAL | Sequence |
| **R04** | Off-hours login | MEDIUM | Single Event |
| **R08** | Known malicious IP | HIGH | Single Event |
| **R12** | Admin panel scan | HIGH | Single Event |
| **R13** | Privilege escalation | CRITICAL | Single Event |
| **R14** | Sensitive file read | CRITICAL | Single Event |
| **R15** | Web attack payload | CRITICAL | Single Event |
| **R19** | Session hijacking | CRITICAL | Sequence |
| ... | *And 10 more covering port scans, DDoS, etc.* | | |

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.10+
- MongoDB instance (Local or Atlas)

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configuration (`.env`)
Create a `.env` file in the root directory:
```env
Mongo_URI = "your_mongodb_uri"
DB_NAME = "SIEM"
PORT = 5000
DEBUG = false
```

### 3. Start the Engine
```bash
python app.py
```

## 🛠️ Usage

### API Endpoints
- `POST /ingest`: Ingest a single log event.
- `POST /ingest/batch`: Ingest an array of log events (Optimized).
- `GET /alerts`: Retrieve triggered alerts with optional filters (`severity`, `rule_id`, `ip`).
- `GET /summary`: Get alert statistics and severity breakdown.
- `GET /health`: Monitor system health, database connection, and queue depth.

### Simulating Attacks
Use the provided demo sender to simulate various attack scenarios:
```bash
python demo_sender.py --once
```

### Monitoring via CLI
View a real-time summary of alerts in your terminal:
```bash
python summary.py --watch
```

## 🧪 Testing
Run the comprehensive smoke test suite to verify all rule logic and API endpoints:
```bash
pytest smoke_test.py
```

---
*Developed for SmartSIEM — Advanced Threat Detection.*

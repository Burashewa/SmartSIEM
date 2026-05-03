# SmartSIEM Detection Worker

Node.js worker that consumes normalized log events from Kafka, runs detection rules, writes batches to MongoDB, and publishes alerts to Kafka.

## Prerequisites

- **Node.js** (v18+ recommended; LTS is fine)
- **MongoDB** running and reachable (default: `mongodb://localhost:27017/smartsiem`)
- **Apache Kafka** running and reachable (default broker: `localhost:9092`)
- Topics **`raw.logs`** and **`alerts`** must exist before the consumer can subscribe (see below)

## Configuration

1. Copy or edit **`.env`** in this directory (`detection-worker/.env`).

   Typical variables:

   | Variable | Description |
   |----------|-------------|
   | `KAFKA_BROKERS` | Comma-separated brokers, e.g. `localhost:9092` |
   | `MONGODB_URI` | Mongo connection string |
   | `RAW_LOGS_TOPIC` | Topic to consume (default `raw.logs`) |
   | `ALERTS_TOPIC` | Topic for alert messages (default `alerts`) |
   | `CONSUMER_GROUP_ID` | Kafka consumer group id |
   | `WORKER_PORT` | HTTP health port (default `4000`) |
   | `FLUSH_INTERVAL_MS` | How often log/alert batches flush to Mongo |
   | `RULE_RELOAD_INTERVAL_SEC` | How often rules reload from Mongo |

2. **Create Kafka topics** (names must match `RAW_LOGS_TOPIC` and `ALERTS_TOPIC` in `.env`):

   ```bash
   kafka-topics --bootstrap-server localhost:9092 --create --topic raw.logs --partitions 1 --replication-factor 1 --if-not-exists
   kafka-topics --bootstrap-server localhost:9092 --create --topic alerts --partitions 1 --replication-factor 1 --if-not-exists
   ```

   Adjust `--bootstrap-server` if your broker is not on `localhost:9092`.

## Install

From this directory:

```bash
cd detection-worker
npm install
```

## Start

**Production-style (node):**

```bash
npm start
```

**Development (auto-restart on file changes):**

```bash
npm run dev
```

The process will:

1. Connect to MongoDB (exits if connection fails).
2. Connect the Kafka producer (exits if connection fails).
3. Reload detection rules.
4. Start the detection engine, health server, and periodic tasks.
5. Start the Kafka consumer on `RAW_LOGS_TOPIC`.

## Health check

With default `WORKER_PORT=4000`:

```text
http://localhost:4000/health
```

Returns JSON including `ok`, `totalProcessed`, and `totalAlerts`.

## Stop

Press **Ctrl+C** in the terminal. The worker handles **SIGINT** / **SIGTERM**: it stops the consumer, flushes batches, disconnects Kafka and MongoDB, and stops the health server.

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Exits immediately after “Kafka producer connection failed” | Kafka is not running or `KAFKA_BROKERS` is wrong. |
| `UNKNOWN_TOPIC_OR_PARTITION` / consumer errors on subscribe | Create `raw.logs` and `alerts` topics (see above), then restart. |
| Mongo errors on startup | MongoDB is running and `MONGODB_URI` is correct. |

Optional: silence KafkaJS partitioner migration noise:

```bash
set KAFKAJS_NO_PARTITIONER_WARNING=1
```

(On PowerShell: `$env:KAFKAJS_NO_PARTITIONER_WARNING=1` before `npm start`.)

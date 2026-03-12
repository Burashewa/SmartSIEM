
## Folder-Structure
smartsiem-collector/
│
├── main.py                 # The central entry point that starts all your listeners
├── requirements.txt        # List of Python libraries you'll need (e.g., fastapi, pydantic)
├── .env                    # Environment variables (secret keys, passwords - don't commit this!)
│
├── config/                 
│   └── settings.py         # Loads configurations (port numbers, queue addresses)
│
├── listeners/              # STEP 1: Ingestion
│   ├── __init__.py
│   ├── syslog_server.py    # UDP/TCP socket listener for raw network logs
│   └── http_api.py         # REST API endpoint for agents sending JSON
│
├── parsers/                # STEP 2: Extraction
│   ├── __init__.py
│   ├── regex_rules.py      # Stores the regular expressions for different log types
│   └── base_parser.py      # Logic to match incoming logs to the right regex
│
├── normalizers/            # STEP 3: JSON Standardization
│   ├── __init__.py
│   └── schema.py           # Defines the standard JSON structure (using Pydantic)
│
└── outputs/                # STEP 4: Buffering & Storage
    ├── __init__.py
    └── queue_writer.py     # Code to push the final JSON to a message queue or file
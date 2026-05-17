FROM python:3.13-slim

# System deps for confluent-kafka
RUN apt-get update && apt-get install -y --no-install-recommends \
    librdkafka-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy collector source
COPY . .

EXPOSE 5000

# Map Render PORT -> app HTTP_PORT at runtime
CMD ["sh", "-c", "HTTP_PORT=${PORT:-5000} python main.py"]

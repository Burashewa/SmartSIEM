import requests
import json
import time
import socketio
import threading

print("--- SMART SIEM RULE ENGINE IMPLEMENTATION VERIFICATION ---")

# Connect to MongoDB via our db.py
try:
    from db import alerts_col, logs_col, ping
    if ping():
        print("✅ MongoDB Connection: Verified (ping successful)")
        
        # Clean up database for a completely fresh test
        alerts_col.delete_many({})
        logs_col.delete_many({})
        print("   Database cleared for test run")
    else:
        print("❌ MongoDB Connection: FAILED ping")
except Exception as e:
    print(f"❌ MongoDB Verification error: {e}")

# 1. Test WebSocket capability using the newly installed socketio client
print("\n--- Testing WebSocket Real-Time Capability ---")
sio = socketio.Client()
ws_connected = False
ws_messages_received = []

@sio.event
def connect():
    global ws_connected
    ws_connected = True
    print("   SocketIO: Triggered connect event")

@sio.event
def connected(data):
    print(f"   SocketIO Initial Server Data: {json.dumps(data)}")

@sio.event
def new_alert(data):
    ws_messages_received.append(data)
    print(f"✅ Real-Time Alert Received via WebSocket! Rule: {data['rule_id']} - {data['message']}")

try:
    sio.connect('http://localhost:5000')
    time.sleep(1) # wait for connection
    if ws_connected:
        print("✅ WebSocket Server: Online and functional")
    else:
        print("❌ WebSocket Server: Connection failed or not acknowledged")
except Exception as e:
    print(f"❌ WebSocket Client Error: {e}")


# 2. Test High-Throughput Batch Processing API
print("\n--- Testing High-Throughput Batch Queue ---")

# Let's generate a batch of 25 failed logins from the same IP (this should trigger Brute Force -> 1 Alert)
# And 30 random logs that shouldn't trigger anything.
batch = []
for i in range(25):
    batch.append({
        "event": "authentication",
        "action": "login",
        "status": "failed",
        "ip": "203.0.113.5",
        "user": f"user_{i}"
    })
for i in range(30):
     batch.append({
        "event": "network",
        "action": "ping",
        "status": "success",
        "ip": f"192.168.1.{i}"
    })

print(f"   Sending batch of {len(batch)} logs simultaneously...")
try:
    start_time = time.time()
    resp = requests.post("http://localhost:5000/ingest/batch", json=batch)
    end_time = time.time()
    
    if resp.status_code == 202:
        print(f"✅ Batch API: Accepted instantly in {end_time - start_time:.4f} seconds (Response 202)")
        print(f"   Response payload: {json.dumps(resp.json())}")
    else:
        print(f"❌ Batch API FAILED: {resp.status_code} - {resp.text}")
except Exception as e:
    print(f"❌ Batch API Request Error: {e}")


# Wait for worker threads in backend to process the queue and insert to mongo
print("\n   Waiting 3 seconds for background worker threads to drain the queue...")
time.sleep(3)


# 3. Test MongoDB persistence for logs and alerts
print("\n--- Testing MongoDB Persistence ---")
try:
    log_count = logs_col.count_documents({})
    alert_count = alerts_col.count_documents({})
    
    if log_count == len(batch):
        print(f"✅ Log Persistence: OK (All {log_count} raw logs mirrored to MongoDB successfully)")
    else:
        print(f"❌ Log Persistence: FAILED (Expected {len(batch)}, found {log_count})")
        
    if alert_count == 1:
        print("✅ Alert Persistence: OK (Brute Force threshold successfully evaluated and 1 deduped alert saved to DB)")
    else:
        print(f"❌ Alert Persistence: FAILED (Expected 1 alert, found {alert_count})")
except Exception as e:
    print(f"❌ Persistence Check Error: {e}")


# 4. Final verify of our WebSocket message check
print("\n--- Verifying Real-Time WebSocket Delivery ---")
if len(ws_messages_received) >= 1:
    print(f"✅ WebSocket Delivery: OK (Received {len(ws_messages_received)} alerts in real-time without polling)")
    for i, msg in enumerate(ws_messages_received):
        print(f"   Alert {i+1}: {msg.get('rule_id')} - {msg.get('severity')}")
else:
    print(f"❌ WebSocket Delivery: FAILED (Expected at least 1 message, got 0)")


sio.disconnect()
print("\n--- Verification Complete ---")

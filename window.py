import threading
from collections import deque
from typing import Tuple, List, Dict

class SlidingWindow:
    def __init__(self):
        self._buckets: Dict[str, deque] = {}
        self._lock = threading.Lock()

    def increment(self, rule_id: str, group_value: str, window_seconds: int, event_timestamp: float, event_id: str) -> Tuple[int, List[str]]:
        key = f"{rule_id}:{group_value}"
        with self._lock:
            if key not in self._buckets:
                self._buckets[key] = deque()
            
            bucket = self._buckets[key]
            bucket.append((event_timestamp, event_id))
            
            cutoff = event_timestamp - window_seconds
            while bucket and bucket[0][0] < cutoff:
                bucket.popleft()
                
            return len(bucket), [e_id for _, e_id in bucket]

    def reset(self, rule_id: str, group_value: str):
        key = f"{rule_id}:{group_value}"
        with self._lock:
            if key in self._buckets:
                self._buckets[key].clear()

    def get_count(self, rule_id: str, group_value: str) -> int:
        key = f"{rule_id}:{group_value}"
        with self._lock:
            return len(self._buckets.get(key, []))

class SequenceTracker:
    def __init__(self):
        self._first_events: Dict[str, deque] = {}
        self._lock = threading.Lock()

    def record_first(self, rule_id: str, group_value: str, window_seconds: int, event_timestamp: float, event_id: str):
        key = f"{rule_id}:{group_value}"
        with self._lock:
            if key not in self._first_events:
                self._first_events[key] = deque()
            
            bucket = self._first_events[key]
            bucket.append((event_timestamp, event_id))
            
            cutoff = event_timestamp - window_seconds
            while bucket and bucket[0][0] < cutoff:
                bucket.popleft()

    def check_second(self, rule_id: str, group_value: str, window_seconds: int, first_threshold: int, event_timestamp: float, event_id: str) -> Tuple[bool, List[str]]:
        key = f"{rule_id}:{group_value}"
        with self._lock:
            if key not in self._first_events:
                return False, []
                
            bucket = self._first_events[key]
            cutoff = event_timestamp - window_seconds
            
            # Clean up old first events
            while bucket and bucket[0][0] < cutoff:
                bucket.popleft()
                
            if len(bucket) >= first_threshold:
                linked_ids = [e_id for _, e_id in bucket]
                linked_ids.append(event_id)
                bucket.clear() # Clear after firing
                return True, linked_ids
                
            return False, []

window = SlidingWindow()
sequence = SequenceTracker()

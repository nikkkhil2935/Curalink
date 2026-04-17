from __future__ import annotations

from collections import OrderedDict
import copy
import math
import time
from typing import Any, Dict, List, Optional, Tuple


def cosine_similarity(left: List[float], right: List[float]) -> float:
    if not left or not right:
        return 0.0

    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0

    dot = sum(left[index] * right[index] for index in range(min(len(left), len(right))))
    return dot / (left_norm * right_norm)


class SemanticLRUCache:
    def __init__(
        self,
        max_entries: int = 300,
        ttl_seconds: float = 300.0,
        similarity_threshold: float = 0.92,
    ) -> None:
        self.max_entries = max(1, int(max_entries))
        self.ttl_seconds = max(1.0, float(ttl_seconds))
        self.similarity_threshold = max(0.0, min(1.0, float(similarity_threshold)))
        self._entries: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()

    def _evict_expired(self, now_ts: float) -> None:
        expired_keys = [
            key
            for key, entry in self._entries.items()
            if float(entry.get("expires_at", 0.0)) <= now_ts
        ]

        for key in expired_keys:
            self._entries.pop(key, None)

    def get(
        self,
        query_embedding: List[float],
        namespace: str = "",
        now_ts: Optional[float] = None,
    ) -> Tuple[Optional[Dict[str, Any]], float]:
        if not query_embedding:
            return None, 0.0

        current_time = float(now_ts if now_ts is not None else time.time())
        self._evict_expired(current_time)

        best_key: Optional[str] = None
        best_entry: Optional[Dict[str, Any]] = None
        best_score = -1.0

        for key, entry in list(self._entries.items()):
            entry_namespace = str(entry.get("namespace") or "")
            if namespace and entry_namespace != namespace:
                continue

            entry_embedding = entry.get("embedding") or []
            score = cosine_similarity(query_embedding, entry_embedding)
            if score > best_score:
                best_key = key
                best_entry = entry
                best_score = score

        if best_key is None or best_entry is None or best_score < self.similarity_threshold:
            return None, max(best_score, 0.0)

        self._entries.move_to_end(best_key)
        return copy.deepcopy(best_entry.get("payload") or {}), best_score

    def set(
        self,
        cache_key: str,
        query_embedding: List[float],
        payload: Dict[str, Any],
        namespace: str = "",
        now_ts: Optional[float] = None,
    ) -> None:
        if not cache_key or not query_embedding or not isinstance(payload, dict):
            return

        current_time = float(now_ts if now_ts is not None else time.time())
        self._evict_expired(current_time)

        self._entries[cache_key] = {
            "namespace": str(namespace or ""),
            "embedding": [float(value) for value in query_embedding],
            "payload": copy.deepcopy(payload),
            "expires_at": current_time + self.ttl_seconds,
        }
        self._entries.move_to_end(cache_key)

        while len(self._entries) > self.max_entries:
            self._entries.popitem(last=False)

    def clear(self) -> None:
        self._entries.clear()

    @property
    def size(self) -> int:
        return len(self._entries)

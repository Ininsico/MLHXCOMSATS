"""RabbitMQ publisher.

Jobs are published to a durable queue so slow work (RAG reindexing, downstream
notifications) can happen off the request path. If the broker is unreachable the
publish is logged and skipped — the API keeps working either way.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

LOGGER = logging.getLogger("aurora.ai.queue")

QUEUE_NAME = os.getenv("RABBITMQ_QUEUE", "aurora.ai.jobs")
BROKER_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@127.0.0.1:5672/%2F")


def _safe_url() -> str:
    return BROKER_URL.split("@")[-1]


def publish(payload: dict[str, Any]) -> bool:
    """Publish one persisted job. Returns False when the broker is unavailable."""
    try:
        import pika

        parameters = pika.URLParameters(BROKER_URL)
        parameters.socket_timeout = 5
        parameters.blocked_connection_timeout = 5

        connection = pika.BlockingConnection(parameters)

        try:
            channel = connection.channel()
            channel.queue_declare(queue=QUEUE_NAME, durable=True)
            channel.basic_publish(
                exchange="",
                routing_key=QUEUE_NAME,
                body=json.dumps({**payload, "publishedAt": time.strftime("%Y-%m-%dT%H:%M:%S")}).encode(),
                properties=pika.BasicProperties(content_type="application/json", delivery_mode=2),
            )
        finally:
            connection.close()

        LOGGER.info("Queued %s", payload.get("type", "job"))
        return True
    except Exception as exc:  # noqa: BLE001 — the broker is optional
        LOGGER.warning("RabbitMQ publish skipped (%s): %s", type(exc).__name__, exc)
        return False


def status() -> dict[str, Any]:
    try:
        import pika

        parameters = pika.URLParameters(BROKER_URL)
        parameters.socket_timeout = 3
        parameters.blocked_connection_timeout = 3

        connection = pika.BlockingConnection(parameters)

        try:
            channel = connection.channel()
            declared = channel.queue_declare(queue=QUEUE_NAME, durable=True)
            return {
                "connected": True,
                "queue": QUEUE_NAME,
                "messages": declared.method.message_count,
                "broker": _safe_url(),
            }
        finally:
            connection.close()
    except Exception as exc:  # noqa: BLE001
        return {
            "connected": False,
            "queue": QUEUE_NAME,
            "broker": _safe_url(),
            "reason": f"{type(exc).__name__}: {exc}",
        }

import logging
import os
from contextlib import contextmanager

import psycopg
from fastapi import FastAPI, HTTPException
from psycopg.rows import dict_row
from pydantic import BaseModel


app = FastAPI(
    title="Ticketflow API",
    description="Backend API for event discovery and seat selection.",
    version="0.1.0",
)

logger = logging.getLogger(__name__)


class HealthResponse(BaseModel):
    status: str


class TicketEvent(BaseModel):
    id: int
    title: str
    date: str
    venue: str
    price: int


class Seat(BaseModel):
    id: str
    label: str
    is_reserved: bool


@contextmanager
def open_database():
    database_url = os.environ.get("DATABASE_URL")

    if not database_url:
        logger.error("DATABASE_URL is not configured")
        raise HTTPException(
            status_code=503,
            detail="Database is not configured",
        )

    try:
        # Close the connection when the request finishes.
        with psycopg.connect(
            database_url,
            row_factory=dict_row,
            connect_timeout=3,
        ) as connection:
            yield connection
    except psycopg.OperationalError:
        logger.exception("PostgreSQL connection failed")
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable",
        ) from None


def find_event(connection, event_id: int):
    event = connection.execute(
        """
        SELECT id, title, date, venue, price
        FROM events
        WHERE id = %s
        """,
        (event_id,),
    ).fetchone()

    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    return event


@app.get("/api/health", response_model=HealthResponse)
def health_check():
    with open_database() as connection:
        connection.execute("SELECT 1")

    return {"status": "ok"}


@app.get("/api/events", response_model=list[TicketEvent])
def list_events():
    with open_database() as connection:
        return connection.execute(
            """
            SELECT id, title, date, venue, price
            FROM events
            ORDER BY id
            """
        ).fetchall()


@app.get("/api/events/{event_id}", response_model=TicketEvent)
def get_event(event_id: int):
    with open_database() as connection:
        return find_event(connection, event_id)


@app.get("/api/events/{event_id}/seats", response_model=list[Seat])
def list_event_seats(event_id: int):
    with open_database() as connection:
        find_event(connection, event_id)

        # Keep the existing API seat ID format, such as "1-A3".
        return connection.execute(
            """
            SELECT event_id::TEXT || '-' || label AS id, label, is_reserved
            FROM seats
            WHERE event_id = %s
            ORDER BY label
            """,
            (event_id,),
        ).fetchall()
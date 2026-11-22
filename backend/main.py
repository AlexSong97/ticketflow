import hashlib
import logging
import os
import secrets
from contextlib import contextmanager
from typing import Annotated
from uuid import UUID, uuid4

import psycopg
from argon2 import PasswordHasher, Type
from argon2.exceptions import VerificationError
from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Response
from psycopg.rows import dict_row
from pydantic import BaseModel, Field, field_validator


app = FastAPI(
    title="Ticketflow API",
    description="Backend API for event discovery and seat selection.",
    version="0.1.0",
)

logger = logging.getLogger(__name__)

COOKIE_NAME = "ticketflow_session"
SESSION_SECONDS = 12 * 60 * 60
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"

password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=1,
    type=Type.ID,
)

# Verify a real hash even when the username does not exist.
DUMMY_PASSWORD_HASH = password_hasher.hash(secrets.token_urlsafe(32))


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


class Credentials(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=40,
        pattern=r"^[A-Za-z0-9_]+$",
    )
    password: str = Field(min_length=12, max_length=128)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.lower()


class CurrentUser(BaseModel):
    id: UUID
    username: str


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
        raise HTTPException(
            status_code=404,
            detail="Event not found",
        )

    return event


def require_app_header(
    x_ticketflow_request: Annotated[str | None, Header()] = None,
):
    # Cross-origin browsers cannot send this header without CORS permission.
    if x_ticketflow_request != "1":
        raise HTTPException(
            status_code=403,
            detail="Missing application request header",
        )


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def set_session_cookie(response: Response, token: str):
    response.headers["Cache-Control"] = "no-store"

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=SESSION_SECONDS,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        path="/api",
    )


def create_session(
    connection,
    user_id: UUID,
    previous_token: str | None,
):
    # Re-authentication replaces the session used by this browser.
    if previous_token:
        connection.execute(
            "DELETE FROM sessions WHERE token_hash = %s",
            (token_digest(previous_token),),
        )

    token = secrets.token_urlsafe(32)

    connection.execute(
        """
        INSERT INTO sessions (token_hash, user_id, expires_at)
        VALUES (
            %s,
            %s,
            clock_timestamp() + interval '12 hours'
        )
        """,
        (token_digest(token), user_id),
    )

    return token


def get_current_user(
    ticketflow_session: Annotated[str | None, Cookie()] = None,
):
    if not ticketflow_session:
        raise HTTPException(
            status_code=401,
            detail="Please sign in",
        )

    with open_database() as connection:
        user = connection.execute(
            """
            SELECT users.id, users.username
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = %s
              AND sessions.expires_at > clock_timestamp()
            """,
            (token_digest(ticketflow_session),),
        ).fetchone()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Session expired. Please sign in",
        )

    return user


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


@app.get(
    "/api/events/{event_id}",
    response_model=TicketEvent,
)
def get_event(event_id: int):
    with open_database() as connection:
        return find_event(connection, event_id)


@app.get(
    "/api/events/{event_id}/seats",
    response_model=list[Seat],
)
def list_event_seats(event_id: int):
    with open_database() as connection:
        find_event(connection, event_id)

        # Keep the existing API seat ID format, such as "1-A3".
        return connection.execute(
            """
            SELECT
                event_id::TEXT || '-' || label AS id,
                label,
                is_reserved
            FROM seats
            WHERE event_id = %s
            ORDER BY label
            """,
            (event_id,),
        ).fetchall()


@app.post(
    "/api/auth/register",
    response_model=CurrentUser,
    status_code=201,
    dependencies=[Depends(require_app_header)],
)
def register(
    body: Credentials,
    response: Response,
    ticketflow_session: Annotated[str | None, Cookie()] = None,
):
    password_hash = password_hasher.hash(body.password)

    with open_database() as connection:
        # The unique constraint handles concurrent registrations atomically.
        user = connection.execute(
            """
            INSERT INTO users (id, username, password_hash)
            VALUES (%s, %s, %s)
            ON CONFLICT (username) DO NOTHING
            RETURNING id, username
            """,
            (uuid4(), body.username, password_hash),
        ).fetchone()

        if user is None:
            raise HTTPException(
                status_code=409,
                detail="Username already exists",
            )

        token = create_session(
            connection,
            user["id"],
            ticketflow_session,
        )

    # Set the cookie only after the transaction commits successfully.
    set_session_cookie(response, token)
    return user


@app.post(
    "/api/auth/login",
    response_model=CurrentUser,
    dependencies=[Depends(require_app_header)],
)
def login(
    body: Credentials,
    response: Response,
    ticketflow_session: Annotated[str | None, Cookie()] = None,
):
    with open_database() as connection:
        user = connection.execute(
            """
            SELECT id, username, password_hash
            FROM users
            WHERE username = %s
            """,
            (body.username,),
        ).fetchone()

        stored_hash = (
            user["password_hash"]
            if user
            else DUMMY_PASSWORD_HASH
        )

        try:
            password_hasher.verify(stored_hash, body.password)
        except VerificationError:
            raise HTTPException(
                status_code=401,
                detail="Invalid username or password",
            ) from None

        if user is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid username or password",
            )

        token = create_session(
            connection,
            user["id"],
            ticketflow_session,
        )

    set_session_cookie(response, token)

    return {
        "id": user["id"],
        "username": user["username"],
    }


@app.get("/api/auth/me", response_model=CurrentUser)
def me(
    response: Response,
    user: Annotated[dict, Depends(get_current_user)],
):
    response.headers["Cache-Control"] = "no-store"
    return user


@app.post(
    "/api/auth/logout",
    status_code=204,
    dependencies=[Depends(require_app_header)],
)
def logout(
    ticketflow_session: Annotated[str | None, Cookie()] = None,
):
    if ticketflow_session:
        with open_database() as connection:
            connection.execute(
                "DELETE FROM sessions WHERE token_hash = %s",
                (token_digest(ticketflow_session),),
            )

    response = Response(
        status_code=204,
        headers={"Cache-Control": "no-store"},
    )

    response.delete_cookie(
        key=COOKIE_NAME,
        path="/api",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
    )

    return response
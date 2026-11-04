from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


app = FastAPI(
    title="Ticketflow API",
    description="Backend API for event discovery and seat selection.",
    version="0.1.0",
)


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


# Demo data will be replaced with PostgreSQL records later.
EVENTS = [
    TicketEvent(
        id=1,
        title="Midnight Sessions",
        date="December 12, 2026 · 7:30 PM",
        venue="Orlando · Main Hall",
        price=45,
    ),
    TicketEvent(
        id=2,
        title="Sunday in Blue",
        date="December 20, 2026 · 6:00 PM",
        venue="Orlando · Studio B",
        price=32,
    ),
]

RESERVED_SEATS_BY_EVENT: dict[int, set[str]] = {
    1: {"A3", "B5", "C2"},
    2: {"A1", "A2", "C6"},
}


def find_event(event_id: int) -> TicketEvent:
    for event in EVENTS:
        if event.id == event_id:
            return event

    raise HTTPException(
        status_code=404,
        detail="Event not found",
    )


def create_seats(event_id: int) -> list[Seat]:
    reserved_labels = RESERVED_SEATS_BY_EVENT.get(event_id, set())
    seats = []

    for row in ["A", "B", "C", "D"]:
        for number in range(1, 9):
            label = f"{row}{number}"

            seats.append(
                Seat(
                    id=f"{event_id}-{label}",
                    label=label,
                    is_reserved=label in reserved_labels,
                )
            )

    return seats


@app.get("/api/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/api/events", response_model=list[TicketEvent])
def list_events() -> list[TicketEvent]:
    return EVENTS


@app.get("/api/events/{event_id}", response_model=TicketEvent)
def get_event(event_id: int) -> TicketEvent:
    return find_event(event_id)


@app.get("/api/events/{event_id}/seats", response_model=list[Seat])
def list_event_seats(event_id: int) -> list[Seat]:
    # Reject unknown events before generating their seating chart.
    find_event(event_id)

    return create_seats(event_id)
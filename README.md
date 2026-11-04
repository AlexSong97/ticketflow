# Ticketflow

An event ticket booking system focused on reliable seat reservations
and concurrent order processing.

## Project Status

Early development. Features below are planned, not yet implemented.

## Planned Features

- Browse events and select seats
- Register and sign in
- Reserve seats and create orders
- Simulate payment or cancel orders
- Release unpaid reservations after a timeout
- Prevent double booking under concurrent requests
- Prevent duplicate orders from repeated submissions
- Restrict users to their own orders

## Planned Tech Stack

- Frontend: React + TypeScript
- Backend: Python + FastAPI
- Database: PostgreSQL
- Local development: Docker Compose

## Engineering Goals

- Enforce booking correctness with database transactions and constraints
- Support idempotent order creation
- Verify concurrent booking behavior with integration tests
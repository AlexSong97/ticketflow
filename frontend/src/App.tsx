import { useState } from 'react'
import './App.css'

type TicketEvent = {
  id: number
  title: string
  date: string
  venue: string
  price: number
}

type Seat = {
  id: string
  label: string
  isReserved: boolean
}

const events: TicketEvent[] = [
  {
    id: 1,
    title: 'Midnight Sessions',
    date: 'December 12, 2026 · 7:30 PM',
    venue: 'Orlando · Main Hall',
    price: 45,
  },
  {
    id: 2,
    title: 'Sunday in Blue',
    date: 'December 20, 2026 · 6:00 PM',
    venue: 'Orlando · Studio B',
    price: 32,
  },
]

// Demo availability is stored separately for each event.
const reservedSeatsByEvent: Record<number, string[]> = {
  1: ['A3', 'B5', 'C2'],
  2: ['A1', 'A2', 'C6'],
}

function createSeats(eventId: number): Seat[] {
  const reservedLabels = reservedSeatsByEvent[eventId] ?? []

  return ['A', 'B', 'C', 'D'].flatMap((row) =>
    Array.from({ length: 8 }, (_, index) => {
      const label = `${row}${index + 1}`

      return {
        id: `${eventId}-${label}`,
        label,
        isReserved: reservedLabels.includes(label),
      }
    }),
  )
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price)
}

function App() {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null)

  // Derive display data from IDs to avoid duplicating state.
  const selectedEvent = events.find(
    (event) => event.id === selectedEventId,
  )

  const seats = selectedEvent ? createSeats(selectedEvent.id) : []

  const selectedSeat = seats.find(
    (seat) => seat.id === selectedSeatId,
  )

  function handleSelectEvent(eventId: number) {
    setSelectedEventId(eventId)

    // A seat selection belongs to one event only.
    setSelectedSeatId(null)
  }

  function handleSelectSeat(seat: Seat) {
    if (seat.isReserved) {
      return
    }

    // Clicking the selected seat again clears the selection.
    setSelectedSeatId((currentId) =>
      currentId === seat.id ? null : seat.id,
    )
  }

  return (
    <main className="app">
      <header className="page-header">
        <p className="brand">TICKETFLOW</p>
        <h1>Find your next live experience.</h1>
        <p className="subtitle">Discover events in Orlando.</p>
      </header>

      <div className="booking-layout">
        <section aria-labelledby="events-heading">
          <h2 id="events-heading">Upcoming events</h2>

          <div className="event-list">
            {events.map((event) => {
              const isSelected = selectedEventId === event.id

              return (
                <article
                  className={`event-card ${isSelected ? 'event-card-selected' : ''}`}
                  key={event.id}
                >
                  <p className="event-date">{event.date}</p>
                  <h3>{event.title}</h3>
                  <p>{event.venue}</p>

                  <div className="event-card-footer">
                    <p className="event-price">
                      From {formatPrice(event.price)}
                    </p>

                    <button
                      type="button"
                      className="event-button"
                      aria-pressed={isSelected}
                      onClick={() => handleSelectEvent(event.id)}
                    >
                      {isSelected ? 'Selected' : 'Choose seats'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section
          className="seat-panel"
          aria-labelledby="seats-heading"
        >
          <h2 id="seats-heading">Choose your seat</h2>

          {!selectedEvent ? (
            <p className="empty-state">
              Select an event to view its seating chart.
            </p>
          ) : (
            <>
              <p className="selected-event-title">
                {selectedEvent.title}
              </p>
              <p className="seat-description">
                Select one available seat below.
              </p>

              <div className="stage">STAGE</div>

              <div
                className="seat-grid"
                role="group"
                aria-label={`Seats for ${selectedEvent.title}`}
              >
                {seats.map((seat) => {
                  const isSelected = selectedSeatId === seat.id

                  return (
                    <button
                      type="button"
                      key={seat.id}
                      className={`seat ${isSelected ? 'seat-selected' : ''}`}
                      disabled={seat.isReserved}
                      aria-pressed={isSelected}
                      aria-label={`Seat ${seat.label}${seat.isReserved ? ', reserved' : ''}`}
                      onClick={() => handleSelectSeat(seat)}
                    >
                      {seat.label}
                    </button>
                  )
                })}
              </div>

              <div className="seat-legend">
                <span>
                  <i className="legend-box legend-available" />
                  Available
                </span>
                <span>
                  <i className="legend-box legend-selected" />
                  Selected
                </span>
                <span>
                  <i className="legend-box legend-reserved" />
                  Reserved
                </span>
              </div>

              <div className="booking-summary" aria-live="polite">
                <h3>Your selection</h3>

                <dl>
                  <div className="summary-row">
                    <dt>Event</dt>
                    <dd>{selectedEvent.title}</dd>
                  </div>

                  <div className="summary-row">
                    <dt>Seat</dt>
                    <dd>{selectedSeat?.label ?? 'Not selected'}</dd>
                  </div>

                  <div className="summary-row summary-total">
                    <dt>Total</dt>
                    <dd>
                      {formatPrice(
                        selectedSeat ? selectedEvent.price : 0,
                      )}
                    </dd>
                  </div>
                </dl>

                {selectedSeat && (
                  <button
                    type="button"
                    className="clear-button"
                    onClick={() => setSelectedSeatId(null)}
                  >
                    Clear selection
                  </button>
                )}
              </div>

              <p className="demo-note">
                Demo seating only. Selecting a seat does not reserve it.
                Selections reset when you refresh the page.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

export default App
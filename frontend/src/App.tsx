import { useEffect, useState } from 'react'
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
  is_reserved: boolean
}

type ApiState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price)
}

// Share loading, cancellation, timeout, and retry behavior across GET requests.
function useApi<T>(path: string) {
  const [state, setState] = useState<ApiState<T>>({
    status: 'loading',
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let disposed = false
    let timedOut = false

    setState({ status: 'loading' })

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 10000)

    async function load() {
      try {
        const response = await fetch(path, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Request failed (HTTP ${response.status}).`)
        }

        const data: T = await response.json()

        // Ignore results from an unmounted or superseded request.
        if (!disposed) {
          setState({ status: 'success', data })
        }
      } catch (error: unknown) {
        if (disposed) {
          return
        }

        const message = timedOut
          ? 'The request timed out. Please try again.'
          : error instanceof Error
            ? error.message
            : 'Unable to load data.'

        setState({ status: 'error', message })
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    void load()

    return () => {
      disposed = true
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [path, attempt])

  function retry() {
    setState({ status: 'loading' })
    setAttempt((current) => current + 1)
  }

  return { state, retry }
}

type RequestErrorProps = {
  message: string
  onRetry: () => void
}

function RequestError({ message, onRetry }: RequestErrorProps) {
  return (
    <div role="alert">
      <p>{message}</p>
      <p className="seat-description">
        Check that the backend is running, then try again.
      </p>
      <button
        type="button"
        className="event-button"
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  )
}

type SeatPickerProps = {
  event: TicketEvent
}

function SeatPicker({ event }: SeatPickerProps) {
  const { state, retry } = useApi<Seat[]>(
    `/api/events/${event.id}/seats`,
  )

  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(
    null,
  )

  if (state.status === 'loading') {
    return (
      <p className="empty-state" role="status">
        Loading seats…
      </p>
    )
  }

  if (state.status === 'error') {
    return (
      <RequestError
        message={state.message}
        onRetry={retry}
      />
    )
  }

  const seats = state.data
  const selectedSeat = seats.find(
    (seat) => seat.id === selectedSeatId && !seat.is_reserved,
  )

  function handleSelectSeat(seat: Seat) {
    if (seat.is_reserved) {
      return
    }

    setSelectedSeatId((currentId) =>
      currentId === seat.id ? null : seat.id,
    )
  }

  if (seats.length === 0) {
    return (
      <p className="empty-state">
        No seats are available for this event.
      </p>
    )
  }

  return (
    <>
      <p className="selected-event-title">{event.title}</p>
      <p className="seat-description">
        Select one available seat below.
      </p>

      <div className="stage">STAGE</div>

      <div
        className="seat-grid"
        role="group"
        aria-label={`Seats for ${event.title}`}
      >
        {seats.map((seat) => {
          const isSelected = selectedSeat?.id === seat.id

          return (
            <button
              type="button"
              key={seat.id}
              className={`seat ${isSelected ? 'seat-selected' : ''}`}
              disabled={seat.is_reserved}
              aria-pressed={isSelected}
              aria-label={`Seat ${seat.label}${seat.is_reserved ? ', reserved' : ''}`}
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
            <dd>{event.title}</dd>
          </div>

          <div className="summary-row">
            <dt>Seat</dt>
            <dd>{selectedSeat?.label ?? 'Not selected'}</dd>
          </div>

          <div className="summary-row summary-total">
            <dt>Total</dt>
            <dd>
              {formatPrice(selectedSeat ? event.price : 0)}
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
        Demo availability is loaded from the API. Selecting a seat
        does not reserve it. Selections reset when you refresh the page.
      </p>
    </>
  )
}

function App() {
  const { state, retry } = useApi<TicketEvent[]>('/api/events')
  const [selectedEventId, setSelectedEventId] = useState<number | null>(
    null,
  )

  const events = state.status === 'success' ? state.data : []
  const selectedEvent = events.find(
    (event) => event.id === selectedEventId,
  )

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

          {state.status === 'loading' && (
            <p className="empty-state" role="status">
              Loading events…
            </p>
          )}

          {state.status === 'error' && (
            <RequestError
              message={state.message}
              onRetry={retry}
            />
          )}

          {state.status === 'success' && events.length === 0 && (
            <p className="empty-state">
              No upcoming events. Please check back later.
            </p>
          )}

          {state.status === 'success' && (
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
                        onClick={() => setSelectedEventId(event.id)}
                      >
                        {isSelected ? 'Selected' : 'Choose seats'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section
          className="seat-panel"
          aria-labelledby="seats-heading"
        >
          <h2 id="seats-heading">Choose your seat</h2>

          {selectedEvent ? (
            // A new event gets fresh selection state and cancels the old request.
            <SeatPicker
              key={selectedEvent.id}
              event={selectedEvent}
            />
          ) : (
            <p className="empty-state">
              Select an event to view its seating chart.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}

export default App
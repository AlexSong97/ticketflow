import './App.css'

type Event = {
  id: number
  title: string
  date: string
  venue: string
  price: number
}

const events: Event[] = [
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

function App() {
  return (
    <main className="app">
      <header>
        <p className="brand">TICKETFLOW</p>
        <h1>Find your next live experience.</h1>
        <p>Discover events in Orlando.</p>
      </header>

      <section aria-labelledby="events-heading">
        <h2 id="events-heading">Upcoming events</h2>

        <div className="event-list">
          {events.map((event) => (
            <article className="event-card" key={event.id}>
              <p className="event-date">{event.date}</p>
              <h3>{event.title}</h3>
              <p>{event.venue}</p>
              <p className="event-price">From ${event.price}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
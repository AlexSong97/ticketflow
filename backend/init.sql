BEGIN;

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    venue TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price > 0)
);

CREATE TABLE IF NOT EXISTS seats (
    event_id INTEGER NOT NULL REFERENCES events(id),
    label TEXT NOT NULL,
    is_reserved BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (event_id, label)
);

INSERT INTO events (id, title, date, venue, price)
VALUES
    (1, 'Midnight Sessions', 'December 12, 2026 · 7:30 PM',
     'Orlando · Main Hall', 45),
    (2, 'Sunday in Blue', 'December 20, 2026 · 6:00 PM',
     'Orlando · Studio B', 32)
ON CONFLICT (id) DO NOTHING;

-- Create four rows of eight seats for each demo event.
INSERT INTO seats (event_id, label, is_reserved)
SELECT
    event.id,
    seat_row.letter || seat_number.number::TEXT,
    CASE event.id
        WHEN 1 THEN seat_row.letter || seat_number.number::TEXT
            IN ('A3', 'B5', 'C2')
        WHEN 2 THEN seat_row.letter || seat_number.number::TEXT
            IN ('A1', 'A2', 'C6')
    END
FROM events AS event
CROSS JOIN (VALUES ('A'), ('B'), ('C'), ('D')) AS seat_row(letter)
CROSS JOIN generate_series(1, 8) AS seat_number(number)
WHERE event.id IN (1, 2)
ON CONFLICT (event_id, label) DO NOTHING;

COMMIT;
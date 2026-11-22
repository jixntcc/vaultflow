# VaultFlow Personal OS — ActivityItem Contract (OS1)

## Purpose
ActivityItem is a read-time presentation contract for the Personal OS dashboard. It does not replace, copy, or own source records.

## Shape
- `id`: stable presentation ID, `<module>:<recordId>`
- `type`: transaction | habit | memory | note | portfolio
- `category`: module-specific category/status
- `title`: short display title
- `description`: optional supporting text
- `date`: date-only `YYYY-MM-DD`
- `time`: optional local display time `HH:mm`
- `amount`: optional finite numeric amount
- `currency`: optional ISO-like currency code; never inferred when absent
- `source`: `{ module, recordId }` link to the authoritative record
- `metadata`: optional module-specific display data

## Rules
1. Source collections remain authoritative.
2. ActivityItems are generated at read time and are not persisted.
3. Date-only values are not converted through UTC.
4. Transaction amounts have no currency field in the current source schema, so the aggregator returns no currency for them.
5. Portfolio positions are current-state records. Without historical price snapshots, they must not be represented as historical daily events.
6. Memories retain their original event date. The daily feed shows exact-date memories; the separate On This Day list groups matching month/day values across years.
7. Habit events use HabitLog.scheduledDate. Completed time is display-only and formatted in the requested timezone.
8. All source queries must be scoped to the authenticated user.

## OS2 Endpoint
`GET /api/activity?date=YYYY-MM-DD&timezone=Asia/Kolkata`

The endpoint returns a daily summary, normalized activities, On This Day memories, a clearly labelled current Portfolio snapshot, and a coverage map for modules not yet integrated.

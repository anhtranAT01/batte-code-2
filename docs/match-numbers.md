# Public match numbers

History, recent matches, administration and replay now display stable numbers
such as `#001` or `#042`. UUID primary keys are retained for API actions. A match's
number is not its position in a filtered or paginated table. Deleting another
match never changes its number and deleted numbers are not reused.

The normal Render `deployDatabase.js` setup runs `matchNumbers.sql` before the
new API starts. It adds a bigint column, backfills existing matches in
`created_at, id` order, and installs a unique sequence-backed default for new
inserts. The migration locks match writes during the one-time backfill; run it
during a deployment with an appropriate maintenance window for large histories.
It is idempotent and preserves the existing UUIDs/replays. Fresh SQL/Prisma
schemas also include the public number. No frontend-only row counters are used.

The replay endpoint accepts `42`, `042`, URL-encoded `#042`, or the existing UUID
identifiers. The browser encodes `#` so it is sent to the server, rather than
interpreted as a URL fragment. Display numbers are sent as strings by pg to
preserve bigint precision. Frontend filtering accepts the same zero-padded code.

`npm run test:match-numbers` (backend) verifies API behavior and optionally runs
the actual SQL migration on an isolated test schema with rollback when
`TEST_DATABASE_URL` is set. Alternatively `TEST_PGLITE_MODULE` may point to an
independently installed PGlite module to run PostgreSQL entirely in memory;
PGlite is not a production dependency. `npm run test:match-labels` (frontend)
checks filtering, stable display and preservation of UUID action arguments.

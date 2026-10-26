# Arena responsiveness and capacity

Practice/PvP simulations execute in a bounded reusable Node worker pool. Heavy
Minimax/A* computation no longer runs on the Express request thread. The browser
requests NDJSON and displays the initial board and batches of actual moves as
they arrive. Normal JSON clients remain supported. Leaving a live match aborts
the request, cancels queued work, and stops its Python process tree. Completed
matches retain the same replay and rating persistence path.

The pool defaults to one computation worker per API instance, at most 16 waiting
matches, and a 60-second computation deadline. Each account (or guest IP) can run
one match at a time. Full queues return 429; duplicate requests return 409.
`DUEL_WORKERS` (1–4), `DUEL_QUEUE_LIMIT` (1–100), and `DUEL_TIMEOUT_MS` (up to
180000) can be set through Render environment variables. Increase parallelism
only after measuring CPU/memory on the deployed server. The Render blueprint
uses one worker for its 0.5 CPU / 512 MB service. The tournament judge is a
separate existing process and also consumes capacity on that service.

This queue is local to an API instance. Multi-instance execution and very large
numbers of concurrent matches need a shared scheduler/worker deployment and a
production load test; these changes do not establish an unlimited player count.
On the current single Render API instance this admits at most 17 simultaneous
match requests (one running and 16 waiting); this is a match limit, not a limit
on spectators or WebSocket connections. Online-count broadcasts are coalesced
for 500 ms during connection bursts, and per-socket lifecycle logs are disabled
unless `SOCKET_VERBOSE_LOGS=true`.
Uploaded Python bots still start an isolated process each turn, preserving the
existing stdin/stdout protocol, timeout and fresh-process behavior. Output is
limited to 128 KB per turn so a noisy bot cannot grow server buffers indefinitely.

Minimax keeps its full three-ply search and repetition/combat/buff rules, but
search branches skip recording replay snapshots that were immediately discarded.
The equivalence test compares all decisions, scores, search node counts and final
replay with recording enabled. A local 80-turn HARD-vs-HARD fixture produces 80
real snapshots instead of 58,136 snapshots including search branches.

Leaderboard and history load independently. Public summaries are deduplicated
and cached for 10 seconds in the browser and 5 seconds on the server. Successful
match/admin writes invalidate the appropriate caches. History queries return
compact result/identity metadata instead of complete replay boards. The new
`Matches(created_at DESC, id DESC)` index is installed idempotently by the normal
database deploy script. There is no data rewrite. Screens outside the initial
leaderboard load as separate JavaScript chunks.

Measurements from the development machine/current configured database, not a
capacity guarantee: initial JavaScript fell from 343 KB to 214 KB (gzip 68.5 KB).
For 10 recent matches, database payload fell from 4,030,407 to 7,306 bytes.
Median of five alternating uncached reads: leaderboard 108 to 43.5 ms, recent
matches 81.3 to 41.5 ms. Network, hardware, dataset size and cold starts affect
deployed timings.

Verification:

```
cd backend
npm run test:performance
npm run test:practice
npm run test:pvp
npm run test:history
npm run test:admin-accounts
cd ../frontend
npm run test:bot-flows
npm run test:performance
npm run build
```

Admin account/password management is described in `backend/src/admin/README.md`.

Submission ingestion and Python validation have a separate measured report in
[`submission-capacity.md`](submission-capacity.md). The submission scheduler now
drains ready jobs without a fixed two-second gap, retaining one worker and the
existing retry/pause behavior. This does not change the PvP match queue limit.

Frontend navigation and rendering (2026-10-26): hovering/focusing a sidebar item
preloads only that screen's JavaScript. Public-summary requests now have a
12-second deadline and remain retryable; late results cannot replace fresh data.
Tournament changes cancel the previous standings request and ignore stale
responses. Outbox notification bursts share one refresh after 300 ms. The
countdown updates in a separate component so it no longer rebuilds standings
rows each second. Board glyph artwork is reused and unchanged board props skip
rendering. A failed screen module has a recovery panel; changing tabs still works.
Tab navigation resets the main scroll position before paint.

Light mode uses theme-aware surface colors, darker text, explicit solid-button
labels, and readable forms/tables. Default dark mode is preserved. The saved
theme applies before the initial paint to avoid a flash of the wrong appearance.
Browser QA uses `frontend/tests/preview-resilience.cjs` with a mock API and a real
local duel worker, separate from production. Regression tests verify request
timeouts, late tournament results, countdown isolation, coalesced refreshes and
screen recovery; they do not establish a production FPS or latency guarantee.

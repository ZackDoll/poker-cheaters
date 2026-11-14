# poker-cheaters

A course project that estimates whether a poker player is bluffing. Specialist models read the player's face, their speech and the board. A decision model combines those outputs into a bluff score and its top 2-3 reasons.

## Setup

You need Node 22+, Docker, and Python 3.12 or 3.13.

**Backend**

```sh
docker compose up -d --wait            # start Postgres

cd backend
python3.13 -m venv .venv               # or python3.12
source .venv/bin/activate
pip install -e ".[dev]"                # add facial or speech to install those models' libraries
alembic upgrade head
uvicorn app.main:app --reload
```

API docs are at http://localhost:8000/docs, and the health check is at http://localhost:8000/api/health.

**Frontend**

```sh
npm install
npm run dev
```

Vite forwards `/api` requests to the backend on port 8000.

**Tests**

```sh
cd backend && source .venv/bin/activate && pytest
```

## How a prediction works

```
                            ┌─ facial model ────┐
POST /api/predictions  ───▶ ├─ speech model ────┼─▶ decision model ─▶ score + top reasons
(game state + clips)        └─ statistics model ┘
```

Try it with a state-only request, using the `id` returned by the first command as the session ID:

```sh
curl -X POST localhost:8000/api/sessions -H 'Content-Type: application/json' -d '{"label": "demo"}'

curl -X POST localhost:8000/api/predictions \
  -F session_id=<session id> \
  -F 'state={"street":"river","pot_size":100,"bet_size":150,"big_blind":2,"num_active_players":2,"target_position":"late","board":["Kd","7c","2h","9s","3d"],"observer_hole_cards":["Ah","Qs"]}'
```

To record what really happened, send `{"was_bluff": true, "outcome_source": "self_report"}` to `POST /api/predictions/<id>/outcome`. Those labels become the training data.

## Live rooms

Up to six people can play No-Limit Hold'em with virtual chips, with cameras and microphones on. A host creates a room, shares the six-character code, and everyone joins from the **Play live** tab in the header. Every bet or raise gets a bluff read, shown live (open reads) or after the hand (sealed reads), and finished games fill the Sessions and Opponents tabs.

```
Browser ──WebSocket──▶ FastAPI (rooms, engine, models, Postgres)
   │  └─ derived face scores only (no video)
   └── WebRTC peer to peer ── other players' browsers (video + voice)
Vercel function api/auth/room-token.js ─▶ signed one-hour token that FastAPI trusts
```

To run it locally you need the login functions, so use `vercel dev` instead of `npm run dev`:

1. Put the same random `ROOM_TOKEN_SECRET` in the root `.env.local` and in `backend/.env` (see the two `.env.example` files).
2. Start Postgres and FastAPI as in Setup, then run `alembic upgrade head` to add the new tables.
3. Run `vercel dev` with `VITE_GAME_API_URL=http://localhost:8000/api` and `VITE_GAME_WS_URL=ws://localhost:8000/api` set.
4. Open the app in two or three browser profiles (or devices) to fill a table.

Things to know:

- Each player's browser measures their own expression changes against a 10-second neutral calibration and sends only those scores. Video and audio never reach the server.
- Players behind strict networks may need a TURN server. Set `VITE_TURN_URL`, `VITE_TURN_USERNAME` and `VITE_TURN_CREDENTIAL`.
- The server keeps rooms in memory, so it must run as a single process.
- Bets are scored after the hand against a simple hand-strength definition of a bluff (`backend/app/services/poker/bluff_rule.py`). Agree on it as a team before using the labels for training.
- Everyone at a table can see each other's bluff reads and facial tells in their profiles. The check-in screen asks for consent first.

## Current status

- **Statistics model:** working, using hand-written poker rules.
- **Live facial model:** reads the expression-change score a player's browser measured. It affects the score a little, and its weight is a hand-set placeholder.
- **Facial and speech models:** stubs that don't affect the score. See [AGENTS.md](AGENTS.md) for how to implement them.
- **Decision model:** a weighted baseline with hand-set weights. Its output is an unvalidated score rather than a true probability, so responses report `calibrated: false`.

## Before collecting data

- **Define a bluff.** Agree on a written rule before labelling anything, since hands that don't reach showdown have no cards to check.
- **Get consent.** Faces and voices are biometric data, so everyone recorded must agree, and you should ask the instructor whether collecting a dataset needs IRB review. Raw clips are deleted after each request, and only model outputs are stored.
- **Keep it to research and demos.** Using this in real-money games would likely break the rules.

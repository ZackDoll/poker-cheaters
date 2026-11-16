# poker-cheaters

A course project that estimates whether a poker player is bluffing. Specialist models read the player's face, their speech and the board. A decision model combines those outputs into a bluff score and its top 2-3 reasons. The working app is a card tracker on Vercel (see [Card tracker](#card-tracker)); the Python prediction backend is kept alongside it.

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

## Card tracker

The app you can run today. One person logs a game, hand by hand, and gets a bluff read on every bet. It runs on Vercel alone: the React frontend plus serverless functions in `api/`, with a Neon Postgres database.

1. **Start a session** on the Track page (`/sessions`).
2. **Start a hand**, add the board as it comes (flop, turn, river), and optionally your own two cards.
3. **Log what an opponent did**: pick them, tap fold, check, call, bet or raise, and enter the bet and pot sizes. Bets and raises come back with a bluff estimate and the top reasons behind it.
4. **Optional face read:** turn the camera on, calibrate the player's relaxed face for 10 seconds, and each bet you log carries their recent expression changes. The video is processed in your browser and never recorded or uploaded; only derived scores are sent.
5. **Enter the cards they show** at showdown. That is what labels each of their bets as a bluff or a value bet, and fills their profile (bluff rate, how readable they are, and the tells that showed up).

To run it locally:

1. Install the Vercel CLI (`npm i -g vercel`) and run `vercel dev`. Plain `npm run dev` serves only the frontend.
2. Copy `.env.example` to `.env.local` and fill it in. Vercel won't pull Sensitive values, so copy the Google OAuth client and the Neon connection string from their consoles.
3. Run `db/schema.sql` against the Neon database (SQL editor or `psql`). It is safe to run again: every statement is `if not exists`.

Things to know:

- The estimate is a hand-set rule model, not a trained one. It is not a probability, and the screens say so.
- A bet is scored as a bluff by a simple hand-strength rule (`api/_lib/bluffRule.js`). Agree on it as a team before using the labels for training.
- Bets an opponent never showed down on stay unscored.
- Each user sees only their own sessions and opponents.

## The prediction backend (not currently used)

The FastAPI service described under Setup (upload prediction endpoints, models, Alembic, local Postgres) is kept for the prediction/ML work but is not deployed and not called by the app. The live multiplayer rooms that were built on it were removed, and can be found in git history (`f0fc29a`).

## Current status

- **Statistics model:** working, using hand-written poker rules.
- **Card tracker scoring** (`api/_lib/scoring.js`): hand-set rules on the bet and board, plus the face score from the browser, fused as log-odds.
- **Facial and speech models:** stubs that don't affect the score. See [AGENTS.md](AGENTS.md) for how to implement them.
- **Decision model:** a weighted baseline with hand-set weights. Its output is an unvalidated score rather than a true probability, so responses report `calibrated: false`.

## Before collecting data

- **Define a bluff.** Agree on a written rule before labelling anything, since hands that don't reach showdown have no cards to check.
- **Get consent.** Faces and voices are biometric data, so everyone recorded must agree, and you should ask the instructor whether collecting a dataset needs IRB review. Raw clips are deleted after each request, and only model outputs are stored.
- **Keep it to research and demos.** Using this in real-money games would likely break the rules.

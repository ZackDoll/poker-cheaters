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

## Current status

- **Statistics model:** working, using hand-written poker rules.
- **Facial and speech models:** stubs that don't affect the score. See [AGENTS.md](AGENTS.md) for how to implement them.
- **Decision model:** a weighted baseline with hand-set weights. Its output is an unvalidated score rather than a true probability, so responses report `calibrated: false`.

## Before collecting data

- **Define a bluff.** Agree on a written rule before labelling anything, since hands that don't reach showdown have no cards to check.
- **Get consent.** Faces and voices are biometric data, so everyone recorded must agree, and you should ask the instructor whether collecting a dataset needs IRB review. Raw clips are deleted after each request, and only model outputs are stored.
- **Keep it to research and demos.** Using this in real-money games would likely break the rules.

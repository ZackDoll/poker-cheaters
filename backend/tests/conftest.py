import os

# Set before any app import, because the DB engine is created at import time.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://poker:poker@localhost:5432/poker_test"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

import pytest  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import make_url, text  # noqa: E402

from alembic import command  # noqa: E402
from app.config import BACKEND_DIR, get_settings  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.game import GameState  # noqa: E402


@pytest.fixture(scope="session")
def migrated_db():
    """Rebuild the test database through the real migrations, in both directions."""
    database = make_url(TEST_DATABASE_URL).database or ""
    if not database.endswith("_test"):
        pytest.exit(f"Refusing to wipe {database!r}: its name must end in _test", returncode=1)

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(config, "head")
    command.downgrade(config, "base")
    command.upgrade(config, "head")


@pytest.fixture
def client(migrated_db):
    with TestClient(app) as test_client:
        yield test_client
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE game_sessions CASCADE"))


@pytest.fixture
def settings():
    return get_settings()


def make_state(**overrides) -> dict:
    state = {
        "street": "river",
        "pot_size": 100,
        "bet_size": 150,
        "big_blind": 2,
        "num_active_players": 2,
        "target_position": "late",
        "board": ["Kd", "7c", "2h", "9s", "3d"],
        "observer_hole_cards": ["Ah", "Qs"],
    }
    return state | overrides


@pytest.fixture
def game_state() -> GameState:
    return GameState.model_validate(make_state())

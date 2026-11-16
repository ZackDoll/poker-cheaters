import json
import uuid

import pytest
from sqlalchemy import text

from app.db.session import engine
from app.ml.base import SignalModel
from app.ml.decision.baseline import BaselineDecisionModel
from app.ml.registry import ModelRegistry
from tests.conftest import make_state


@pytest.fixture
def session_id(client):
    response = client.post("/api/sessions", json={"label": "test game"})
    assert response.status_code == 201
    return response.json()["id"]


def predict(client, session_id, state=None, files=None):
    return client.post(
        "/api/predictions",
        data={"session_id": session_id, "state": json.dumps(state or make_state())},
        files=files,
    )


def test_health_reports_database_and_models(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["database"] == "up"
    assert {m["name"]: m["status"] for m in body["models"]} == {
        "facial": "loaded",
        "speech": "loaded",
        "statistics": "loaded",
    }


def test_prediction_with_state_only(client, session_id):
    response = predict(client, session_id)
    assert response.status_code == 201
    body = response.json()
    assert 0 <= body["bluff_probability"] <= 1
    assert body["calibrated"] is False
    assert 1 <= len(body["reasons"]) <= 3
    assert {r["source"] for r in body["reasons"]} == {"statistics"}
    assert {s["model_name"]: s["status"] for s in body["signals"]} == {
        "facial": "stub",
        "speech": "stub",
        "statistics": "ok",
    }


def test_prediction_can_be_fetched_again(client, session_id):
    created = predict(client, session_id).json()
    fetched = client.get(f"/api/predictions/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == created


def test_unknown_ids_return_404(client, session_id):
    missing = str(uuid.uuid4())
    assert predict(client, missing).status_code == 404
    assert client.get(f"/api/predictions/{missing}").status_code == 404
    outcome = {"was_bluff": True, "outcome_source": "self_report"}
    assert client.post(f"/api/predictions/{missing}/outcome", json=outcome).status_code == 404


def test_invalid_state_returns_422(client, session_id):
    assert predict(client, session_id, make_state(board=["Kd"])).status_code == 422
    target_cards = make_state(target_hole_cards=["As", "Ks"])
    assert predict(client, session_id, target_cards).status_code == 422
    response = client.post(
        "/api/predictions", data={"session_id": session_id, "state": "not json"}
    )
    assert response.status_code == 422


def test_outcome_labels_the_decision(client, session_id):
    prediction_id = predict(client, session_id).json()["id"]
    response = client.post(
        f"/api/predictions/{prediction_id}/outcome",
        json={"was_bluff": True, "outcome_source": "showdown", "target_hole_cards": ["4c", "5c"]},
    )
    assert response.status_code == 200
    assert response.json()["was_bluff"] is True

    with engine.connect() as connection:
        row = connection.execute(
            text("SELECT was_bluff, revealed_target_cards, labeled_at FROM decisions")
        ).one()
        signal_rows = connection.execute(text("SELECT count(*) FROM signal_outputs")).scalar()
    assert row.was_bluff is True
    assert row.revealed_target_cards == ["4c", "5c"]
    assert row.labeled_at is not None
    assert signal_rows == 3


def test_outcome_rejects_cards_already_visible(client, session_id):
    prediction_id = predict(client, session_id).json()["id"]
    response = client.post(
        f"/api/predictions/{prediction_id}/outcome",
        json={"was_bluff": False, "outcome_source": "showdown", "target_hole_cards": ["Kd", "5c"]},
    )
    assert response.status_code == 409


class ClipSpy(SignalModel):
    name = "spy"
    version = "1"

    def __init__(self):
        self.paths = []
        self.contents = []

    def predict(self, ctx):
        for path in (ctx.video_path, ctx.audio_path):
            self.paths.append(path)
            self.contents.append(path.read_bytes())
        return self.output("stub")


def test_clips_reach_models_and_are_deleted_afterward(client, session_id):
    spy = ClipSpy()
    client.app.state.registry = ModelRegistry([spy], BaselineDecisionModel(0.5, {}))
    response = predict(
        client,
        session_id,
        files={
            "video": ("../../evil.sh", b"video-bytes", "video/webm;codecs=vp8"),
            "audio": ("clip.wav", b"audio-bytes", "audio/wav"),
        },
    )
    assert response.status_code == 201
    assert spy.contents == [b"video-bytes", b"audio-bytes"]
    assert spy.paths[0].name == "video.webm"  # The client's filename is never used.
    assert not any(path.exists() for path in spy.paths)


@pytest.mark.parametrize(
    "files, status",
    [
        ({"video": ("a.txt", b"data", "text/plain")}, 415),
        ({"audio": ("a.webm", b"data", "video/webm")}, 415),
        ({"video": ("a.webm", b"", "video/webm")}, 422),
    ],
)
def test_bad_uploads_are_rejected(client, session_id, files, status):
    assert predict(client, session_id, files=files).status_code == status


def test_file_over_the_limit_is_rejected(client, session_id, settings, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_bytes", 10)
    response = predict(client, session_id, files={"video": ("a.webm", b"x" * 11, "video/webm")})
    assert response.status_code == 413


def test_huge_request_is_rejected_before_parsing(client, session_id, settings, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_bytes", 10)
    big = b"x" * (2 * 1024 * 1024)
    response = predict(client, session_id, files={"video": ("a.webm", big, "video/webm")})
    assert response.status_code == 413
    assert response.json() == {"detail": "Upload is too large"}

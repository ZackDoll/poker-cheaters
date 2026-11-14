import pytest
from pydantic import ValidationError

from app.ml.base import DecisionContext
from app.ml.decision.baseline import BaselineDecisionModel
from app.ml.live_facial.model import LiveFacialModel
from app.schemas.game import GameState
from app.schemas.signals import FaceDeviation, LiveFaceFeatures
from tests.conftest import make_state


def context(features: LiveFaceFeatures | None) -> DecisionContext:
    return DecisionContext(state=GameState.model_validate(make_state()), live_face=features)


def features(mean=6.0, samples=6, tracked=1.0, deviations=None) -> LiveFaceFeatures:
    return LiveFaceFeatures(
        mean_score=mean,
        peak_score=min(10, mean + 1),
        deviations=deviations or [],
        tracked_ratio=tracked,
        samples=samples,
    )


def test_unavailable_without_features_or_with_too_little_tracking():
    model = LiveFacialModel()
    assert model.predict(context(None)).status == "unavailable"
    assert model.predict(context(features(samples=1))).status == "unavailable"
    assert model.predict(context(features(tracked=0.1))).status == "unavailable"


def test_large_change_points_toward_a_bluff_and_calm_points_away():
    model = LiveFacialModel()
    busy = model.predict(context(features(mean=8.0)))
    calm = model.predict(context(features(mean=0.5)))
    assert busy.status == calm.status == "ok"
    assert busy.evidence[0].log_odds > 0 > calm.evidence[0].log_odds
    assert busy.score > 0.5 > calm.score


def test_tells_are_recorded_but_never_change_the_score():
    deviations = [
        FaceDeviation(name="browDownLeft", z=3.5),
        FaceDeviation(name="mouthPressRight", z=-2.4),
        FaceDeviation(name="jawOpen", z=0.5),
    ]
    output = LiveFacialModel().predict(context(features(deviations=deviations)))
    tells = [e for e in output.evidence if e.code.startswith("tell:")]
    assert [t.code for t in tells] == ["tell:browDownLeft", "tell:mouthPressRight"]
    assert all(t.log_odds == 0 for t in tells)
    assert "Brow movement up" in tells[0].description


def test_confidence_scales_with_tracking_and_samples():
    model = LiveFacialModel()
    full = model.predict(context(features(samples=12)))
    thin = model.predict(context(features(samples=3, tracked=0.5)))
    assert full.confidence == pytest.approx(1.0)
    assert thin.confidence == pytest.approx(0.25)


def test_fusion_includes_the_reason_when_weighted():
    model = LiveFacialModel()
    output = model.predict(context(features(mean=9.0)))
    fused = BaselineDecisionModel(0.35, {"live_facial": 0.5}).fuse([output])
    assert fused.reasons[0].source == "live_facial"
    assert fused.bluff_probability > 0.35


def test_feature_schema_rejects_out_of_range_values():
    with pytest.raises(ValidationError):
        LiveFaceFeatures(mean_score=11, peak_score=1, tracked_ratio=1, samples=3)
    with pytest.raises(ValidationError):
        LiveFaceFeatures(mean_score=1, peak_score=1, tracked_ratio=float("nan"), samples=3)

import pytest

from app.ml.decision.baseline import BaselineDecisionModel
from app.schemas.signals import Evidence, SignalOutput, logit, sigmoid


def signal(name, *log_odds, status="ok", confidence=1.0):
    return SignalOutput(
        model_name=name,
        model_version="test",
        status=status,
        confidence=confidence,
        evidence=[
            Evidence(code=f"{name}_{i}", description=f"{name} {i}", log_odds=value)
            for i, value in enumerate(log_odds)
        ],
    )


@pytest.fixture
def model():
    return BaselineDecisionModel(prior=0.35, weights={"a": 1.0, "b": 0.5})


def test_no_signals_returns_the_prior_with_no_reasons(model):
    result = model.fuse([])
    assert result.bluff_probability == pytest.approx(0.35)
    assert result.reasons == []
    assert result.calibrated is False


def test_fusion_applies_weight_and_confidence(model):
    result = model.fuse([signal("a", 1.0, confidence=0.5), signal("b", -0.4)])
    expected = sigmoid(logit(0.35) + 1.0 * 0.5 * 1.0 + 0.5 * 1.0 * -0.4)
    assert result.bluff_probability == pytest.approx(expected)


def test_keeps_three_largest_reasons_of_either_direction(model):
    result = model.fuse([signal("a", 0.2, -0.9, 0.5, 0.1)])
    assert [reason.code for reason in result.reasons] == ["a_1", "a_2", "a_0"]
    assert [reason.direction for reason in result.reasons] == [
        "away_from_bluff",
        "toward_bluff",
        "toward_bluff",
    ]


def test_reasons_can_be_fewer_than_three_and_skip_near_zero(model):
    result = model.fuse([signal("a", 0.5, 0.001)])
    assert [reason.code for reason in result.reasons] == ["a_0"]


def test_tied_reasons_have_a_stable_order(model):
    forward = model.fuse([signal("a", 0.5), signal("b", 1.0)])
    backward = model.fuse([signal("b", 1.0), signal("a", 0.5)])
    assert [r.source for r in forward.reasons] == ["a", "b"]
    assert [r.source for r in backward.reasons] == ["a", "b"]


@pytest.mark.parametrize("status", ["stub", "unavailable", "failed"])
def test_models_without_real_signal_have_no_effect(model, status):
    baseline = model.fuse([signal("a", 0.5)])
    result = model.fuse([signal("a", 0.5), signal("b", 9.0, status=status)])
    assert result.bluff_probability == baseline.bluff_probability
    assert [r.source for r in result.reasons] == ["a"]


def test_extreme_evidence_does_not_overflow(model):
    assert model.fuse([signal("a", -100000.0)]).bluff_probability < 1e-9
    assert model.fuse([signal("a", 100000.0)]).bluff_probability > 1 - 1e-9


def test_score_is_none_without_a_real_signal():
    assert signal("a", 1.0, status="stub").score is None
    assert signal("a", 0.0).score == pytest.approx(0.5)

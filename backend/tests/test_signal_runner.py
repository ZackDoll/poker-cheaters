import threading

from app.ml.base import DecisionContext, SignalModel
from app.ml.decision.baseline import BaselineDecisionModel
from app.ml.registry import ModelRegistry
from app.schemas.signals import Evidence
from app.services.prediction_service import run_signal_models


class Working(SignalModel):
    name = "working"
    version = "1"

    def predict(self, ctx):
        return self.output("ok", 1.0, [Evidence(code="x", description="x", log_odds=1.0)])


class Raises(SignalModel):
    name = "raises"
    version = "1"

    def predict(self, ctx):
        raise RuntimeError("model exploded")


class ReturnsNaN(SignalModel):
    name = "nan"
    version = "1"

    def predict(self, ctx):
        return self.output("ok", 1.0, [Evidence(code="x", description="x", log_odds=float("nan"))])


class Hangs(SignalModel):
    name = "hangs"
    version = "1"

    def __init__(self):
        self.release = threading.Event()

    def predict(self, ctx):
        self.release.wait(10)
        return self.output("ok", 1.0)


class WontLoad(SignalModel):
    name = "wont_load"
    version = "1"

    def load(self):
        raise ImportError("missing dependency")

    def predict(self, ctx):
        raise AssertionError("predict must not run when load failed")


class WrongName(SignalModel):
    name = "real_name"
    version = "2"

    def predict(self, ctx):
        return self.output("ok", 1.0).model_copy(update={"model_name": "other"})


def run(game_state, *models, timeout=5.0):
    registry = ModelRegistry(list(models), BaselineDecisionModel(0.5, {}))
    registry.load_all()
    runs = run_signal_models(registry, DecisionContext(game_state), timeout)
    return {r.output.model_name: r.output.status for r in runs}, runs


def test_a_raising_model_is_failed_and_others_still_run(game_state):
    statuses, _ = run(game_state, Working(), Raises())
    assert statuses == {"working": "ok", "raises": "failed"}


def test_nan_output_is_failed(game_state):
    statuses, _ = run(game_state, ReturnsNaN())
    assert statuses == {"nan": "failed"}


def test_a_hanging_model_times_out_without_blocking(game_state):
    hanging = Hangs()
    try:
        statuses, _ = run(game_state, Working(), hanging, timeout=0.2)
    finally:
        hanging.release.set()
    assert statuses == {"working": "ok", "hangs": "failed"}


def test_a_model_that_fails_to_load_is_unavailable(game_state):
    statuses, _ = run(game_state, Working(), WontLoad())
    assert statuses == {"working": "ok", "wont_load": "unavailable"}


def test_stored_name_comes_from_the_registry(game_state):
    _, runs = run(game_state, WrongName())
    assert runs[0].output.model_name == "real_name"
    assert runs[0].output.model_version == "2"

"""Lists the active models. Add new models here."""

import logging

from app.config import Settings
from app.ml.base import DecisionModel, SignalModel
from app.ml.decision.baseline import BaselineDecisionModel
from app.ml.facial.model import FacialModel
from app.ml.speech.model import SpeechModel
from app.ml.statistics.model import StatisticsModel

logger = logging.getLogger(__name__)


class ModelRegistry:
    def __init__(self, signal_models: list[SignalModel], decision_model: DecisionModel) -> None:
        self.signal_models = signal_models
        self.decision_model = decision_model
        self.failed_to_load: set[str] = set()

    def load_all(self) -> None:
        """Load every model. One broken model must not stop the API from starting."""
        for model in self.signal_models:
            try:
                model.load()
            except Exception:
                logger.exception("Could not load signal model %r", model.name)
                self.failed_to_load.add(model.name)

    def is_loaded(self, model: SignalModel) -> bool:
        return model.name not in self.failed_to_load


def build_registry(settings: Settings) -> ModelRegistry:
    signal_models: list[SignalModel] = [FacialModel(), SpeechModel(), StatisticsModel()]

    missing = {m.name for m in signal_models} - settings.fusion_weights.keys()
    if missing:
        raise ValueError(f"FUSION_WEIGHTS has no weight for: {sorted(missing)}")

    decision_model = BaselineDecisionModel(settings.bluff_prior, settings.fusion_weights)
    return ModelRegistry(signal_models, decision_model)

from app.ml.base import DecisionModel, FusionResult
from app.schemas.prediction import Reason
from app.schemas.signals import SignalOutput, logit, sigmoid

MAX_REASONS = 3
MIN_CONTRIBUTION = 0.01


class BaselineDecisionModel(DecisionModel):
    """Weighted log-odds fusion with hand-set weights.

    logit(p) = logit(prior) + sum over models of
               weight * confidence * sum of evidence log_odds

    The terms add up exactly, so the reasons are the real drivers of the number.
    The output is not calibrated until it has been fitted on held-out data.
    """

    version = "baseline-0.1"

    def __init__(self, prior: float, weights: dict[str, float]) -> None:
        self.prior = prior
        self.weights = weights

    def fuse(self, outputs: list[SignalOutput]) -> FusionResult:
        total = logit(self.prior)
        reasons: list[Reason] = []

        for output in outputs:
            if output.status != "ok":
                continue
            scale = self.weights[output.model_name] * output.confidence
            for item in output.evidence:
                contribution = scale * item.log_odds
                total += contribution
                if abs(contribution) >= MIN_CONTRIBUTION:
                    reasons.append(
                        Reason(
                            source=output.model_name,
                            code=item.code,
                            description=item.description,
                            direction="toward_bluff" if contribution > 0 else "away_from_bluff",
                            contribution=contribution,
                        )
                    )

        reasons.sort(key=lambda r: (-abs(r.contribution), r.source, r.code))
        return FusionResult(
            bluff_probability=sigmoid(total),
            reasons=reasons[:MAX_REASONS],
            calibrated=False,
            version=self.version,
        )

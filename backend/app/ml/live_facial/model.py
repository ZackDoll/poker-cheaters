import re

from app.ml.base import DecisionContext, SignalModel
from app.schemas.signals import Evidence, LiveFaceFeatures, SignalOutput

# A mean score around here is ordinary movement around the resting face.
NEUTRAL_SCORE = 3.0
LOG_ODDS_PER_POINT = 0.15
MIN_LOG_ODDS, MAX_LOG_ODDS = -0.3, 1.0
MIN_SAMPLES = 3
MIN_TRACKED_RATIO = 0.3
TELL_Z = 2.0
MAX_TELLS = 3

_GROUPS = [
    ("brow movement", re.compile(r"brow")),
    ("lip movement", re.compile(r"mouthPress|mouthPucker|mouthFunnel|mouthRoll|mouthShrug")),
    ("smile movement", re.compile(r"mouthSmile|mouthDimple")),
    ("jaw movement", re.compile(r"jaw")),
    ("eye narrowing", re.compile(r"eyeSquint|eyeWide")),
]


def _label(name: str) -> str:
    for label, pattern in _GROUPS:
        if pattern.search(name):
            return label
    return re.sub(r"([A-Z])", r" \1", name).lower().strip()


def _direction(z: float) -> str:
    return "up" if z > 0 else "down"


class LiveFacialModel(SignalModel):
    """Reads the expression-change score a player's browser measured against their baseline.

    The browser does the video work, so this model only judges derived numbers.
    The log-odds mapping is a hand-set placeholder, not fitted to data. Tell evidence
    has log_odds 0: it is stored for the player profile but never changes the score.
    """

    name = "live_facial"
    version = "rules-0.1"

    def predict(self, ctx: DecisionContext) -> SignalOutput:
        features = ctx.live_face
        if (
            features is None
            or features.samples < MIN_SAMPLES
            or features.tracked_ratio < MIN_TRACKED_RATIO
        ):
            return self.output("unavailable")

        confidence = features.tracked_ratio * min(1.0, features.samples / 6)
        return self.output(
            "ok", confidence, [self._change_evidence(features), *self._tells(features)]
        )

    def _change_evidence(self, features: LiveFaceFeatures) -> Evidence:
        log_odds = (features.mean_score - NEUTRAL_SCORE) * LOG_ODDS_PER_POINT
        log_odds = max(MIN_LOG_ODDS, min(MAX_LOG_ODDS, log_odds))
        if features.mean_score >= NEUTRAL_SCORE:
            strongest = features.deviations[0] if features.deviations else None
            where = f", mostly {_label(strongest.name)}" if strongest else ""
            description = f"Face moved away from their own resting baseline{where}"
        else:
            description = "Face stayed close to their own resting baseline"
        return Evidence(code="expression_change", description=description, log_odds=log_odds)

    def _tells(self, features: LiveFaceFeatures) -> list[Evidence]:
        strong = [d for d in features.deviations if abs(d.z) >= TELL_Z]
        strong.sort(key=lambda d: -abs(d.z))
        return [
            Evidence(
                code=f"tell:{d.name}",
                description=f"{_label(d.name).capitalize()} {_direction(d.z)} vs resting",
                log_odds=0.0,
            )
            for d in strong[:MAX_TELLS]
        ]

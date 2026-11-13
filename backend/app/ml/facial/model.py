from app.ml.base import DecisionContext, SignalModel
from app.schemas.signals import SignalOutput


class FacialModel(SignalModel):
    """Stub: returns no signal, so it cannot affect the percentage.

    To implement it:
    1. Import libraries from the [facial] extra inside load(), not at the top of
       this file, so teammates who don't work on this model don't need them.
    2. Return self.output("unavailable") when ctx.video_path is None.
    3. Return self.output("ok", confidence, evidence), where each Evidence has a
       specific description, since those become the reasons users see.
    4. Bump version whenever the behaviour or the weights change.
    """

    name = "facial"
    version = "stub-0.1"

    def predict(self, ctx: DecisionContext) -> SignalOutput:
        return self.output("stub")

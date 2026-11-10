# Training

Put training and evaluation scripts here, in one folder per model (`training/facial/`, and so on). Save weights to `backend/artifacts/`, which is gitignored, and load them in the model's `load()`.

## Training data for the decision model

Each row of this query is one labelled decision with its model outputs:

```sql
SELECT d.id, d.game_state, d.was_bluff, d.outcome_source,
       s.model_name, s.model_version, s.status, s.score, s.confidence, s.evidence
FROM decisions d
JOIN signal_outputs s ON s.decision_id = d.id
WHERE d.was_bluff IS NOT NULL;
```

## Rules for evaluation

- Never use `revealed_target_cards` as a model input. Use it only to work out the label.
- Split by session, not by row, so one player's game can't appear in both training and test data.
- Report results against a statistics-only baseline. If the facial and speech models don't beat it on held-out data, say so.
- Set `calibrated = True` in a decision model only after fitting and checking it on held-out data.

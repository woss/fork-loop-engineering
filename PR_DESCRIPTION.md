## Summary
Replaces exact string matching for error signatures with a highly robust **Character Trigram Jaccard Similarity** algorithm in `loop-context`, ensuring the circuit breaker trips on semantically-similar failures even if the phrasing or wording morphs slightly across iterations.

## Changes
- [ ] New pattern or starter (followed `templates/pattern-template.md` + updated `registry.yaml`)
- [ ] Doc / example improvement
- [x] Tool change (`loop-context`)
- [ ] Story (includes real failure or surprise + lesson)

## Checklist (from CONTRIBUTING)
- [ ] All required sections present for patterns
- [ ] Links work from README, patterns/README, starters/README, docs/index
- [x] No secrets, tokens, internal company URLs
- [ ] `STATE.md*` examples use `.example` suffix
- [ ] Safety-related content references `docs/safety.md`
- [x] Ran `node tools/loop-audit/dist/cli.js .` (or on the starter) and addressed findings

## Testing / Dogfood
- [x] `loop-audit` passes on affected starters or this repo (Scored 100/100 L3)
- [x] Manual review of generated state / skill output (Fully tested with `npm run test` inside `tools/loop-context` - all 49 edge-case and algorithm tests pass cleanly).

## Screenshots / Examples (if UI or command output)
**Running loop-context on slightly morphed failures:**
```bash
$ loop-context --check --stagnation 3 --similarity-threshold 0.85 < run.json
ESCALATE [stagnation] — Same error repeated 3× in a row (threshold 3): "Error: connection timeout on port #". Escalating instead of retrying.
```

---

*This template enforces the high bar this reference is known for.*

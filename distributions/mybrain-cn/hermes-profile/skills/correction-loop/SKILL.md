---
name: correction-loop
description: Use when the user corrects a fact, preference, or judgment.
---

# Correction loop

## Job

Make a correction survive the next session and preserve what changed.

## Steps

1. Repeat the corrected claim precisely; do not broaden it.
2. Use `remember` with provenance and entity. Let the engine return inserted, duplicate, or superseded.
3. If the correction invalidates a page-level judgment, update that page and keep the prior decision trail.
4. Open a fresh retrieval call and verify the corrected claim is returned.
5. Report the receipt: new truth, old truth superseded (if any), provenance, verification result.

Never claim success from the write response alone. The read-back is the proof.

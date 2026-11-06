---
name: torchmap
description: Use when a user wants to track model experiments in TorchMap, connect a version to its parent, publish training metrics or checkpoint evaluations, or verify and compare runs.
---

# TorchMap experiment tracking

Identify the target project and its writer before changing files. Read the deployment's TENSORMAP_TEAM.md if present at the workspace root or TorchMap deployment root. It identifies the authoritative data source, storage rules and viewer address. Use the user's own access. Recording a run does not require starting it.

## Choose the protocol

For a project.json with protocol tensormap/directory-1, publish files as described below. Inspect a sibling version for conventions. For an existing tensormap/0.1 event workspace, use the checkout's CLI (node src/cli.mjs help), its configured project and stable event IDs for retries. The corresponding specifications in the application checkout are docs/protocol/directory-v1.zh-CN.md and docs/protocol/v0.1.zh-CN.md. Never write the same experiment through both interfaces.

## Register a version and its run

1. Find the parent's stable version ID. Under the project's YYYY-MM-DD directory, create an unused NNN_name folder. Its version.json contains id, title, date, parents and changes (one to three verified differences). Use creator for attribution and optional changes.md for details. Root versions have empty parents. Use branch for inherited design, finetune for inherited weights and merge for a design merge. Keep the graph acyclic.
2. Create runs/01/run.json with a project-unique id, version_id, status, attempt and checkpoints. Record real step, total and last_seen when available. A new seed gets its own run. For inherited weights, init_from is the actual registered checkpoint ID of this version or a direct parent. Training from scratch uses null. Record raw and EMA as distinct checkpoint IDs with step, weights and uri after the files are complete.
3. Save effective parameters in config.json after all overrides. Keep the original config.yaml optionally. Publish metrics.jsonl with one newline-terminated object per observation, for example:
   `{"attempt":1,"step":5000,"metrics":{"loss":0.42,"optimizer/lr":0.00008}}`
   Use a single writer, generally rank 0. Publish metadata snapshots by same-directory temporary file and rename on supported storage. Continue an interrupted trial under the same run ID with an increased attempt and its resume_step in attempts. Keep raw data and weights at their existing storage locations.
4. For an imported run, update the source that owns the field. Hand edits to adapter-generated state can disappear on the next refresh.

## Publish an evaluation and verify

Under the producing run, create evals/<unique-name>/eval.json with id, checkpoint_id, dataset, split (validation or test), protocol, status and progress (done and total). Include the directory name in run.evaluations if that list exists. Publish the completed summary.json with numeric metrics and any applicable coverage, unit counts and timing before setting status to succeeded. An evaluation added later still points to its original checkpoint. Compare matching dataset, protocol, weight variant, units and coverage.

Verify the version and parent in the viewer's project response, run and checkpoint in its snapshot, and scalar step/value in its metrics endpoint. Verify the evaluation appears in the correct split at the checkpoint step. Report IDs, paths and the verified result. A stale heartbeat alone is insufficient evidence that a process exited.

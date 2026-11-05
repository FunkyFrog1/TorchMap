---
name: tensormap
description: Register model versions, training attempts, checkpoint-linked evaluations, and query comparisons in a local TensorMap workspace. Use when the user is tracking an experiment with TensorMap.
---

Use the TensorMap CLI in the user's checkout, `node src/cli.mjs help`, or its loopback HTTP API. The default URL is http://127.0.0.1:18770; TENSORMAP_URL and TENSORMAP_PROJECT select an instance and project. Query projects and snapshot before writing. Do not assume that a same-named version in another project is the intended one.

A changed recipe is a new version. A repeated seed trial is a new run. A restart of the same trial is the next attempt, with its own curve and an explicit same-run checkpoint when resuming. Register both the parent edge and the checkpoint for a fork that actually inherits weights. Register an evaluation against the exact checkpoint, weight variant, dataset and evaluation protocol.

Use the CLI's event subcommand with stable caller-generated IDs when retrying. A missing heartbeat is an unknown process state, not an authorization to stop or restart anything. Only launch or stop a process at the user's request. Compare completed evaluations using matching protocols and metric scales, and cite the contributing run and checkpoint IDs in the response.

Attach an existing human-provided note or figure only when requested. This version does not generate experiment journals. Do not copy weights, raw data or per-event dumps into attachments. The project ships the complete contract at docs/protocol/v0.1.zh-CN.md.

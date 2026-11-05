# Release checklist

The public repository is FunkyFrog1/Experiment-Map until its owner renames it. TensorMap is the new product name; protocol and application versions are independent.

Run npm ci, npm test and npm run test:ui. In an isolated TENSORMAP_HOME, run the synthetic walkthrough and verify a branch and its parent overlay. Match the application tag to package.json. Distribute source, docs, examples, skills and tests only. Never include data/, local notes, checkpoints, logs, node_modules or real project identifiers.

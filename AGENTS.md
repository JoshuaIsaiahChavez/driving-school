# AI Driving School

Keep the student experience simple: three Canvas tracks (round, rounded rectangle, irregular), manual
practice/recording, CSV download, JSON model load, and AI playback. No dashboard,
frontend build system, Python server, Pygame, or remote desktop.

JavaScript owns all physics, normalized sensors, ordered checkpoints, recording
and inference. Python is used only to train sklearn's decision tree and export
its nodes as JSON. Students edit train.py. Keep training.py supplied scaffolding.
Use Live Server on private forwarded port 5500. No network requests during driving.

Observe and label before moving. Pause on focus loss and long frames. Use fixed
simulation steps and smooth rendering, bounded memory, independent tab state,
strict CSV and JSON validation, and five features only. Test Python/JS prediction
parity and simulation behavior. Do not claim a hosted Codespaces check unless run.

Preserve existing runtime files. Instructor materials stay in ignored instructor/;
never force-add or push them. Do not recreate obsolete archived implementations.
Do not publish or push without explicit user authorization for that action.

Track geometry changes need new IDs to avoid silently mixing incompatible recordings.
Keep the registry and Python training allowlist in sync; test complete ordered laps
on every layout from multiple starts, and check boundaries for self-intersections.

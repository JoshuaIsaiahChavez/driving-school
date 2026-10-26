# AI Driving School — simple browser edition

The user's latest design uses plain HTML/CSS/JavaScript Canvas and a small Python
server, not Pygame or a remote desktop. Keep the page to one track, five buttons
(Start, Drive, Pause, Reset, AI Drive) and a short status line. No dashboard, model
selection UI or frontend build system. Students run driving_school.py to serve the
page and train.py separately to fit their decision tree. Port 8000 stays private
in Codespaces. Live Server alone cannot run the Python API.

Physics, sensors and ordered waypoints remain authoritative in simulator/core.py.
JavaScript renders snapshots and sends controls only. Use fixed 0.1-second steps,
independent browser sessions, an input watchdog, and bounded queues. Focus loss
pauses and clears steering. Log sensors/actions/metadata before moving. Never
record AI actions or paused frames. Only five sensor features enter the model.

Keep the single circular track inline in core.py. Preserve runtime/ recordings and
models, including the legacy pygame-1 schema label; no automatic data migration or
retraining. Instructor materials stay local in ignored instructor/. Never force-add
or push them. Obsolete versions were deleted; do not recreate archival copies.

Keep the file tree small: two entry scripts, web/, simulator/, tests/, README and
WORKSHEET plus minimal hidden Codespaces/CI settings. Test the actual API and shared
simulation. Report local browser evidence separately from hosted Codespaces checks.
Never publish or push without explicit user authorization.

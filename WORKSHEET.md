# Teach a car from examples

**Question:** Can a decision tree imitate your driving?

1. Open `web/index.html` with Live Server. Open forwarded port 5500. Click Start
   choose Round, and practice with left/right arrows. Click the track if it loses keyboard focus.
2. Open “What the car sees.” Explain one of the five sensor values in your own words.
   These numbers are **features**. The steering action is the **label**.
3. Click Drive and record a controlled demonstration. Pause, download CSV, and
   upload it into `runtime/recordings/` in VS Code. Open the CSV. Find a row's five
   features, its label, and its waypoint metadata. Why exclude position from X?
4. Read `train.py` with your instructor. An `import` brings in existing code.
   A variable names a value; a list holds several values. Indented lines belong
   together in a function. Parentheses call a function. `X` contains sensor rows;
   `y` contains the matching labels. Locate `DecisionTreeClassifier` and `fit`.
5. Run `.venv/bin/python train.py` in the repository-root terminal. Inspect label
   counts. Download `runtime/model.json` from VS Code, load it in the browser,
   and click AI Drive. Record progress and how the car failed or completed a lap.
6. Collect different examples on Rounded rectangle and Irregular. Switching tracks
   pauses and resets the car but keeps your existing examples. Download, then Clear examples before another
   recording so repeated exports do not duplicate old rows. Retrain and reload.
7. Compare a shallower and deeper tree by changing `MAX_DEPTH`. Keep the same data
   while comparing settings. An optional extension is `MIN_SAMPLES_LEAF`.

| Run | CSV files / sample count | Depth | Leaf minimum | Lap progress | Collision? | Observation |
| --- | --- | --- | --- | --- | --- | --- |
| First drive | | 6 | 3 | | | |
| More varied data | | 6 | 3 | | | |
| Shallower tree | | | 3 | | | |
| Deeper tree | | | 3 | | | |

Explain what actually happened; deeper trees and more examples are not guaranteed
to help. Prediction means following the learned tree to choose a steering label.
Overfitting means learning details of the examples that do not transfer well.
Generalization means doing well on new situations. All three tracks accept demonstrations. A track used for training is not an
unseen test track. For an extension, reserve one track, collect no examples on it,
and test it only after choosing your settings. Multiple tracks do not guarantee
that overfitting disappears.

**Exit ticket:** Name the features and label. Describe a failure and a possible
data-related explanation. Why is matching steering labels different from driving
a whole lap? What additional track would you use to test generalization?

Submit `train.py`, the requested CSV, your experiment table and reflection.
Download your work before deleting a Codespace; stop the Codespace after class.

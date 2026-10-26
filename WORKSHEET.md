# Student activity: teach the car

**Question:** Can a decision tree copy our steering from examples?

1. Run `python driving_school.py`, open port 8000 in the browser, and click Start. What happens when you
   hold the right arrow? What happens when you release it?
2. Look at the five rays. They measure the distance to the walls. These are the
   **features**. The action you choose is the **label**.
3. Reset, then click Drive. Record a short, careful drive. Click Pause.
4. Open one CSV in `runtime/recordings/`. Identify the five features, the label,
   and the next waypoint. Explain why the waypoint is not a model feature.
5. Open `train.py`. Follow the code with your instructor. `X` is a list of rows of
   distances; `y` is a list of answers. `fit(X, y)` learns from those paired lists.
   Imports bring in tools; brackets make a list; indentation groups function code.
6. Run `python train.py` in a second terminal while the server stays running. Note how many left, straight and right examples you saved.
7. Return to the page and click AI Drive. `predict` chooses a new action
   from the current sensors at each step. Observe a complete lap or a collision.
8. Collect another drive and retrain, or change `MAX_DEPTH` in `train.py` while
   keeping the data fixed. Does the behavior change? Explain what you actually saw.

| Attempt | Data / number of rows | Max depth | Completed lap? | Observation |
|---|---|---|---|---|
| 1 | | 6 | | |
| 2 | | | | |
| 3 | | | | |

A deeper tree can ask more questions before giving an answer. It is not guaranteed
to be better. More examples do not always help if they demonstrate poor steering.
A small mistake can move the car into sensor situations missing from your examples.

**Reflection:** What are the features and label? How does fitting differ from
prediction? Describe one failure. Why would success on the same circular track
not prove that the car can drive on an unfamiliar track?

Submit `train.py`, your observations, and the CSV requested by your instructor.
If the page cannot connect, open the Python server’s forwarded port 8000. Live Server alone cannot run its Python API.

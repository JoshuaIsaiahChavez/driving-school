"""Pause recording, then run: python train.py. These are the ML steps to study."""
from sklearn.tree import DecisionTreeClassifier
from simulator.recordings import load_examples, save_model

# Try changing these two settings after your first experiment.
MAX_DEPTH = 6
MIN_SAMPLES_LEAF = 3


def train():
    rows = load_examples()
    # Features: only the five distances, in the same left-to-right order.
    feature_columns = ['left', 'front_left', 'front', 'front_right', 'right']
    X = [[row[column] for column in feature_columns] for row in rows]
    # Label: what the human did at that moment.
    y = [row['steering'] for row in rows]
    model = DecisionTreeClassifier(
        max_depth=MAX_DEPTH,
        min_samples_leaf=MIN_SAMPLES_LEAF,
        random_state=1101,
    )
    model.fit(X, y)
    save_model(model, rows)
    print(f'Trained on {len(rows)} examples. Now click AI Drive in the browser.')
    return model


if __name__ == '__main__':
    try:
        train()
    except (ValueError, OSError) as error:
        raise SystemExit(str(error)) from None

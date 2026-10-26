"""Download your CSV into runtime/recordings/, then run: python train.py. These are the ML steps to study."""
from sklearn.tree import DecisionTreeClassifier
from training import load_examples, save_model

# Try changing these two settings after your first experiment.
MAX_DEPTH = 6
MIN_SAMPLES_LEAF = 3


def train():
    # NEEDS DEFINITION


if __name__ == '__main__':
    try:
        train()
    except (ValueError, OSError) as error:
        raise SystemExit(str(error)) from None

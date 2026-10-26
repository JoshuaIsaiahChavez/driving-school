import pytest
from simulator import recordings


@pytest.fixture(autouse=True)
def isolated_data(tmp_path, monkeypatch):
    monkeypatch.setattr(recordings, 'DATA_DIR', tmp_path/'runtime')

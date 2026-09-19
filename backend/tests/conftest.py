import pytest
from fastapi.testclient import TestClient

from app import main


@pytest.fixture(scope="session")
def client():
    # Startup loads the ML models and the (cached) content catalog once.
    with TestClient(main.app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def known_user():
    return "user_1_cinephile"

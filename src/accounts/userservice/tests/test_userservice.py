import unittest
from unittest.mock import patch, mock_open, MagicMock

from userservice.userservice import create_app
from tests.constants import EXAMPLE_PUBLIC_KEY, PRIVATE_KEY_PEM


class TestUserservice(unittest.TestCase):
    def setUp(self):
        """Set up test client with mocked dependencies."""
        with patch("userservice.userservice.open", mock_open(read_data=PRIVATE_KEY_PEM)):
            with patch("os.environ", {
                "VERSION": "v0.0.0-test",
                "TOKEN_EXPIRY_SECONDS": "3600",
                "PRIV_KEY_PATH": "/tmp/fake-priv-key",
                "PUB_KEY_PATH": "/tmp/fake-pub-key",
                "ACCOUNTS_DB_URI": "sqlite:///",
                "ENABLE_TRACING": "false",
            }):
                with patch("userservice.userservice.UserDb") as mock_db:
                    self.mocked_db = mock_db
                    self.flask_app = create_app()
                    self.flask_app.config["TESTING"] = True
                    self.test_app = self.flask_app.test_client()
                    self.flask_app.config["PUBLIC_KEY"] = EXAMPLE_PUBLIC_KEY

    def test_version_endpoint_returns_200(self):
        """Verify test infrastructure works: version endpoint returns 200."""
        response = self.test_app.get("/version")
        self.assertEqual(response.status_code, 200)

    def test_ready_endpoint_returns_200(self):
        """Verify readiness endpoint returns 200."""
        response = self.test_app.get("/ready")
        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()

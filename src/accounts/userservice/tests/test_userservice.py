import json
import unittest
from unittest.mock import patch, mock_open, MagicMock

import bcrypt
import jwt

from userservice.userservice import create_app
from tests.constants import (
    EXAMPLE_PUBLIC_KEY,
    EXAMPLE_USER,
    EXAMPLE_USER_REQUEST,
    INVALID_USERNAMES,
    PRIVATE_KEY_PEM,
)


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

    def test_login_200_valid_credentials(self):
        """Successful login returns 200 with valid JWT containing expected claims."""
        # mock get_user to return a valid user record
        password = "correct"
        passhash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        self.mocked_db.return_value.get_user.return_value = {
            "accountid": "1234567890",
            "username": EXAMPLE_USER,
            "passhash": passhash,
            "firstname": "Test",
            "lastname": "User",
        }
        # send login request
        response = self.test_app.get(
            "/login",
            query_string={"username": EXAMPLE_USER, "password": password},
        )
        # assert 200 response
        self.assertEqual(response.status_code, 200)
        # assert response body contains a token field
        data = json.loads(response.data)
        self.assertIn("token", data)
        # decode the JWT and verify claims
        decoded = jwt.decode(
            data["token"], EXAMPLE_PUBLIC_KEY, algorithms=["RS256"]
        )
        self.assertEqual(decoded["user"], EXAMPLE_USER)
        self.assertEqual(decoded["acct"], "1234567890")
        self.assertEqual(decoded["name"], "Test User")
        self.assertIn("iat", decoded)
        self.assertIn("exp", decoded)


    def test_create_user_400_validation_rejects_invalid_input(self):
        """POST /users returns 400 for missing fields, empty fields, invalid username, and password mismatch."""
        # missing required field
        incomplete = {k: v for k, v in EXAMPLE_USER_REQUEST.items() if k != "username"}
        response = self.test_app.post("/users", data=incomplete)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data, b"missing required field(s)")

        # empty field value
        empty_field = EXAMPLE_USER_REQUEST.copy()
        empty_field["username"] = ""
        response = self.test_app.post("/users", data=empty_field)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data, b"missing value for input field(s)")

        # invalid usernames (special chars, too short, too long)
        for invalid_username in INVALID_USERNAMES:
            invalid = EXAMPLE_USER_REQUEST.copy()
            invalid["username"] = invalid_username
            response = self.test_app.post("/users", data=invalid)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(
                response.data,
                b"username must contain 2-15 alphanumeric characters or underscores",
            )

        # password mismatch
        mismatch = EXAMPLE_USER_REQUEST.copy()
        mismatch["password-repeat"] = "wrong_password"
        response = self.test_app.post("/users", data=mismatch)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data, b"passwords do not match")


if __name__ == "__main__":
    unittest.main()

"""Unit tests for the userservice authentication and account endpoints."""

import unittest
from unittest.mock import patch, mock_open

import bcrypt
import jwt
from sqlalchemy.exc import SQLAlchemyError

from userservice.userservice import create_app
from tests.constants import (
    EXAMPLE_PUBLIC_KEY,
    EXAMPLE_USER_REQUEST,
    PRIVATE_KEY_PEM,
)


class TestUserservice(unittest.TestCase):
    """Exercises /login auth checks and /users validation/conflict handling."""

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

    @property
    def db(self):
        """The mocked UserDb instance used by the app."""
        return self.mocked_db.return_value

    def test_version_endpoint_returns_200(self):
        """Verify test infrastructure works: version endpoint returns 200."""
        response = self.test_app.get("/version")
        self.assertEqual(response.status_code, 200)

    def test_ready_endpoint_returns_200(self):
        """Verify readiness endpoint returns 200."""
        response = self.test_app.get("/ready")
        self.assertEqual(response.status_code, 200)

    def test_login_returns_401_for_wrong_password(self):
        """Auth check: a valid user with an incorrect password is rejected with 401."""
        passhash = bcrypt.hashpw(b"correct-password", bcrypt.gensalt())
        self.db.get_user.return_value = {
            "accountid": "1234567890",
            "username": "testuser",
            "passhash": passhash,
            "firstname": "Test",
            "lastname": "User",
        }

        response = self.test_app.get(
            "/login",
            query_string={"username": "testuser", "password": "wrong-password"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertIn("invalid login", response.get_data(as_text=True))

    def test_login_returns_404_for_nonexistent_user(self):
        """Auth check: logging in as a user that does not exist returns 404."""
        self.db.get_user.return_value = None

        response = self.test_app.get(
            "/login",
            query_string={"username": "ghost", "password": "irrelevant"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertIn("does not exist", response.get_data(as_text=True))

    def test_login_returns_200_with_valid_jwt(self):
        """Happy path / return-value correctness: valid credentials yield a 200 and a
        signed JWT whose claims match the authenticated user."""
        password = "correct-password"
        passhash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        self.db.get_user.return_value = {
            "accountid": "1234567890",
            "username": "testuser",
            "passhash": passhash,
            "firstname": "Test",
            "lastname": "User",
        }

        response = self.test_app.get(
            "/login",
            query_string={"username": "testuser", "password": password},
        )

        self.assertEqual(response.status_code, 200)
        token = response.get_json()["token"]
        decoded = jwt.decode(token, EXAMPLE_PUBLIC_KEY, algorithms=["RS256"])
        self.assertEqual(decoded["user"], "testuser")
        self.assertEqual(decoded["acct"], "1234567890")
        self.assertEqual(decoded["name"], "Test User")

    def test_create_user_returns_400_for_password_mismatch(self):
        """Validation logic: a create-user request whose password and password-repeat
        differ is rejected with 400 before any database write occurs."""
        req = dict(EXAMPLE_USER_REQUEST)
        req["password-repeat"] = "does-not-match"

        response = self.test_app.post("/users", data=req)

        self.assertEqual(response.status_code, 400)
        self.assertIn("passwords do not match", response.get_data(as_text=True))
        self.db.add_user.assert_not_called()

    def test_create_user_returns_409_for_duplicate_username(self):
        """Conflict state: creating a user whose username already exists returns 409
        and does not write a new record."""
        self.db.get_user.return_value = {
            "accountid": "1234567890",
            "username": "testuser",
        }

        response = self.test_app.post("/users", data=dict(EXAMPLE_USER_REQUEST))

        self.assertEqual(response.status_code, 409)
        self.assertIn("already exists", response.get_data(as_text=True))
        self.db.add_user.assert_not_called()


    def test_create_user_returns_400_for_missing_fields(self):
        """Validation logic: a request missing required fields is rejected with 400."""
        incomplete_req = {
            "username": "newuser",
            "password": "pass123",
        }

        response = self.test_app.post("/users", data=incomplete_req)

        self.assertEqual(response.status_code, 400)
        self.assertIn("missing required field", response.get_data(as_text=True))
        self.db.add_user.assert_not_called()

    def test_create_user_returns_400_for_invalid_username(self):
        """Validation logic: a username with invalid characters is rejected with 400."""
        req = dict(EXAMPLE_USER_REQUEST)
        req["username"] = "ab!@#bad"

        response = self.test_app.post("/users", data=req)

        self.assertEqual(response.status_code, 400)
        self.assertIn("alphanumeric", response.get_data(as_text=True))
        self.db.add_user.assert_not_called()

    def test_create_user_returns_201_on_success(self):
        """Happy path: valid new-user request creates account and returns 201."""
        self.db.get_user.return_value = None
        self.db.generate_accountid.return_value = "9999999999"

        response = self.test_app.post("/users", data=dict(EXAMPLE_USER_REQUEST))

        self.assertEqual(response.status_code, 201)
        self.db.add_user.assert_called_once()
        saved = self.db.add_user.call_args[0][0]
        self.assertEqual(saved["accountid"], "9999999999")
        self.assertEqual(saved["username"], "testuser")
        self.assertTrue(bcrypt.checkpw(b"password123", saved["passhash"]))

    def test_login_returns_500_on_db_error(self):
        """Downstream failure: a database error during login returns 500."""
        self.db.get_user.side_effect = SQLAlchemyError("connection lost")

        response = self.test_app.get(
            "/login",
            query_string={"username": "testuser", "password": "any"},
        )

        self.assertEqual(response.status_code, 500)
        self.assertIn("failed to retrieve user information", response.get_data(as_text=True))

    def test_create_user_returns_500_on_db_error(self):
        """Downstream failure: a database error during user creation returns 500."""
        self.db.get_user.return_value = None
        self.db.generate_accountid.return_value = "9999999999"
        self.db.add_user.side_effect = SQLAlchemyError("insert failed")

        response = self.test_app.post("/users", data=dict(EXAMPLE_USER_REQUEST))

        self.assertEqual(response.status_code, 500)
        self.assertIn("failed to create user", response.get_data(as_text=True))


if __name__ == "__main__":
    unittest.main()

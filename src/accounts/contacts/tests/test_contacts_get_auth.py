"""Unit tests for authentication on the contacts GET endpoint."""

import unittest
from unittest.mock import patch, mock_open

from contacts.contacts import create_app
from tests.constants import EXAMPLE_PUBLIC_KEY, EXAMPLE_HEADERS, EXAMPLE_USER


class TestContactsGetAuth(unittest.TestCase):
    """Exercises auth handling on GET /contacts/<username>."""

    def setUp(self):
        """Set up test client with mocked dependencies."""
        with patch("contacts.contacts.open", mock_open(read_data="foo")):
            with patch("os.environ", {
                "VERSION": "v0.0.0-test",
                "LOCAL_ROUTING_NUM": "123456789",
                "PUB_KEY_PATH": "/tmp/fake-pub-key",
                "ACCOUNTS_DB_URI": "sqlite:///",
                "ENABLE_TRACING": "false",
            }):
                with patch("contacts.contacts.ContactsDb") as mock_db:
                    self.mocked_db = mock_db
                    self.flask_app = create_app()
                    self.flask_app.config["TESTING"] = True
                    self.test_app = self.flask_app.test_client()
                    self.flask_app.config["PUBLIC_KEY"] = EXAMPLE_PUBLIC_KEY

    def test_get_contacts_401_jwt_user_mismatches_path_username(self):
        """test getting contacts with a valid JWT whose user claim does not match the URL username"""
        # send request for a different username than the one the JWT is signed for
        self.assertNotEqual(EXAMPLE_USER, "someoneelse")
        response = self.test_app.get(
            "/contacts/someoneelse",
            headers=EXAMPLE_HEADERS,
        )
        # assert 401 response code
        self.assertEqual(response.status_code, 401)
        # assert we get correct error message
        self.assertEqual(response.data, b"authentication denied")
        # assert no contacts were fetched from the db
        self.mocked_db.return_value.get_contacts.assert_not_called()


if __name__ == "__main__":
    unittest.main()

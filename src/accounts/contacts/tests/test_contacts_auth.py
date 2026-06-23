"""Auth-failure unit tests for the contacts service get_contacts endpoint."""

import unittest
from unittest.mock import patch, mock_open

from contacts.contacts import create_app
from tests.constants import EXAMPLE_PUBLIC_KEY, EXAMPLE_USER


class TestContactsAuth(unittest.TestCase):
    """Exercises the auth/PII-handling branch of GET /contacts/<username>."""

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
                    self.mocked_db.return_value.get_contacts.return_value = []

    def test_get_contacts_401_missing_auth_header(self):
        """test retrieving contacts with no Authorization header is rejected"""
        # send request without an Authorization header (invalid auth)
        response = self.test_app.get("/contacts/{}".format(EXAMPLE_USER))
        # assert 401 response code
        self.assertEqual(response.status_code, 401)
        # assert we get the correct error message
        self.assertEqual(response.data, b"authentication denied")
        # assert no contacts data was retrieved/returned to the caller
        self.mocked_db.return_value.get_contacts.assert_not_called()


if __name__ == "__main__":
    unittest.main()

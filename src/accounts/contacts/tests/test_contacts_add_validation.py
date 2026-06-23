"""Unit tests for add_contact input validation in the contacts service."""

import json
import unittest
from unittest.mock import patch, mock_open

from contacts.contacts import create_app
from tests.constants import (
    EXAMPLE_PUBLIC_KEY,
    EXAMPLE_HEADERS,
    EXAMPLE_USER,
    EXAMPLE_CONTACT,
)


class TestContactsAddValidation(unittest.TestCase):
    """Exercises add_contact validation with mocked dependencies."""

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

    def test_add_contact_400_invalid_account_number(self):
        """test adding a contact whose account_num is not exactly 10 digits"""
        # build request with an invalid (too short) account number
        invalid_contact = dict(EXAMPLE_CONTACT)
        invalid_contact["account_num"] = "123"
        # send request to test client
        response = self.test_app.post(
            "/contacts/{}".format(EXAMPLE_USER),
            headers=EXAMPLE_HEADERS,
            data=json.dumps(invalid_contact),
            content_type="application/json",
        )
        # assert 400 response code with the expected error message
        self.assertEqual(response.status_code, 400)
        self.assertIn(b"invalid account number", response.data)
        # assert the DB write was never attempted
        self.mocked_db.return_value.add_contact.assert_not_called()


if __name__ == "__main__":
    unittest.main()

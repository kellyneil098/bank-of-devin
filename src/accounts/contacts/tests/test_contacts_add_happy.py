"""Happy-path unit test for the contacts service add_contact endpoint."""

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


class TestContactsAddHappy(unittest.TestCase):
    """Exercises the add_contact happy path with mocked dependencies."""

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
                    # No existing contacts so the duplicate check passes
                    self.mocked_db.return_value.get_contacts.return_value = []

    def test_add_contact_201_valid_new_contact(self):
        """test adding a valid new internal contact returns 201 and persists once"""
        # send request to test client (When)
        response = self.test_app.post(
            "/contacts/{}".format(EXAMPLE_USER),
            headers=EXAMPLE_HEADERS,
            data=json.dumps(EXAMPLE_CONTACT),
            content_type="application/json",
        )
        # assert 201 response code (Then)
        self.assertEqual(response.status_code, 201)
        # assert add_contact was called exactly once
        self.mocked_db.return_value.add_contact.assert_called_once()
        # assert the contact data passed through carries the expected fields
        contact_data = self.mocked_db.return_value.add_contact.call_args[0][0]
        self.assertEqual(contact_data["username"], EXAMPLE_USER)
        self.assertEqual(contact_data["account_num"], EXAMPLE_CONTACT["account_num"])


if __name__ == "__main__":
    unittest.main()

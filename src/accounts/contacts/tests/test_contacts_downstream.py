"""Unit tests for downstream (database) failures in the contacts service."""

import unittest
from unittest.mock import patch, mock_open

from sqlalchemy.exc import SQLAlchemyError

from contacts.contacts import create_app
from tests.constants import (
    EXAMPLE_PUBLIC_KEY,
    EXAMPLE_HEADERS,
    EXAMPLE_USER,
    example_contact_json,
)


class TestContactsDownstream(unittest.TestCase):
    """Exercises the contacts service when the database layer fails."""

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

    def test_create_contact_500_add_contact_failure(self):
        """test adding a valid contact but the database raises a SQL error"""
        # mock add_contact to raise a downstream database error
        self.mocked_db.return_value.add_contact.side_effect = SQLAlchemyError()
        # send a valid add-contact request with a valid JWT
        response = self.test_app.post(
            "/contacts/{}".format(EXAMPLE_USER),
            headers=EXAMPLE_HEADERS,
            data=example_contact_json(),
            content_type="application/json",
        )
        # assert 500 response code
        self.assertEqual(response.status_code, 500)
        # assert we get the correct error message
        self.assertEqual(response.data, b"failed to add contact")


if __name__ == "__main__":
    unittest.main()

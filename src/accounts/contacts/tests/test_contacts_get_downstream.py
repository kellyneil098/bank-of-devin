"""Unit tests for the contacts service GET endpoint downstream failures."""

import unittest
from unittest.mock import patch, mock_open

from sqlalchemy.exc import SQLAlchemyError

from contacts.contacts import create_app
from tests.constants import EXAMPLE_PUBLIC_KEY, EXAMPLE_HEADERS, EXAMPLE_USER


class TestContactsGetDownstream(unittest.TestCase):
    """Exercises GET /contacts/<username> when the DB layer fails."""

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

    def test_get_contacts_500_db_read_failure(self):
        """test getting contacts but the DB raises a SQL error on read"""
        # mock get_contacts to raise a downstream DB error
        self.mocked_db.return_value.get_contacts.side_effect = SQLAlchemyError(
            "db down"
        )
        # send request to test client as the authenticated, authorized user
        response = self.test_app.get(
            "/contacts/{}".format(EXAMPLE_USER),
            headers=EXAMPLE_HEADERS,
        )
        # assert 500 response code
        self.assertEqual(response.status_code, 500)
        # assert we get correct error message
        self.assertIn(b"failed to retrieve contacts list", response.data)


if __name__ == "__main__":
    unittest.main()

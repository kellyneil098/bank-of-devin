"""Unit tests for the contacts service Flask endpoints."""

import json
import unittest
from unittest.mock import patch, mock_open

from contacts.contacts import create_app
from tests.constants import (
    EXAMPLE_PUBLIC_KEY,
    EXAMPLE_HEADERS,
    EXAMPLE_USER,
    EXAMPLE_CONTACT,
    LOCAL_ROUTING,
)


class TestContacts(unittest.TestCase):
    """Exercises contacts service endpoints with mocked database."""

    def setUp(self):
        """Set up test client with mocked dependencies."""
        with patch("contacts.contacts.open", mock_open(read_data=EXAMPLE_PUBLIC_KEY)):
            with patch("os.environ", {
                "VERSION": "v0.0.0-test",
                "LOCAL_ROUTING_NUM": LOCAL_ROUTING,
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

    @property
    def db(self):
        """The mocked ContactsDb instance used by the app."""
        return self.mocked_db.return_value

    def test_version_endpoint_returns_200(self):
        """Verify test infrastructure works: version endpoint returns 200."""
        response = self.test_app.get("/version")
        self.assertEqual(response.status_code, 200)

    def test_ready_endpoint_returns_200(self):
        """Verify readiness endpoint returns 200."""
        response = self.test_app.get("/ready")
        self.assertEqual(response.status_code, 200)


    def test_create_contact_400_missing_required_fields(self):
        """POST with each required field removed returns 400."""
        required_fields = ("label", "account_num", "routing_num", "is_external")
        for field in required_fields:
            # build a contact payload missing one required field
            incomplete_contact = {k: v for k, v in EXAMPLE_CONTACT.items() if k != field}
            # send request
            response = self.test_app.post(
                "/contacts/{}".format(EXAMPLE_USER),
                headers=EXAMPLE_HEADERS,
                data=json.dumps(incomplete_contact),
                content_type="application/json",
            )
            # assert 400 with correct error message
            self.assertEqual(response.status_code, 400,
                             "Expected 400 when '{}' is missing".format(field))
            self.assertEqual(response.data, b"missing required field(s)")


if __name__ == "__main__":
    unittest.main()

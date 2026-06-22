"""Unit tests for the UserDb data-access layer used by the auth service."""

import unittest
from unittest.mock import patch, MagicMock

from sqlalchemy.dialects import sqlite

from db import UserDb


class TestUserDb(unittest.TestCase):
    """Exercises UserDb add/lookup/account-id generation against a mocked engine."""

    def setUp(self):
        """Build a UserDb backed by a mocked SQLAlchemy engine."""
        engine_patcher = patch("db.create_engine")
        instrument_patcher = patch("db.SQLAlchemyInstrumentor")
        self.mock_create_engine = engine_patcher.start()
        instrument_patcher.start()
        self.addCleanup(engine_patcher.stop)
        self.addCleanup(instrument_patcher.stop)

        self.mock_engine = self.mock_create_engine.return_value
        self.user_db = UserDb("sqlite:///", logger=MagicMock())

    @property
    def conn(self):
        """The connection yielded by `with engine.connect() as conn`."""
        return self.mock_engine.connect.return_value.__enter__.return_value

    def test_add_user_executes_insert_with_user_values(self):
        """Happy path / side effects: add_user issues a single INSERT on the users
        table carrying the supplied account fields."""
        user = {
            "accountid": "1234567890",
            "username": "alice",
            "passhash": b"hash",
            "firstname": "Alice",
            "lastname": "Smith",
            "birthday": "1990-01-01",
            "timezone": "UTC",
            "address": "123 Test St",
            "state": "CA",
            "zip": "90210",
            "ssn": "123-45-6789",
        }

        self.user_db.add_user(user)

        self.conn.execute.assert_called_once()
        statement = self.conn.execute.call_args[0][0]
        compiled = statement.compile(dialect=sqlite.dialect())
        self.assertIn("INSERT INTO users", str(compiled))
        self.assertEqual(compiled.params["accountid"], "1234567890")
        self.assertEqual(compiled.params["username"], "alice")

    def test_get_user_returns_dict_when_row_found(self):
        """Return-value correctness: get_user returns the matched row as a dict and
        filters by the requested username."""
        row = {"accountid": "1234567890", "username": "alice"}
        self.conn.execute.return_value.first.return_value = row

        result = self.user_db.get_user("alice")

        self.assertEqual(result, row)
        statement = self.conn.execute.call_args[0][0]
        compiled = statement.compile(dialect=sqlite.dialect())
        self.assertEqual(compiled.params["username_1"], "alice")

    def test_get_user_returns_none_when_row_missing(self):
        """Boundary condition: get_user returns None when no matching row exists."""
        self.conn.execute.return_value.first.return_value = None

        result = self.user_db.get_user("ghost")

        self.assertIsNone(result)

    def test_generate_accountid_returns_unique_id(self):
        """Happy path: generate_accountid returns a 10-digit id when the first
        candidate is not already present in the table."""
        self.conn.execute.return_value.first.return_value = None

        with patch("db.random.randint", return_value=1234567890) as mock_randint:
            accountid = self.user_db.generate_accountid()

        self.assertEqual(accountid, "1234567890")
        self.assertEqual(len(accountid), 10)
        mock_randint.assert_called_once_with(1_000_000_000, 9_999_999_999)
        self.conn.execute.assert_called_once()

    def test_generate_accountid_retries_on_collision(self):
        """Conflict state: generate_accountid retries when a candidate id already
        exists and returns the next non-colliding id."""
        self.conn.execute.return_value.first.side_effect = [object(), None]

        with patch(
            "db.random.randint", side_effect=[1111111111, 2222222222]
        ) as mock_randint:
            accountid = self.user_db.generate_accountid()

        self.assertEqual(accountid, "2222222222")
        self.assertEqual(mock_randint.call_count, 2)
        self.assertEqual(self.conn.execute.call_count, 2)


if __name__ == "__main__":
    unittest.main()

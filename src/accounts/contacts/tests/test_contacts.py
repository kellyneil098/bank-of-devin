# Copyright 2021 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


"""
Tests for contacts
"""

import random
import unittest
import json
from unittest.mock import patch, mock_open

from contacts.contacts import create_app
from contacts.tests.constants import (
    EXAMPLE_CONTACT,
    EXAMPLE_USER,
    EXAMPLE_PUBLIC_KEY,
    EXAMPLE_HEADERS,
)

def create_new_contact(**kwargs):
    """Helper method for creating new contacts from template"""
    example_contact = EXAMPLE_CONTACT.copy()
    example_contact.update(kwargs)
    return example_contact


class TestContacts(unittest.TestCase):
    """
    Tests cases for contacts
    """

    def setUp(self):
        """Setup Flask TestClient and mock contacts_db"""
        # mock opening files
        with patch("contacts.contacts.open", mock_open(read_data="foo")):
            # mock env vars
            with patch(
                "os.environ",
                {
                    "VERSION": "1",
                    "LOCAL_ROUTING": "123456789",
                    "PUBLIC_KEY": "1",
                    "ENABLE_TRACING": "false",
                },
            ):
                # mock db module as MagicMock, context manager handles cleanup
                with patch("contacts.contacts.ContactsDb") as mock_db:
                    self.mocked_db = mock_db
                    # get create flask app
                    self.flask_app = create_app()
                    # set testing config
                    self.flask_app.config["TESTING"] = True
                    # create test client
                    self.test_app = self.flask_app.test_client()
                    # set public key
                    self.flask_app.config["PUBLIC_KEY"] = EXAMPLE_PUBLIC_KEY
                    # mock return value of get_contacts to return empty
                    self.mocked_db.return_value.get_contacts.return_value = []

    def test_version_endpoint_returns_200_status_code_correct_version(self):
        """test if correct version is returned"""
        # generate a version
        version = str(random.randint(1, 9))
        # set version in Flask config
        self.flask_app.config["VERSION"] = version
        # send get request to test client
        response = self.test_app.get("/version")
        # assert 200 response code
        self.assertEqual(response.status_code, 200)
        # assert both versions are equal
        self.assertEqual(response.data, version.encode())

    def test_ready_endpoint_200_status_code_ok_string(self):
        """test if correct response is returned from readiness probe"""
        response = self.test_app.get("/ready")
        # assert 200 response code
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, b"ok")

    def test_create_contact_201_status_code_correct_db_contact_object(self):
        """test adding a new contact to a users contact list"""
        # create example contact request
        example_contact = create_new_contact()
        # send request to test client
        response = self.test_app.post(
            "/contacts/{}".format(EXAMPLE_USER),
            headers=EXAMPLE_HEADERS,
            data=json.dumps(example_contact),
        )
        # assert 201 response code
        self.assertEqual(response.status_code, 201)
        # assert contact object added to database had the required fields
        # get the arg that contact_db.add_contact was called with
        contact_object = self.mocked_db.return_value.add_contact.call_args[0][0]
        # add username to example contact object
        example_contact["username"] = EXAMPLE_USER
        # assert all keys are equal
        self.assertEqual(contact_object, example_contact)

    def test_get_contacts_200_list_of_contacts(self):
        """test getting a list of contacts for a user"""
        # mock return value of get_contacts to return two values
        self.mocked_db.return_value.get_contacts.return_value = ["foo", "bar"]
        # send request to test client
        response = self.test_app.get(
            "/contacts/{}".format(EXAMPLE_USER), headers=EXAMPLE_HEADERS
        )
        # assert 200 response code
        self.assertEqual(response.status_code, 200)
        # assert get_contacts was called with the right args
        self.assertEqual(
            self.mocked_db.return_value.get_contacts.call_args[0][0],
            EXAMPLE_USER,
        )
        # assert we get right number of contacts
        self.assertEqual(len(response.json), 2)
        # assert we get right contacts
        self.assertEqual(response.json, ["foo", "bar"])



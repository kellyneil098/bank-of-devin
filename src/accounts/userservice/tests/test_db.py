# Copyright 2019 Google LLC
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
Tests for db module
"""

import unittest

from userservice.db import UserDb
from userservice.tests.constants import EXAMPLE_USER


class TestDb(unittest.TestCase):
    """
    Test cases for db module
    """

    def setUp(self):
        """Init db and create table before each test"""
        # init SQLAlchemy with sqllite in mem
        self.db = UserDb('sqlite:///:memory:')
        # create users table in mem
        self.db.users_table.create(self.db.engine)

    def test_add_user_returns_none_no_exception(self):
        """test if a user can be added"""
        user = EXAMPLE_USER.copy()
        # create a user with username foo
        user['username'] = 'foo'
        user['accountid'] = '1'
        # add user to db
        self.db.add_user(user)

    def test_get_user_returns_existing_user(self):
        """test getting a user"""
        user = EXAMPLE_USER.copy()
        # create a user with username baz
        user['username'] = 'baz'
        user['accountid'] = '3'
        # add baz_user to db
        self.db.add_user(user)
        # get baz_user from db
        db_user = self.db.get_user(user['username'])
        # assert both user objects are equal
        self.assertEqual(user, db_user)



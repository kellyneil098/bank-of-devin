import json

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

# Generate a test RSA key pair for JWT auth
PRIVATE_KEY = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
)
PRIVATE_KEY_PEM = PRIVATE_KEY.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.TraditionalOpenSSL,
    encryption_algorithm=serialization.NoEncryption(),
).decode("utf-8")

PUBLIC_KEY = PRIVATE_KEY.public_key().public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo,
).decode("utf-8")

EXAMPLE_USER = "testuser"
EXAMPLE_ACCT = "1234567890"
EXAMPLE_PUBLIC_KEY = PUBLIC_KEY

# A valid token whose claims match EXAMPLE_USER / EXAMPLE_ACCT.
EXAMPLE_HEADERS = {"Authorization": "Bearer " + jwt.encode(
    {"user": EXAMPLE_USER, "acct": EXAMPLE_ACCT}, PRIVATE_KEY, algorithm="RS256"
)}

LOCAL_ROUTING = "123456789"

# A valid internal contact request body for POST /contacts/<username>.
EXAMPLE_CONTACT = {
    "label": "Friend",
    "account_num": "9876543210",
    "routing_num": "111111111",
    "is_external": False,
}


def example_contact(**overrides):
    """Return a copy of EXAMPLE_CONTACT with optional field overrides."""
    contact = dict(EXAMPLE_CONTACT)
    contact.update(overrides)
    return contact


def example_contact_json(**overrides):
    """Return a JSON-encoded contact request body."""
    return json.dumps(example_contact(**overrides))

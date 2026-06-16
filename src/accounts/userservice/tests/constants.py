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
EXAMPLE_HEADERS = {"Authorization": "Bearer " + jwt.encode(
    {"acct": EXAMPLE_USER}, PRIVATE_KEY, algorithm="RS256"
)}
EXAMPLE_PUBLIC_KEY = PUBLIC_KEY

EXAMPLE_USER_REQUEST = {
    "username": "testuser",
    "password": "password123",
    "password-repeat": "password123",
    "firstname": "Test",
    "lastname": "User",
    "birthday": "1990-01-01",
    "timezone": "UTC",
    "address": "123 Test St",
    "state": "CA",
    "zip": "90210",
    "ssn": "123-45-6789",
}

INVALID_USERNAMES = [
    "a",                  # too short (1 char)
    "a" * 16,             # too long (16 chars)
    "test@user",          # special character
    "test user",          # space
]

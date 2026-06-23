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
LOCAL_ROUTING = "123456789"

EXAMPLE_HEADERS = {"Authorization": "Bearer " + jwt.encode(
    {"user": EXAMPLE_USER, "acct": EXAMPLE_ACCT}, PRIVATE_KEY, algorithm="RS256"
)}
EXAMPLE_PUBLIC_KEY = PUBLIC_KEY

EXAMPLE_CONTACT = {
    "label": "Alice",
    "account_num": "9876543210",
    "routing_num": "987654321",
    "is_external": True,
}

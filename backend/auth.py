"""Who is the current user?

This is the single place the rest of the app asks "who is making this request?".
Every route depends on `get_current_user`, and it returns a stable identifier for the
caller. That identifier is what we stamp onto a Canvas as its owner and check against
when someone tries to read or change a Canvas.

Two modes, chosen by environment:

- **Production (Clerk configured):** if `CLERK_JWT_ISSUER` is set, every request must carry
  a valid Clerk session token (`Authorization: Bearer <token>`). We verify the token's
  signature against Clerk's public keys (JWKS) and return the Clerk user id (`sub`) as the
  owner. Invalid/missing token → 401.

- **Local dev (no Clerk):** if `CLERK_JWT_ISSUER` is unset, we use a *pretend* user
  (`X-Dev-User-Email` header or `DEV_USER_EMAIL`, default "you@georgian.io"), so the app
  can run and be tested without standing up real auth.
"""

import os

from dotenv import load_dotenv
from fastapi import Header, HTTPException

load_dotenv()  # load .env before reading config (auth is imported before interview)

DEV_USER_EMAIL = os.environ.get("DEV_USER_EMAIL", "you@georgian.io")
CLERK_JWT_ISSUER = os.environ.get("CLERK_JWT_ISSUER")  # e.g. https://<app>.clerk.accounts.dev

_jwks_client = None
if CLERK_JWT_ISSUER:
    import jwt
    from jwt import PyJWKClient

    _jwks_client = PyJWKClient(f"{CLERK_JWT_ISSUER.rstrip('/')}/.well-known/jwks.json")


def get_current_user(
    authorization: str | None = Header(default=None),
    x_dev_user_email: str | None = Header(default=None),
) -> str:
    if CLERK_JWT_ISSUER:
        # Production: require a valid Clerk session token.
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Not authenticated")
        token = authorization.split(" ", 1)[1]
        try:
            signing_key = _jwks_client.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                issuer=CLERK_JWT_ISSUER,
                options={"verify_aud": False},  # Clerk session tokens carry no audience
            )
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return claims["sub"]  # stable Clerk user id → the Canvas owner

    # Local dev: no Clerk configured — pretend user.
    return x_dev_user_email or DEV_USER_EMAIL

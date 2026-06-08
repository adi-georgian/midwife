"""Who is the current user?

This is the single place the rest of the app asks "who is making this request?".
Every route depends on `get_current_user`, and it returns the user's email. That
email is what we stamp onto a Canvas as its owner, and what we check against when
someone tries to read or change a Canvas.

RIGHT NOW (development): there is no real login yet. We use a *pretend* user so we
can build and test ownership locally. The pretend email is:
  - whatever the `X-Dev-User-Email` request header says (handy for testing as two
    different people), or
  - the `DEV_USER_EMAIL` environment variable, or
  - a default of "you@georgian.io".

LATER (production): this function is the ONLY thing that changes. It will instead
read the signed identity that the login layer (e.g. Google Cloud IAP, or Okta)
attaches to every request, verify it, and return that real email. No other code
needs to change. See docs/adr/0002-auth-via-iap-workspace.md.
"""

import os

from fastapi import Header

DEV_USER_EMAIL = os.environ.get("DEV_USER_EMAIL", "you@georgian.io")


def get_current_user(x_dev_user_email: str | None = Header(default=None)) -> str:
    # DEV ONLY — replace the body of this function with real identity verification
    # in production. The function signature / return type stays the same.
    return x_dev_user_email or DEV_USER_EMAIL

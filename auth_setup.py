# Run this once to authorize your Google account and get a refresh token.
#
# Setup:
#   1. Put this file in the same folder as your downloaded client_secret.json
#   2. pip install -r requirements.txt
#   3. python auth_setup.py
#
# It will print a URL. Open it, sign in with the Google account you added
# as a test user, approve access, then copy the code it shows you back into
# the terminal. It will print a refresh_token at the end — save that
# somewhere safe (env var). You only need to run this once.

from google_auth_oauthlib.flow import Flow

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

flow = Flow.from_client_secrets_file(
    "client_secret.json",
    scopes=SCOPES,
    redirect_uri="urn:ietf:wg:oauth:2.0:oob",
)

auth_url, _ = flow.authorization_url(access_type="offline")
print("Open this URL, authorize, then paste the code here:", auth_url)

code = input("Code: ")

try:
    flow.fetch_token(code=code)
    print("\nSave this refresh token somewhere safe:\n")
    print(flow.credentials.refresh_token)
except Exception as e:
    print("Something went wrong getting the token:", e)

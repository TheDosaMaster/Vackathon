# Quick test: creates one event on your primary Google Calendar using the
# credentials in .env. Run this to confirm the connection works before
# wiring it into the Discord bot.
#
# Setup:
#   pip install -r requirements.txt
#   python create_event.py

import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

load_dotenv()

creds = Credentials(
    token=None,
    refresh_token=os.getenv("GOOGLE_REFRESH_TOKEN"),
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    token_uri="https://oauth2.googleapis.com/token",
)

calendar = build("calendar", "v3", credentials=creds)


def create_test_event():
    start = datetime.now(timezone.utc) + timedelta(hours=1)
    end = start + timedelta(hours=1)

    event = {
        "summary": "Test event from plan agent",
        "description": "If you see this on your calendar, the connection works.",
        "start": {"dateTime": start.isoformat()},
        "end": {"dateTime": end.isoformat()},
    }

    res = calendar.events().insert(calendarId="primary", body=event).execute()
    print("Event created:", res.get("htmlLink"))


try:
    create_test_event()
except Exception as e:
    print("Something went wrong:", e)

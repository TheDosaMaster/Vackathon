import os
from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
from dotenv import load_dotenv
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request as GoogleRequest

load_dotenv()

# Google remaps classroom.coursework.* scopes to classroom.student-submissions.*
# This tells oauthlib not to raise an error when the returned scope differs.
os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

app = Flask(__name__)
CORS(app)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5000/auth/google/callback")

SCOPES = [
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
    "https://www.googleapis.com/auth/classroom.student-submissions.students.readonly",
]

token_store = {}

CLIENT_CONFIG = {
    "web": {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
}


def get_classroom_service():
    token_data = token_store.get("google_token")
    if not token_data:
        return None

    creds = Credentials(
        token=token_data["token"],
        refresh_token=token_data.get("refresh_token"),
        token_uri=token_data.get("token_uri"),
        client_id=token_data.get("client_id"),
        client_secret=token_data.get("client_secret"),
        scopes=token_data.get("scopes"),
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
        token_store["google_token"]["token"] = creds.token

    return build("classroom", "v1", credentials=creds)


# ── Auth ─────────────────────────────────────────────────────────────

@app.route("/auth/google")
def google_auth():
    flow = Flow.from_client_config(
        CLIENT_CONFIG,
        scopes=SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI,
    )
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    token_store["oauth_state"] = state
    token_store["code_verifier"] = flow.code_verifier
    return redirect(auth_url)


@app.route("/auth/google/callback")
def google_auth_callback():
    code = request.args.get("code")
    if not code:
        return jsonify({"error": "No authorization code received"}), 400

    flow = Flow.from_client_config(
        CLIENT_CONFIG,
        scopes=SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI,
    )
    flow.code_verifier = token_store.get("code_verifier")
    flow.fetch_token(code=code)
    creds = flow.credentials

    token_store["google_token"] = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes),
    }

    return jsonify({"status": "authenticated", "message": "Token stored. You can now call Classroom API endpoints."})


# ── Classroom Endpoints ──────────────────────────────────────────────

@app.route("/classroom/courses")
def list_courses():
    service = get_classroom_service()
    if not service:
        return jsonify({"error": "Not authenticated. Visit /auth/google first."}), 401
    results = service.courses().list(pageSize=50).execute()
    return jsonify({"courses": results.get("courses", [])})


@app.route("/classroom/courses/<course_id>")
def get_course(course_id):
    service = get_classroom_service()
    if not service:
        return jsonify({"error": "Not authenticated. Visit /auth/google first."}), 401
    return jsonify(service.courses().get(id=course_id).execute())


@app.route("/classroom/courses/<course_id>/coursework")
def list_coursework(course_id):
    service = get_classroom_service()
    if not service:
        return jsonify({"error": "Not authenticated. Visit /auth/google first."}), 401
    results = service.courses().courseWork().list(courseId=course_id, pageSize=50).execute()
    return jsonify({"coursework": results.get("courseWork", [])})


@app.route("/classroom/courses/<course_id>/students")
def list_students(course_id):
    service = get_classroom_service()
    if not service:
        return jsonify({"error": "Not authenticated. Visit /auth/google first."}), 401
    results = service.courses().students().list(courseId=course_id, pageSize=50).execute()
    return jsonify({"students": results.get("students", [])})


@app.route("/classroom/courses/<course_id>/submissions")
def list_submissions(course_id):
    service = get_classroom_service()
    if not service:
        return jsonify({"error": "Not authenticated. Visit /auth/google first."}), 401
    results = service.courses().courseWork().studentSubmissions().list(
        courseId=course_id, courseWorkId="-", pageSize=50
    ).execute()
    return jsonify({"submissions": results.get("studentSubmissions", [])})


@app.route("/classroom/summary")
def classroom_summary():
    service = get_classroom_service()
    if not service:
        return jsonify({"error": "Not authenticated. Visit /auth/google first."}), 401

    courses = service.courses().list(pageSize=50).execute().get("courses", [])
    summary = []
    for course in courses:
        cid = course["id"]
        students = service.courses().students().list(courseId=cid, pageSize=100).execute().get("students", [])
        coursework = service.courses().courseWork().list(courseId=cid, pageSize=100).execute().get("courseWork", [])
        summary.append({
            "course_id": cid,
            "name": course.get("name"),
            "section": course.get("section"),
            "student_count": len(students),
            "coursework_count": len(coursework),
        })
    return jsonify({"summary": summary})


@app.route("/")
def root():
    return jsonify({
        "status": "online",
        "endpoints": {
            "auth": "/auth/google",
            "courses": "/classroom/courses",
            "summary": "/classroom/summary",
        },
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)

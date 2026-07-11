import os
import json
import re
import urllib.error
import urllib.request
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
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

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


def gemini_generate(prompt, system_instruction=None, json_mode=False, temperature=0.35):
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": 1400,
        },
    }
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}
    if json_mode:
        payload["generationConfig"]["responseMimeType"] = "application/json"

    url = (
        "https://generativelanguage.googleapis.com/v1beta/"
        f"models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    )
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gemini request failed: {e.code} {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Gemini request failed: {e.reason}") from e

    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in parts).strip()
    if not text:
        raise RuntimeError("Gemini returned an empty response.")
    return text


def parse_gemini_json(text):
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    return json.loads(cleaned)


def fallback_priorities(assignments):
    def due_ts(assignment):
        try:
            from datetime import datetime
            return datetime.fromisoformat(assignment.get("dueAt", "").replace("Z", "+00:00")).timestamp()
        except Exception:
            return 9999999999

    sorted_assignments = sorted(
        assignments,
        key=lambda item: (
            due_ts(item),
            -int(item.get("estimatedMinutes", 0) or 0),
        ),
    )
    total = max(len(sorted_assignments), 1)
    priorities = []
    for index, assignment in enumerate(sorted_assignments):
        score = max(35, 95 - round(index * (55 / total)))
        priorities.append({
            "id": assignment.get("id"),
            "priorityScore": score,
            "priorityReason": "Due date and workload make this a sensible next focus.",
            "recommendedMinutes": assignment.get("estimatedMinutes", 75),
        })
    return priorities


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
    error = request.args.get("error")

    if error:
        return _auth_close_page(False, f"Google returned an error: {error}")

    if not code:
        return _auth_close_page(False, "No authorization code received")

    try:
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
        return _auth_close_page(True)
    except Exception as e:
        return _auth_close_page(False, str(e))


def _auth_close_page(success: bool, error: str = ""):
    """Return a tiny HTML page that posts a message to the opener and closes."""
    payload = json.dumps({"success": success, "error": error})
    return (
        "<!DOCTYPE html><html><body><script>"
        f"window.opener.postMessage({payload}, '*');"
        "window.close();"
        "</script></body></html>"
    )


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


@app.route("/classroom/assignments")
def list_all_assignments():
    """Fetch all assignments (courseWork) across every enrolled course."""
    service = get_classroom_service()
    if not service:
        return jsonify({"error": "Not authenticated. Visit /auth/google first."}), 401

    courses = service.courses().list(pageSize=50).execute().get("courses", [])
    all_assignments = []

    for course in courses:
        cid = course["id"]
        course_name = course.get("name", "Unknown Course")
        try:
            coursework = (
                service.courses()
                .courseWork()
                .list(courseId=cid, pageSize=100)
                .execute()
                .get("courseWork", [])
            )
            for cw in coursework:
                cw["courseName"] = course_name
                cw["courseSection"] = course.get("section", "")
                all_assignments.append(cw)
        except Exception as e:
            # Skip courses where we don't have permission to list coursework
            all_assignments.append({
                "courseId": cid,
                "courseName": course_name,
                "error": str(e),
            })

    # Sort by due date (assignments without a due date go last)
    def sort_key(a):
        due = a.get("dueDate")
        if due:
            return (due.get("year", 9999), due.get("month", 12), due.get("day", 31))
        return (9999, 12, 31)

    all_assignments.sort(key=sort_key)

    return jsonify({
        "total": len(all_assignments),
        "assignments": all_assignments,
    })


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


# ── AI Endpoints ────────────────────────────────────────────────────

@app.route("/ai/prioritize-schedule", methods=["POST"])
def prioritize_schedule():
    payload = request.get_json(silent=True) or {}
    assignments = payload.get("assignments", [])
    if not isinstance(assignments, list):
        return jsonify({"error": "assignments must be a list"}), 400

    if not assignments:
        return jsonify({
            "provider": "none",
            "priorities": [],
            "summary": "No assignments to prioritize.",
        })

    system = (
        "You are a scheduling assistant for students. Prioritize school assignments "
        "using due date urgency, effort, current status, risk, and protected school/sleep time. "
        "Return only valid JSON."
    )
    prompt = json.dumps({
        "task": (
            "Return JSON with keys summary and priorities. priorities must be an array of "
            "objects with id, priorityScore from 0-100, priorityReason under 18 words, and "
            "recommendedMinutes. Include every assignment exactly once."
        ),
        "now": payload.get("now"),
        "assignments": assignments,
        "personalEvents": payload.get("personalEvents", []),
        "schoolHours": payload.get("schoolHours", {}),
        "sleepWindow": payload.get("sleepWindow", {}),
        "existingWarnings": payload.get("warnings", []),
    })

    try:
        text = gemini_generate(prompt, system_instruction=system, json_mode=True, temperature=0.2)
        data = parse_gemini_json(text)
        priorities = data.get("priorities", [])
        if not isinstance(priorities, list):
            raise ValueError("Gemini JSON missing priorities array.")
        return jsonify({
            "provider": "gemini",
            "model": GEMINI_MODEL,
            "summary": data.get("summary", "Gemini prioritized your assignments."),
            "priorities": priorities,
        })
    except Exception as e:
        return jsonify({
            "provider": "fallback",
            "summary": "Using local prioritization until Gemini is available.",
            "error": str(e),
            "priorities": fallback_priorities(assignments),
        })


@app.route("/ai/chat", methods=["POST"])
def ai_chat():
    payload = request.get_json(silent=True) or {}
    message = (payload.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400

    context = payload.get("context", {})
    history = payload.get("history", [])
    system = (
        "You are Vachan, a calm planning companion for a student. Be concise, warm, and practical. "
        "Use the provided schedule context. Do not invent assignments. If the student is stressed, "
        "ground them and suggest one next action."
    )
    prompt = json.dumps({
        "studentMessage": message,
        "conversationHistory": history[-8:] if isinstance(history, list) else [],
        "context": context,
        "responseRules": [
            "Return plain text only.",
            "Keep the reply under 90 words unless the user asks for detail.",
            "Mention specific assignments or times only when they are present in context.",
        ],
    })

    try:
        text = gemini_generate(prompt, system_instruction=system, temperature=0.55)
        return jsonify({"provider": "gemini", "model": GEMINI_MODEL, "text": text})
    except Exception as e:
        return jsonify({
            "provider": "fallback",
            "text": "I can help with that. Gemini is not available right now, but I can still walk through today's plan, what is at risk, or the next useful step.",
            "error": str(e),
        })


@app.route("/")
def root():
    return jsonify({
        "status": "online",
        "endpoints": {
            "auth": "/auth/google",
            "courses": "/classroom/courses",
            "assignments": "/classroom/assignments",
            "summary": "/classroom/summary",
            "prioritize": "/ai/prioritize-schedule",
            "chat": "/ai/chat",
        },
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)

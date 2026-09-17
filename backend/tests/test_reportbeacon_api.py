"""ReportBeacon backend API tests (Node/Express + Postgres, cookie-based auth)."""
import os
import time
import uuid
import requests
import pytest

BASE_URL = "https://56d504c4-b05a-49c6-ab12-46977f8d5ca0.preview.emergentagent.com"
API = f"{BASE_URL}/api"

OWNER = ("owner@reportbeacon.demo", "demo1234")
MANAGER = ("manager@reportbeacon.demo", "demo1234")
VIEWER = ("viewer@reportbeacon.demo", "demo1234")


def _session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(s, email, password):
    return s.post(f"{API}/auth/login", json={"email": email, "password": password})


# ---------- Health ----------
def test_health():
    r = requests.get(f"{API}/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"


# ---------- Auth: login roles ----------
@pytest.mark.parametrize("email,expected_role", [
    (OWNER[0], "owner"),
    (MANAGER[0], "manager"),
    (VIEWER[0], "viewer"),
])
def test_login_roles(email, expected_role):
    s = _session()
    r = _login(s, email, "demo1234")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "user" in data and "workspaces" in data
    assert data["workspaces"][0]["role"] == expected_role
    assert "rb_session" in s.cookies


def test_login_wrong_password():
    s = _session()
    r = _login(s, OWNER[0], "wrongpass1")
    assert r.status_code == 401


def test_register_duplicate_owner_returns_409():
    r = requests.post(f"{API}/auth/register", json={
        "email": OWNER[0], "password": "demo1234", "name": "Owner"
    })
    assert r.status_code == 409


def test_brute_force_lockout():
    # Use a fresh throwaway email to avoid locking demo owner across tests
    email = f"lock_{uuid.uuid4().hex[:8]}@reportbeacon.test"
    # Register the user first so account exists
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "correctpass123", "name": "Lock Test"
    })
    assert r.status_code == 200
    # Now hammer with wrong passwords
    codes = []
    for _ in range(7):
        rr = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrongwrong"})
        codes.append(rr.status_code)
    assert 429 in codes, f"Expected a 429 lockout, got {codes}"


# ---------- Register new user ----------
@pytest.fixture(scope="module")
def new_user_session():
    email = f"test_{uuid.uuid4().hex[:10]}@reportbeacon.test"
    password = "supersecret1"
    s = _session()
    r = s.post(f"{API}/auth/register", json={"email": email, "password": password, "name": "TEST User"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["workspaces"][0]["role"] == "owner"
    assert "rb_session" in s.cookies
    return s, email


def test_register_and_clients_seeded(new_user_session):
    s, _ = new_user_session
    r = s.get(f"{API}/clients")
    assert r.status_code == 200
    data = r.json()
    # Response may be list or dict with clients + importableIds
    clients = data.get("clients") if isinstance(data, dict) else data
    assert clients is not None and len(clients) == 6, f"Expected 6 seeded clients, got {clients}"
    importable = data.get("importableIds") if isinstance(data, dict) else None
    if importable is not None:
        assert "lakeside-vet" in importable
        assert "summit-realty" in importable


# ---------- /api/me ----------
def test_me_requires_cookie():
    r = requests.get(f"{API}/me")
    assert r.status_code == 401


def test_me_with_cookie():
    s = _session()
    _login(s, OWNER[0], "demo1234")
    r = s.get(f"{API}/me")
    assert r.status_code == 200
    data = r.json()
    assert data.get("user", data).get("email") == OWNER[0] or data.get("email") == OWNER[0]


# ---------- Workspace ----------
def test_workspace_requires_auth():
    for path in ["/workspace", "/clients", "/reports"]:
        r = requests.get(f"{API}{path}")
        assert r.status_code == 401, f"{path} returned {r.status_code}"


def test_workspace_get_put_persist(new_user_session):
    s, _ = new_user_session
    r = s.get(f"{API}/workspace")
    assert r.status_code == 200
    body = r.json()
    assert "state" in body

    put = s.put(f"{API}/workspace", json={"state": {"mode": "performance"}})
    assert put.status_code == 200

    r2 = s.get(f"{API}/workspace")
    assert r2.status_code == 200
    state = r2.json()["state"]
    assert state.get("mode") == "performance"


# ---------- Reports ----------
def test_reports_crud(new_user_session):
    s, _ = new_user_session
    # Create
    payload = {"name": "TEST_Report", "config": {"range": "30d"}}
    r = s.post(f"{API}/reports", json=payload)
    assert r.status_code in (200, 201), r.text
    report = r.json()
    rid = report.get("id") or report.get("report", {}).get("id")
    assert rid, f"No id in {report}"

    # List
    r2 = s.get(f"{API}/reports")
    assert r2.status_code == 200
    lst = r2.json()
    items = lst if isinstance(lst, list) else lst.get("reports", [])
    match = [x for x in items if x.get("id") == rid]
    assert match, f"Report {rid} not in list"
    entry = match[0]
    assert "authorName" in entry or "authorEmail" in entry, f"Missing author fields: {entry}"

    # Delete
    d = s.delete(f"{API}/reports/{rid}")
    assert d.status_code in (200, 204)

    r3 = s.get(f"{API}/reports")
    items3 = r3.json() if isinstance(r3.json(), list) else r3.json().get("reports", [])
    assert not any(x.get("id") == rid for x in items3)

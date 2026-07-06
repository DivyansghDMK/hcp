/**
 * DeckLink × CardioX — Live Backend API Service
 *
 * Connects to the AWS backend shared with the CardioX desktop app.
 * Base URL: https://pmltkfluqk.execute-api.us-east-1.amazonaws.com
 *
 * Auth flow (OTP-based):
 *   1. sendOTP(phone)        → OTP sent via SMS
 *   2. verifyOTP(phone, otp) → returns JWT token + user data
 *   3. All subsequent calls attach JWT via Authorization: Bearer <token>
 */

const BASE_URL =
  import.meta.env.VITE_ECG_API_BASE_URL !== undefined
    ? import.meta.env.VITE_ECG_API_BASE_URL
    : "https://pmltkfluqk.execute-api.us-east-1.amazonaws.com";

const AUTH_PREFIX = import.meta.env.VITE_ECG_AUTH_PREFIX || "/dev/api";
const API_PREFIX  = import.meta.env.VITE_ECG_API_PREFIX  || "/api";

const SESSION_KEY = "decklink_session_v1";

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getToken() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.token || null;
  } catch { return null; }
}

export function saveToken(token) {
  try {
    const existing = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...existing, token }));
  } catch {}
}

// ─── Core request helper ──────────────────────────────────────────────────────

async function request(method, endpoint, { body, auth = false } = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  let json;
  try { json = await res.json(); } catch { json = { status: "error", message: res.statusText }; }
  if (!res.ok) {
    const msg = json?.message || json?.error || json?.detail || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

// ─── Auth Endpoints ────────────────────────────────────────────────────────────

export async function sendOTP(phone) {
  const mobile_number = normalizePhone(phone);
  return request("POST", `${AUTH_PREFIX}/auth/send-otp`, { body: { mobile_number } });
}

export async function verifyOTP(phone, otp) {
  const mobile_number = normalizePhone(phone);
  const res = await request("POST", `${AUTH_PREFIX}/auth/verify-otp`, {
    body: { mobile_number, otp: String(otp).trim() },
  });
  const token =
    res.token || res.jwt || res.access_token || res.id_token ||
    res.data?.token || res.data?.jwt || res.data?.access_token;
  if (!token) throw new Error("OTP verified but no JWT returned from server.");
  saveToken(token);
  return { ...res, token };
}

export async function checkMobile(phone) {
  const mobile_number = normalizePhone(phone);
  return request("GET", `${API_PREFIX}/user/check-mobile?mobile_number=${mobile_number}`);
}

// ─── User Endpoints ────────────────────────────────────────────────────────────

export async function getUserDetails() {
  return request("GET", `${API_PREFIX}/user/details`, { auth: true });
}

export async function saveUserDetails(payload) {
  return request("POST", `${API_PREFIX}/user/details`, { auth: true, body: payload });
}

// ─── Report Endpoints ─────────────────────────────────────────────────────────

export async function getReports() {
  return request("GET", `${API_PREFIX}/report`, { auth: true });
}

export function filterReportsByRole(reports, session) {
  if (!Array.isArray(reports)) return [];
  const role = session?.role;
  if (role === "HCP Head" || role === "Doctor Head") return reports;
  if (role === "Sr. Clinical Doctor" || role === "Jr. Clinical Doctor") {
    return reports.filter(
      (r) =>
        r.doctor_name?.toLowerCase() === session.userName?.toLowerCase() ||
        r.doctor_id === session.id
    );
  }
  if (role === "Sr. Admin" || role === "Jr. Admin") return reports;
  return [];
}

export function canViewPDF(role) {
  return (
    role === "HCP Head" || role === "Doctor Head" ||
    role === "Sr. Clinical Doctor" || role === "Jr. Clinical Doctor"
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}

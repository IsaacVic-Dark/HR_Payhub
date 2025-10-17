// lib/auth.js
import jwt from "jsonwebtoken";
import cookie from "cookie";

const TOKEN_NAME = process.env.NEXT_COOKIE_NAME || "token";
const JWT_SECRET = process.env.NEXT_JWT_SECRET;
const JWT_EXPIRES_IN = process.env.NEXT_JWT_EXPIRES_IN || "1h";

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function setTokenCookie(res, token) {
  const serialized = cookie.serialize(TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // match JWT_EXPIRES_IN (seconds). adjust to match.
  });
  res.setHeader("Set-Cookie", serialized);
}

export function removeTokenCookie(res) {
  const serialized = cookie.serialize(TOKEN_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  res.setHeader("Set-Cookie", serialized);
}

export function parseCookies(req) {
  return cookie.parse(req ? req.headers.cookie || "" : document.cookie);
}

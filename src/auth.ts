import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";

declare global {
  namespace Express {
    interface Request {
      adminName?: string;
    }
  }
}

interface TokenPayload {
  username: string;
  exp: number;
}

function toBase64Url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(data: string): string {
  return crypto.createHmac("sha256", config.authSecret).update(data).digest("base64url");
}

export function createAdminSessionToken(username: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const payload: TokenPayload = {
    username,
    exp: expiresAt,
  };
  const payloadEncoded = toBase64Url(JSON.stringify(payload));
  const signature = sign(payloadEncoded);
  return {
    token: `${payloadEncoded}.${signature}`,
    expiresAt,
  };
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payloadEncoded, signature] = parts;
  const expectedSig = sign(payloadEncoded);
  if (signature !== expectedSig) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadEncoded)) as TokenPayload;
    if (!payload.username || !payload.exp || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.header("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];

  if (!token) {
    res.status(401).json({ message: "unauthorized" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ message: "unauthorized" });
    return;
  }

  req.adminName = payload.username;
  next();
}

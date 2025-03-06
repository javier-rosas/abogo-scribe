import jwt from "jsonwebtoken";

import type { RequestHandler } from "express";

// Environment Variables
const JWT_SECRET = process.env.JWT_SECRET as string;

// Check if environment variables are defined
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

// Middleware to Protect Routes
export const authenticateJWT: RequestHandler = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];

  if (!token) {
    res.status(403).json({ error: "No token provided" });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      res.status(403).json({ error: "Invalid token" });
      return;
    }
    (req as any).user = user;
    next();
  });
};

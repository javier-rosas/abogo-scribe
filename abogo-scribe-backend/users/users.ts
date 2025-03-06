import express, { Router } from 'express';
import mongoose, { Document, Schema } from 'mongoose';

import { authenticateJWT } from '../auth/middleware';

import type { Request, Response } from "express";

// ==================== User Schema & Model ====================

// Interface for User document
export interface IUser extends Document {
  email: string;
  name: string;
  picture?: string;
  googleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// User Schema
const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true, // Make email unique
      index: true, // Add index for faster queries
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    picture: {
      type: String,
      trim: true,
    },
    googleId: {
      type: String,
      sparse: true, // Allows null/undefined values while maintaining uniqueness for non-null values
      index: true,
    },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

// Create and export the User model
export const User = mongoose.model<IUser>("User", UserSchema);

// ==================== User DAO (Data Access Object) ====================

export const userDao = {
  // Create a new user
  create: async (userData: Partial<IUser>): Promise<IUser> => {
    try {
      const user = new User(userData);
      return await user.save();
    } catch (error) {
      throw error;
    }
  },

  // Find user by email
  findByEmail: async (email: string): Promise<IUser | null> => {
    try {
      return await User.findOne({ email: email.toLowerCase() });
    } catch (error) {
      throw error;
    }
  },

  // Find user by Google ID
  findByGoogleId: async (googleId: string): Promise<IUser | null> => {
    try {
      return await User.findOne({ googleId });
    } catch (error) {
      throw error;
    }
  },

  // Get all users (with optional pagination)
  findAll: async (
    limit: number = 10,
    page: number = 1
  ): Promise<{
    users: IUser[];
    total: number;
    page: number;
    pages: number;
  }> => {
    try {
      const skip = (page - 1) * limit;
      const total = await User.countDocuments();
      const users = await User.find()
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      return {
        users,
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw error;
    }
  },

  // Update a user
  update: async (
    email: string,
    userData: Partial<IUser>
  ): Promise<IUser | null> => {
    try {
      // Don't allow changing the email in an update
      if (userData.email) {
        delete userData.email;
      }

      return await User.findOneAndUpdate(
        { email: email.toLowerCase() },
        { $set: userData },
        { new: true, runValidators: true }
      );
    } catch (error) {
      throw error;
    }
  },

  // Delete a user
  delete: async (email: string): Promise<IUser | null> => {
    try {
      return await User.findOneAndDelete({ email: email.toLowerCase() });
    } catch (error) {
      throw error;
    }
  },

  // Upsert a user (create if doesn't exist, update if exists)
  upsert: async (userData: Partial<IUser>): Promise<IUser> => {
    try {
      if (!userData.email) {
        throw new Error("Email is required for upsert operation");
      }

      const email = userData.email.toLowerCase();

      const updatedUser = await User.findOneAndUpdate(
        { email },
        { $set: userData },
        {
          new: true, // Return the updated document
          upsert: true, // Create if it doesn't exist
          runValidators: true,
          setDefaultsOnInsert: true, // Apply default values on insert
        }
      );

      return updatedUser;
    } catch (error) {
      throw error;
    }
  },
};

// ==================== User Controller ====================

export const userController = {
  // Create a new user
  createUser: async (req: Request, res: Response): Promise<void> => {
    try {
      const userData = req.body;

      // Check if user with this email already exists
      const existingUser = await userDao.findByEmail(userData.email);
      if (existingUser) {
        res.status(409).json({ error: "User with this email already exists" });
        return;
      }

      const user = await userDao.create(userData);
      res.status(201).json(user);
    } catch (error: any) {
      if (error.name === "ValidationError") {
        res.status(400).json({ error: error.message });
      } else {
        console.error("Error creating user:", error);
        res.status(500).json({ error: "Failed to create user" });
      }
    }
  },

  // Get a user by email
  getUserByEmail: async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.params;
      const user = await userDao.findByEmail(email);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.status(200).json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  },

  // Get all users (with pagination)
  getAllUsers: async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const page = parseInt(req.query.page as string) || 1;

      const result = await userDao.findAll(limit, page);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  },

  // Update a user
  updateUser: async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.params;
      const userData = req.body;

      // Check if user exists
      const existingUser = await userDao.findByEmail(email);
      if (!existingUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const updatedUser = await userDao.update(email, userData);
      res.status(200).json(updatedUser);
    } catch (error: any) {
      if (error.name === "ValidationError") {
        res.status(400).json({ error: error.message });
      } else {
        console.error("Error updating user:", error);
        res.status(500).json({ error: "Failed to update user" });
      }
    }
  },

  // Delete a user
  deleteUser: async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.params;

      // Check if user exists
      const existingUser = await userDao.findByEmail(email);
      if (!existingUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      await userDao.delete(email);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  },
};

// ==================== User Routes ====================

export const userRouter: Router = express.Router();

// Apply authentication middleware to all routes
userRouter.use(authenticateJWT);

// POST /users - Create a new user
userRouter.post("/", userController.createUser);

// GET /users - Get all users (with pagination)
userRouter.get("/", userController.getAllUsers);

// GET /users/:email - Get a user by email
userRouter.get("/:email", userController.getUserByEmail);

// PUT /users/:email - Update a user
userRouter.put("/:email", userController.updateUser);

// DELETE /users/:email - Delete a user
userRouter.delete("/:email", userController.deleteUser);

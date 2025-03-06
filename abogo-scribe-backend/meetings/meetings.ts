import express, { Router } from 'express';
import mongoose, { Document, Schema } from 'mongoose';

import { authenticateJWT } from '../auth/middleware';

import type { Request, Response, RequestHandler } from "express";

// ==================== Meeting Schema & Model ====================

// Interface for Meeting document
export interface IMeeting extends Document {
  title: string;
  date: string;
  startTime: string;
  duration: number;
  owner: mongoose.Types.ObjectId; // Reference to the User who owns this meeting
  createdAt: Date;
  updatedAt: Date;
}

// Extend the Express Request interface to include the user property
interface AuthenticatedRequest extends Request {
  user?: {
    _id: mongoose.Types.ObjectId;
    email: string;
    name: string;
    [key: string]: any;
  };
}

// Meeting Schema
const MeetingSchema = new Schema<IMeeting>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 1, // Minimum duration in minutes
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Add index for faster queries
    },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

// Create and export the Meeting model
export const Meeting = mongoose.model<IMeeting>("Meeting", MeetingSchema);

// ==================== Meeting DAO (Data Access Object) ====================

export const meetingDao = {
  // Create a new meeting
  create: async (meetingData: Partial<IMeeting>): Promise<IMeeting> => {
    try {
      const meeting = new Meeting(meetingData);
      return await meeting.save();
    } catch (error) {
      throw error;
    }
  },

  // Find meeting by ID
  findById: async (id: string): Promise<IMeeting | null> => {
    try {
      return await Meeting.findById(id).populate("owner", "name email");
    } catch (error) {
      throw error;
    }
  },

  // Find meetings by owner
  findByOwner: async (
    ownerId: mongoose.Types.ObjectId,
    limit: number = 10,
    page: number = 1
  ): Promise<{
    meetings: IMeeting[];
    total: number;
    page: number;
    pages: number;
  }> => {
    try {
      const skip = (page - 1) * limit;
      const total = await Meeting.countDocuments({ owner: ownerId });
      const meetings = await Meeting.find({ owner: ownerId })
        .skip(skip)
        .limit(limit)
        .sort({ date: 1, startTime: 1 }); // Sort by date and then by startTime

      return {
        meetings,
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw error;
    }
  },

  // Get all meetings (with optional pagination)
  findAll: async (
    limit: number = 10,
    page: number = 1
  ): Promise<{
    meetings: IMeeting[];
    total: number;
    page: number;
    pages: number;
  }> => {
    try {
      const skip = (page - 1) * limit;
      const total = await Meeting.countDocuments();
      const meetings = await Meeting.find()
        .skip(skip)
        .limit(limit)
        .sort({ date: 1, startTime: 1 })
        .populate("owner", "name email");

      return {
        meetings,
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw error;
    }
  },

  // Update a meeting
  update: async (
    id: string,
    meetingData: Partial<IMeeting>
  ): Promise<IMeeting | null> => {
    try {
      return await Meeting.findByIdAndUpdate(
        id,
        { $set: meetingData },
        { new: true, runValidators: true }
      ).populate("owner", "name email");
    } catch (error) {
      throw error;
    }
  },

  // Delete a meeting
  delete: async (id: string): Promise<IMeeting | null> => {
    try {
      return await Meeting.findByIdAndDelete(id);
    } catch (error) {
      throw error;
    }
  },

  // Find meetings by date range
  findByDateRange: async (
    startDate: string,
    endDate: string,
    ownerId?: mongoose.Types.ObjectId
  ): Promise<IMeeting[]> => {
    try {
      const query: any = {
        date: { $gte: startDate, $lte: endDate },
      };

      if (ownerId) {
        query.owner = ownerId;
      }

      return await Meeting.find(query)
        .sort({ date: 1, startTime: 1 })
        .populate("owner", "name email");
    } catch (error) {
      throw error;
    }
  },
};

// ==================== Meeting Controller ====================

export const meetingController = {
  // Create a new meeting
  createMeeting: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const meetingData = req.body;

      if (!req.user?._id) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      // Set the owner to the authenticated user
      meetingData.owner = req.user._id;

      const meeting = await meetingDao.create(meetingData);
      res.status(201).json(meeting);
    } catch (error: any) {
      if (error.name === "ValidationError") {
        res.status(400).json({ error: error.message });
      } else {
        console.error("Error creating meeting:", error);
        res.status(500).json({ error: "Failed to create meeting" });
      }
    }
  },

  // Get a meeting by ID
  getMeetingById: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;

      if (!req.user?._id) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const meeting = await meetingDao.findById(id);

      if (!meeting) {
        res.status(404).json({ error: "Meeting not found" });
        return;
      }

      // Check if the user is the owner of the meeting
      if (meeting.owner.toString() !== req.user._id.toString()) {
        res
          .status(403)
          .json({ error: "Not authorized to access this meeting" });
        return;
      }

      res.status(200).json(meeting);
    } catch (error) {
      console.error("Error fetching meeting:", error);
      res.status(500).json({ error: "Failed to fetch meeting" });
    }
  },

  // Get all meetings for the authenticated user
  getUserMeetings: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const page = parseInt(req.query.page as string) || 1;

      if (!req.user?._id) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const userId = req.user._id;

      const result = await meetingDao.findByOwner(userId, limit, page);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  },

  // Get all meetings (admin only)
  getAllMeetings: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      // This endpoint could be restricted to admin users
      const limit = parseInt(req.query.limit as string) || 10;
      const page = parseInt(req.query.page as string) || 1;

      const result = await meetingDao.findAll(limit, page);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  },

  // Update a meeting
  updateMeeting: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const meetingData = req.body;

      if (!req.user?._id) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      // Check if meeting exists and user is the owner
      const existingMeeting = await meetingDao.findById(id);
      if (!existingMeeting) {
        res.status(404).json({ error: "Meeting not found" });
        return;
      }

      if (existingMeeting.owner.toString() !== req.user._id.toString()) {
        res
          .status(403)
          .json({ error: "Not authorized to update this meeting" });
        return;
      }

      const updatedMeeting = await meetingDao.update(id, meetingData);
      res.status(200).json(updatedMeeting);
    } catch (error: any) {
      if (error.name === "ValidationError") {
        res.status(400).json({ error: error.message });
      } else {
        console.error("Error updating meeting:", error);
        res.status(500).json({ error: "Failed to update meeting" });
      }
    }
  },

  // Delete a meeting
  deleteMeeting: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;

      if (!req.user?._id) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      // Check if meeting exists and user is the owner
      const existingMeeting = await meetingDao.findById(id);
      if (!existingMeeting) {
        res.status(404).json({ error: "Meeting not found" });
        return;
      }

      if (existingMeeting.owner.toString() !== req.user._id.toString()) {
        res
          .status(403)
          .json({ error: "Not authorized to delete this meeting" });
        return;
      }

      await meetingDao.delete(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting meeting:", error);
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  },

  // Get meetings by date range
  getMeetingsByDateRange: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ error: "Start date and end date are required" });
        return;
      }

      if (!req.user?._id) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const userId = req.user._id;
      const meetings = await meetingDao.findByDateRange(
        startDate as string,
        endDate as string,
        userId
      );

      res.status(200).json(meetings);
    } catch (error) {
      console.error("Error fetching meetings by date range:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  },
};

// ==================== Meeting Routes ====================

export const meetingRouter: Router = express.Router();

// Apply authentication middleware to all routes
meetingRouter.use(authenticateJWT);

// Helper to cast controller methods to RequestHandler
const asHandler = (
  fn: (req: AuthenticatedRequest, res: Response) => Promise<void>
): RequestHandler => fn as RequestHandler;

// POST /meetings - Create a new meeting
meetingRouter.post("/", asHandler(meetingController.createMeeting));

// GET /meetings - Get all meetings for the authenticated user
meetingRouter.get("/", asHandler(meetingController.getUserMeetings));

// GET /meetings/all - Get all meetings (admin only)
meetingRouter.get("/all", asHandler(meetingController.getAllMeetings));

// GET /meetings/date-range - Get meetings by date range
meetingRouter.get(
  "/date-range",
  asHandler(meetingController.getMeetingsByDateRange)
);

// GET /meetings/:id - Get a meeting by ID
meetingRouter.get("/:id", asHandler(meetingController.getMeetingById));

// PUT /meetings/:id - Update a meeting
meetingRouter.put("/:id", asHandler(meetingController.updateMeeting));

// DELETE /meetings/:id - Delete a meeting
meetingRouter.delete("/:id", asHandler(meetingController.deleteMeeting));

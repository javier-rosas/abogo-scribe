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

  // Find meetings by date range for a specific owner
  findByDateRange: async (
    startDate: string,
    endDate: string,
    ownerId: mongoose.Types.ObjectId
  ): Promise<IMeeting[]> => {
    try {
      return await Meeting.find({
        owner: ownerId,
        date: { $gte: startDate, $lte: endDate },
      })
        .sort({ date: 1, startTime: 1 })
        .populate("owner", "name email");
    } catch (error) {
      throw error;
    }
  },

  // Update meetings by owner and date
  updateByOwnerAndDate: async (
    ownerId: mongoose.Types.ObjectId,
    date: string,
    startTime: string,
    meetingData: Partial<IMeeting>
  ): Promise<IMeeting | null> => {
    try {
      return await Meeting.findOneAndUpdate(
        { owner: ownerId, date: date, startTime: startTime },
        { $set: meetingData },
        { new: true, runValidators: true }
      ).populate("owner", "name email");
    } catch (error) {
      throw error;
    }
  },

  // Delete meeting by owner and date
  deleteByOwnerAndDate: async (
    ownerId: mongoose.Types.ObjectId,
    date: string,
    startTime: string
  ): Promise<IMeeting | null> => {
    try {
      return await Meeting.findOneAndDelete({
        owner: ownerId,
        date: date,
        startTime: startTime,
      });
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

  // Get meetings by date range for authenticated user
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

  // Update meeting by date and time
  updateMeetingByDate: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { date, startTime } = req.query;
      const meetingData = req.body;

      if (!date || !startTime) {
        res.status(400).json({ error: "Date and start time are required" });
        return;
      }

      if (!req.user?._id) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const updatedMeeting = await meetingDao.updateByOwnerAndDate(
        req.user._id,
        date as string,
        startTime as string,
        meetingData
      );

      if (!updatedMeeting) {
        res.status(404).json({ error: "Meeting not found" });
        return;
      }

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

  // Delete meeting by date and time
  deleteMeetingByDate: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { date, startTime } = req.query;

      if (!date || !startTime) {
        res.status(400).json({ error: "Date and start time are required" });
        return;
      }

      if (!req.user?._id) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const deletedMeeting = await meetingDao.deleteByOwnerAndDate(
        req.user._id,
        date as string,
        startTime as string
      );

      if (!deletedMeeting) {
        res.status(404).json({ error: "Meeting not found" });
        return;
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting meeting:", error);
      res.status(500).json({ error: "Failed to delete meeting" });
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

// GET /meetings/date-range - Get meetings by date range
meetingRouter.get(
  "/date-range",
  asHandler(meetingController.getMeetingsByDateRange)
);

// PUT /meetings/by-date - Update a meeting by date and time
meetingRouter.put("/by-date", asHandler(meetingController.updateMeetingByDate));

// DELETE /meetings/by-date - Delete a meeting by date and time
meetingRouter.delete(
  "/by-date",
  asHandler(meetingController.deleteMeetingByDate)
);

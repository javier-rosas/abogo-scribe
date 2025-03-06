const VITE_API_URL = import.meta.env.VITE_API_URL;

// Types
interface Meeting {
  _id: string;
  title: string;
  date: string;
  startTime: string;
  duration: number;
  owner: string;
  transcription?: string; // Optional transcription field
  notes?: string; // Optional notes field
  createdAt: string;
  updatedAt: string;
}

interface MeetingInput {
  title: string;
  date: string;
  startTime: string;
  duration?: number; // Changed to optional
  transcription?: string; // Optional transcription field
  notes?: string; // Optional notes field
}

interface PaginatedMeetings {
  meetings: Meeting[];
  total: number;
  page: number;
  pages: number;
}

// API Functions

/**
 * Create a new meeting
 * @param token JWT token for authentication
 * @param meetingData The meeting data to create
 * @returns Promise<Meeting>
 */
export const createMeeting = async (
  token: string,
  meetingData: MeetingInput
): Promise<Meeting> => {
  const response = await fetch(`${VITE_API_URL}/meetings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(meetingData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create meeting");
  }

  return response.json();
};

/**
 * Get all meetings for the authenticated user with pagination
 * @param token JWT token for authentication
 * @param page Page number (default: 1)
 * @param limit Number of items per page (default: 10)
 * @returns Promise<PaginatedMeetings>
 */
export const getUserMeetings = async (
  token: string,
  page: number = 1,
  limit: number = 10
): Promise<PaginatedMeetings> => {
  const response = await fetch(
    `${VITE_API_URL}/meetings?page=${page}&limit=${limit}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch meetings");
  }

  return response.json();
};

/**
 * Get meetings within a date range
 * @param token JWT token for authentication
 * @param startDate Start date in ISO format (YYYY-MM-DD)
 * @param endDate End date in ISO format (YYYY-MM-DD)
 * @returns Promise<Meeting[]>
 */
export const getMeetingsByDateRange = async (
  token: string,
  startDate: string,
  endDate: string
): Promise<Meeting[]> => {
  const response = await fetch(
    `${VITE_API_URL}/meetings/date-range?startDate=${startDate}&endDate=${endDate}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch meetings by date range");
  }

  return response.json();
};

/**
 * Update a meeting by ID
 * @param token JWT token for authentication
 * @param meetingId Meeting ID
 * @param meetingData Updated meeting data
 * @returns Promise<Meeting>
 */
export const updateMeeting = async (
  token: string,
  meetingId: string,
  meetingData: Partial<MeetingInput>
): Promise<Meeting> => {
  const response = await fetch(`${VITE_API_URL}/meetings/${meetingId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(meetingData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update meeting");
  }

  return response.json();
};

/**
 * Delete a meeting by ID
 * @param token JWT token for authentication
 * @param meetingId Meeting ID
 * @returns Promise<void>
 */
export const deleteMeeting = async (
  token: string,
  meetingId: string
): Promise<void> => {
  const response = await fetch(`${VITE_API_URL}/meetings/${meetingId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete meeting");
  }
};

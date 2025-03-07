import { useEffect, useState } from 'react';

import { getUserMeetings } from '@/api/meetings';
import { useAuth } from '@/auth-context';
import { GroupedMeetings, Meeting } from '@/types';

import { MeetingItem } from './meeting-item';

// Sample meeting data
// const meetings: Meeting[] = [
// {
//   id: 1,
//   title: "Product Team Standup",
//   date: "2025-03-02",
//   startTime: "09:00",
//   duration: 30,
//   participants: ["Alex", "Jamie", "Taylor"],
//   color: "bg-blue-100 text-blue-900",
// },
// {
//   id: 2,
//   title: "Design Review",
//   date: "2025-03-02",
//   startTime: "11:00",
//   duration: 60,
//   participants: ["Casey", "Morgan", "Riley"],
//   color: "bg-purple-100 text-purple-900",
// },
// {
//   id: 3,
//   title: "Client Presentation",
//   date: "2025-03-03",
//   startTime: "10:00",
//   duration: 45,
//   participants: ["Jordan", "Quinn", "Avery"],
//   color: "bg-orange-100 text-orange-900",
// },
// {
//   id: 4,
//   title: "Sprint Planning",
//   date: "2025-03-03",
//   startTime: "14:00",
//   duration: 90,
//   participants: ["Alex", "Jamie", "Casey", "Morgan"],
//   color: "bg-green-100 text-green-900",
// },
// {
//   id: 5,
//   title: "One-on-One",
//   date: "2025-03-04",
//   startTime: "09:30",
//   duration: 30,
//   participants: ["Alex", "Jamie"],
//   color: "bg-indigo-100 text-indigo-900",
// },
// {
//   id: 6,
//   title: "Team Lunch",
//   date: "2025-03-04",
//   startTime: "12:00",
//   duration: 60,
//   participants: ["Alex", "Jamie", "Taylor", "Casey", "Morgan", "Riley"],
//   color: "bg-pink-100 text-pink-900",
// },
// ];

const groupMeetingsByDate = (meetings: Meeting[]): GroupedMeetings[] => {
  const grouped: { [key: string]: Meeting[] } = {};

  meetings.forEach((meeting) => {
    if (!grouped[meeting.date]) {
      grouped[meeting.date] = [];
    }
    grouped[meeting.date].push(meeting);
  });

  return Object.entries(grouped).map(([date, meetings]) => ({
    date,
    meetings,
  }));
};

export function MeetingList({
  onMeetingSelect,
}: {
  onMeetingSelect: (meeting: Meeting) => void;
}) {
  const { user, jwt } = useAuth();

  const [meetings, setMeetings] = useState<Meeting[]>([]);

  useEffect(() => {
    if (user && jwt) {
      const fetchMeetings = async () => {
        try {
          const response = await getUserMeetings(jwt);
          // Transform API response to match Meeting type
          const formattedMeetings = response.meetings.map((meeting: any) => ({
            id: meeting._id,
            title: meeting.title,
            date: meeting.date,
            startTime: meeting.startTime,
            duration: meeting.duration,
            participants: [], // Add default or fetch participants if needed
            color: "bg-blue-100 text-blue-900", // Add default color or logic to assign colors
          }));
          setMeetings(formattedMeetings);
        } catch (error) {
          console.error("Failed to fetch meetings:", error);
        }
      };

      fetchMeetings();
    }
  }, [user, jwt]);

  const groupedMeetings: GroupedMeetings[] = groupMeetingsByDate(meetings);

  return (
    <div className="space-y-10">
      {groupedMeetings.map((group) => (
        <div key={group.date} className="space-y-4">
          <h2 className="text-lg font-medium text-foreground/80 px-1">
            {new Date(group.date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h2>
          <div className="space-y-3">
            {group.meetings.map((meeting: Meeting) => (
              <MeetingItem
                key={meeting.id}
                meeting={meeting}
                onClick={() => onMeetingSelect(meeting)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

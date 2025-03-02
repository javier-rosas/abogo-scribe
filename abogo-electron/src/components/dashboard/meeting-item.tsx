import { ClockIcon } from 'lucide-react';

import { Meeting } from '@/types';

export function MeetingItem({
  meeting,
  onClick,
}: {
  meeting: Meeting;
  onClick?: () => void;
}) {
  // Format the time to display
  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":");
    const hour = Number.parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Calculate end time
  const calculateEndTime = (startTime: string, durationMinutes: number) => {
    const [hours, minutes] = startTime.split(":").map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0);

    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    const endHours = endDate.getHours().toString().padStart(2, "0");
    const endMinutes = endDate.getMinutes().toString().padStart(2, "0");

    return `${endHours}:${endMinutes}`;
  };

  const startTime = formatTime(meeting.startTime);
  const endTime = formatTime(
    calculateEndTime(meeting.startTime, meeting.duration)
  );

  return (
    <div
      className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex-shrink-0 w-2 h-12 rounded-full ${
            meeting.color || "bg-blue-100"
          }`}
        ></div>
        <div className="flex-1">
          <h3 className="font-medium text-base">{meeting.title}</h3>
          <div className="flex items-center text-sm text-muted-foreground mt-1">
            <ClockIcon className="mr-1.5 h-3.5 w-3.5" />
            <span>
              {startTime} - {endTime} · {meeting.duration} min
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center mt-4 sm:mt-0">
        <div className="flex -space-x-3">
          {meeting.participants.slice(0, 3).map((participant, index) => (
            <div
              key={index}
              className="h-8 w-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-xs font-medium shadow-sm"
              title={participant}
            >
              {participant.charAt(0)}
            </div>
          ))}
          {meeting.participants.length > 3 && (
            <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium shadow-sm">
              +{meeting.participants.length - 3}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

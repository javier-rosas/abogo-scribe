export interface Meeting {
  id: string;
  title: string;
  date: string;
  startTime: string;
  duration: number;
  participants: string[];
  color: string;
}

export interface GroupedMeetings {
  date: string;
  meetings: Meeting[];
}

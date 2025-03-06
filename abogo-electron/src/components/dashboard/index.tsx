import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Meeting } from '@/types';

import { LogoutButton } from '../ui/logout-button';
import { MeetingList } from './meeting-list';

export default function Dashboard({
  onMeetingSelect,
}: {
  onMeetingSelect: (meeting: Meeting) => void;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:bg-accent"
          onClick={() => onMeetingSelect(null as any)}
        >
          <Plus className="h-4 w-4" />
          Start New Note
        </Button>
        <LogoutButton />
      </div>
      <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-medium tracking-tight mb-2">Calendar</h1>
          <p className="text-muted-foreground text-sm">
            Your upcoming meetings
          </p>
        </header>

        <MeetingList onMeetingSelect={onMeetingSelect} />
      </div>
    </div>
  );
}

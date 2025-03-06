import './App.css';

import { useState } from 'react';

import { AuthProvider, useAuth } from './auth-context';
import Dashboard from './components/dashboard';
import Editor from './components/editor';
import LoginPage from './components/login';
import { Meeting } from './types';

function App() {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isCreatingNewNote, setIsCreatingNewNote] = useState(false);

  const { user } = useAuth();

  if (!user) {
    return <LoginPage />;
  }

  console.log("user", user);

  const handleMeetingSelect = (meeting: Meeting | null) => {
    if (meeting === null) {
      setIsCreatingNewNote(true);
    } else {
      setSelectedMeeting(meeting);
    }
  };

  const handleBack = () => {
    setSelectedMeeting(null);
    setIsCreatingNewNote(false);
  };

  return (
    <div className="h-screen w-screen overflow-hidden">
      {selectedMeeting || isCreatingNewNote ? (
        <Editor meeting={selectedMeeting || undefined} onBack={handleBack} />
      ) : (
        <Dashboard onMeetingSelect={handleMeetingSelect} />
      )}
    </div>
  );
}

export default function Root() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

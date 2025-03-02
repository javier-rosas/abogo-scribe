import './App.css';

import { useState } from 'react';

import Dashboard from './components/dashboard';
import Editor from './components/editor';
import { Meeting } from './types';

function App() {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  return (
    <div className="h-screen w-screen overflow-hidden">
      {selectedMeeting ? (
        <Editor
          meeting={selectedMeeting}
          onBack={() => setSelectedMeeting(null)}
        />
      ) : (
        <Dashboard onMeetingSelect={setSelectedMeeting} />
      )}
    </div>
  );
}

export default App;

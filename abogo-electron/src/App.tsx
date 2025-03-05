import "./App.css";

import { useState } from "react";

import { AuthProvider, useAuth } from "./auth-context";
import Dashboard from "./components/dashboard";
import Editor from "./components/editor";
import LoginPage from "./components/login";
import { Meeting } from "./types";

function App() {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const { user } = useAuth();

  if (!user) {
    return <LoginPage />;
  }

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

export default function Root() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

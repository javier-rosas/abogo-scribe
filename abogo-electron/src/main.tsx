import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Toaster } from "@/components/ui/sonner";

import App from "./App.tsx";

// Add base styles to body
document.body.classList.add("font-sans", "antialiased");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Toaster />
  </StrictMode>
);

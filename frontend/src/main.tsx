
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App.tsx";
import "./styles/index.css";
import { AuthProvider } from "./app/auth/AuthContext.tsx";

// Ensure design-system CSS variables use dark tokens globally.
document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </AuthProvider>,
);
  
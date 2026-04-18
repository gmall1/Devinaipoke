import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClientInstance } from "@/lib/query-client";
import { AuthProvider } from "@/lib/AuthContext";
import PageNotFound from "@/lib/PageNotFound";
import Home from "@/pages/Home";
import Collection from "@/pages/Collection";
import Decks from "@/pages/Decks";
import DeckBuilder from "@/pages/DeckBuilder";
import Lobby from "@/pages/Lobby";
import Battle from "@/pages/Battle";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/collection" element={<Collection />} />
      <Route path="/decks" element={<Decks />} />
      <Route path="/deck-builder" element={<DeckBuilder />} />
      <Route path="/lobby" element={<Lobby />} />
      <Route path="/battle" element={<Battle />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AppRoutes />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

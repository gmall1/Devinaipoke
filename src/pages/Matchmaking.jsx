const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from "react";

import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import BottomNav from "@/components/tcg/BottomNav";
import PageHeader from "@/components/tcg/PageHeader";
import { Button } from "@/components/ui/button";
import { Loader2, Swords, Bot, Users } from "lucide-react";
import { initGameState, shuffle } from "@/lib/gameEngine";
import { tcgdex } from "@/lib/tcgdex";

export default function Matchmaking() {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("mode") || "unlimited";
  const ranked = urlParams.get("ranked") === "true";
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [searching, setSearching] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [selectedDeckId, setSelectedDeckId] = useState(null);

  useEffect(() => {
    db.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: decks = [] } = useQuery({
    queryKey: ["decks"],
    queryFn: () => db.entities.Deck.list("-created_date", 50),
    enabled: !!user,
  });

  // Poll for opponent joining
  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(async () => {
      const rooms = await db.entities.GameRoom.filter({ id: roomId });
      const room = rooms[0];
      if (room?.status === "active") {
        clearInterval(interval);
        navigate(`/battle/${roomId}`);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [roomId, navigate]);

  // Also subscribe to room changes
  useEffect(() => {
    if (!roomId) return;
    const unsub = db.entities.GameRoom.subscribe((event) => {
      if (event.id === roomId && event.data?.status === "active") {
        navigate(`/battle/${roomId}`);
      }
    });
    return unsub;
  }, [roomId, navigate]);

  const vsAI = async () => {
    if (!selectedDeckId && decks.length > 0) {
      alert("Please select a deck first.");
      return;
    }
    setSearching(true);
    // Build a random AI deck from TCGdex
    const deck = decks.find((d) => d.id === selectedDeckId) || decks[0];
    const cardIds = deck?.card_ids || [];
    // Load player cards
    const playerCards = await loadDeckCards(cardIds);
    const aiCards = await loadAIDeck();

    const gameState = initGameState({
      player1: { id: user.id, name: user.full_name || "You", cards: playerCards },
      player2: { id: "ai", name: "AI Trainer", cards: aiCards },
      mode,
    });

    const room = await db.entities.GameRoom.create({
      status: "active",
      mode,
      ranked: false,
      player1_id: user.id,
      player1_name: user.full_name || "You",
      player2_id: "ai",
      player2_name: "AI Trainer",
      game_state: gameState,
      turn_number: 1,
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { motion, AnimatePresence } from "framer-motion";
import BattleField from "@/components/battle/BattleField";
import BattleHand from "@/components/battle/BattleHand";
import BattleLog from "@/components/battle/BattleLog";
import BattleActionBar from "@/components/battle/BattleActionBar";
import { Loader2 } from "lucide-react";
import { endTurn, playBasicToActive, playBasicToBench, attachEnergy, attack, retreat } from "@/lib/gameEngine";
import { aiTakeTurn } from "@/lib/aiOpponent";

export default function BattleGame() {
  const { roomId } = useParams();
  const urlParams = new URLSearchParams(window.location.search);
  const isAI = urlParams.get("ai") === "true";
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // "play_active"|"play_bench"|"attach"|"attack"|"retreat"
  const [showLog, setShowLog] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!roomId) return;
    db.entities.GameRoom.filter({ id: roomId }).then((rooms) => {
      const r = rooms[0];
      if (r) { setRoom(r); setGameState(r.game_state); }
      setLoading(false);
    });
  }, [roomId]);

  // Real-time sync for multiplayer
  useEffect(() => {
    if (!roomId || isAI) return;
    const unsub = db.entities.GameRoom.subscribe((event) => {
      if (event.id === roomId && event.type === "update") {
        setRoom(event.data);
        setGameState(event.data.game_state);
      }
    });
    return unsub;
  }, [roomId, isAI]);

  const myPlayerId = user?.id;
  const isMyTurn = gameState && user && gameState.activePlayer === getPlayerNum(gameState, myPlayerId);
  const myNum = gameState ? getPlayerNum(gameState, myPlayerId) : null;
  const oppNum = myNum === 1 ? 2 : 1;
  const myState = gameState?.players?.[myNum];
  const oppState = gameState?.players?.[oppNum];

  async function saveState(newState) {
    setSaving(true);
    const updated = await db.entities.GameRoom.update(roomId, {
      game_state: newState,
      turn_number: newState.turn,
      active_player_id: newState.players[newState.activePlayer]?.id,
      status: newState.phase === "gameOver" ? "finished" : "active",
      winner_id: newState.winner || null,
    });
    setGameState(newState);
    setRoom(updated);
    setSaving(false);
    return newState;
  }

  const doAction = useCallback(async (actionFn, ...args) => {
    if (!gameState || !myPlayerId) return;
    const newState = actionFn(gameState, myPlayerId, ...args);
    await saveState(newState);
    setSelectedCard(null);
    setPendingAction(null);

    // AI turn
    if (isAI && newState.phase !== "gameOver") {
      const aiNum = myNum === 1 ? 2 : 1;
      const aiId = newState.players[aiNum]?.id;
      if (newState.activePlayer === aiNum && aiId) {
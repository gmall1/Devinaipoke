const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React from "react";
import { useQuery } from "@tanstack/react-query";

import BottomNav from "@/components/tcg/BottomNav";
import PageHeader from "@/components/tcg/PageHeader";
import { Loader2, Trophy } from "lucide-react";

const TIER_COLORS = {
  Master: "text-purple-400", Diamond: "text-blue-400", Platinum: "text-cyan-400",
  Gold: "text-yellow-400", Silver: "text-slate-300", Bronze: "text-orange-400",
};

const TIER_ICONS = {
  Master: "", Diamond: "", Platinum: "", Gold: "", Silver: "", Bronze: "",
};

export default function Leaderboard() {
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => db.entities.PlayerProfile.list("-rank_points", 50),
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 pt-8">
        <PageHeader title="LEADERBOARD" subtitle="Top ranked trainers" backLink="/" />

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground font-body">No ranked players yet. Play a ranked match!</div>
        ) : (
          <div className="space-y-2">
            {profiles.map((p, i) => (
              <div key={p.id} className={`bg-card border border-border rounded-xl p-4 flex items-center gap-4
                ${i === 0 ? "border-yellow-500/40 bg-yellow-500/5" : i === 1 ? "border-slate-400/30" : i === 2 ? "border-orange-600/30" : ""}`}>
                <div className="w-8 text-center">
                  {i < 3 ? (
                    <span className="text-xl">{["","",""][i]}</span>
                  ) : (
                    <span className="text-muted-foreground font-display text-sm font-bold">#{i + 1}</span>
                  )}
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {p.display_name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-body font-semibold text-sm">{p.display_name}</p>
                  <p className={`font-body text-xs font-bold ${TIER_COLORS[p.rank_tier]}`}>
                    {TIER_ICONS[p.rank_tier]} {p.rank_tier}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold text-sm text-accent">{p.rank_points}</p>
                  <p className="font-body text-xs text-muted-foreground">{p.wins}W · {p.losses}L</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
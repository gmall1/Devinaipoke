import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import BottomNav from "@/components/tcg/BottomNav";

export default function Home() {
  return (
    <div className="min-h-screen bg-background pb-24 overflow-hidden">
      {/* Hero Banner */}
      <div className="relative overflow-hidden min-h-[40vh] flex items-end">
        <div className="absolute inset-0 bg-gradient-to-br from-red-900 via-red-800 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,50,50,0.3),transparent_60%)]" />
        <div className="absolute top-6 right-4 text-[120px] opacity-10 select-none font-black leading-none">
          TCG
        </div>
        <div className="relative px-5 pb-8 pt-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-red-400/80 font-display text-xs font-bold tracking-widest uppercase mb-1">Pokémon</p>
            <h1 className="font-display text-4xl font-black text-white leading-tight">
              TCG<br />LIVE
            </h1>
            <p className="text-white/50 font-body text-sm mt-2">Every card. Every mode. Real rules.</p>
          </motion.div>
        </div>
      </div>

      {/* Game Modes */}
      <div className="px-5 mt-6 space-y-3">
        <p className="font-display text-xs text-muted-foreground font-bold uppercase tracking-widest">Select Mode</p>

        <ModeCard
          delay={0.1}
          link="/lobby"
          gradient="from-red-700 via-red-800 to-red-950"
          icon="⚔️"
          title="BATTLE"
          subtitle="vs AI or vs Player"
          tag="Live Match"
          tagColor="bg-red-500"
        />

        <div className="grid grid-cols-2 gap-3">
          <ModeCard
            delay={0.2}
            link="/battle?mode=unlimited&ai=true"
            gradient="from-purple-700 to-indigo-900"
            icon="♾️"
            title="UNLIMITED"
            subtitle="All cards legal"
            compact
          />
          <ModeCard
            delay={0.25}
            link="/battle?mode=standard&ai=true"
            gradient="from-blue-700 to-blue-950"
            icon="📋"
            title="STANDARD"
            subtitle="Legal sets only"
            compact
          />
        </div>
      </div>

      {/* Quick Nav */}
      <div className="px-5 mt-6 space-y-3">
        <p className="font-display text-xs text-muted-foreground font-bold uppercase tracking-widest">Collection</p>
        <div className="grid grid-cols-2 gap-3">
          <NavCard link="/decks" icon="🗂️" label="My Decks" sub="Build & manage" />
          <NavCard link="/collection" icon="📖" label="Card Dex" sub="All cards" />
        </div>
      </div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="px-5 mt-6"
      >
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="font-display text-xs text-muted-foreground font-bold uppercase tracking-widest">Engine Features</p>
          {[
            ["⚔️", "Full battle rules — prize cards, bench, active"],
            ["🃏", "Real PokémonTCG.io card database"],
            ["🏆", "Ranked mode with ELO ladder"],
            ["👥", "Multiplayer via room codes"],
            ["😵", "Special conditions: Poison, Burn, Sleep, Paralyze, Confuse"],
            ["🪙", "Coin flips for attack effects"],
            ["♾️", "Unlimited mode — zero restrictions"],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-3">
              <span className="text-base">{icon}</span>
              <span className="text-sm font-body text-foreground/75">{text}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <BottomNav />
    </div>
  );
}

function ModeCard({ link, gradient, icon, title, subtitle, tag, tagColor, compact, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Link to={link}>
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} ${compact ? "p-4 min-h-[90px]" : "p-5 min-h-[100px]"} flex flex-col justify-between group`}>
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
          {tag && <span className={`self-start text-[10px] font-display font-bold px-2 py-0.5 rounded-full text-white ${tagColor} mb-2`}>{tag}</span>}
          <div className="flex items-center gap-3">
            <span className={compact ? "text-2xl" : "text-3xl"}>{icon}</span>
            <div>
              <p className={`font-display font-black text-white ${compact ? "text-base" : "text-xl"}`}>{title}</p>
              <p className="text-white/60 text-xs font-body">{subtitle}</p>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function NavCard({ link, icon, label, sub }) {
  return (
    <Link to={link}>
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:bg-secondary transition-colors">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="font-body font-semibold text-sm">{label}</p>
          <p className="text-muted-foreground text-xs font-body">{sub}</p>
        </div>
      </div>
    </Link>
  );
}
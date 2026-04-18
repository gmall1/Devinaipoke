import React from "react";
import { motion } from "framer-motion";

export default function BenchSlot({ pokemon, isOpponent, isMyTurn, onClick, size = "sm" }) {
  if (!pokemon) return null;
  const type = pokemon.def.types?.[0];
  const typeColors = {
    Fire: "from-orange-700 to-red-800", Water: "from-blue-600 to-cyan-800",
    Grass: "from-green-600 to-emerald-800", Lightning: "from-yellow-500 to-amber-700",
    Psychic: "from-purple-600 to-pink-700", Fighting: "from-orange-800 to-red-900",
    Darkness: "from-gray-700 to-gray-900", Metal: "from-slate-500 to-slate-700",
    Dragon: "from-indigo-700 to-violet-900", Colorless: "from-gray-500 to-gray-700",
  };
  const bg = typeColors[type] || typeColors.Colorless;
  const hpPct = pokemon.def.hp ? Math.max(0, ((pokemon.def.hp - pokemon.damage) / pokemon.def.hp) * 100) : 100;
  const energyCount = pokemon.energyAttached?.length || 0;

  return (
    <motion.div
      whileHover={onClick && isMyTurn ? { scale: 1.05 } : {}}
      onClick={onClick}
      className={`w-[52px] h-[70px] rounded-lg overflow-hidden cursor-pointer bg-gradient-to-b ${bg} flex flex-col
        border ${isMyTurn && !isOpponent ? "border-primary/30 hover:border-primary" : "border-white/10"}`}
    >
      {pokemon.def.imageSmall ? (
        <img src={pokemon.def.imageSmall} alt={pokemon.def.name} className="flex-1 object-contain p-0.5" />
      ) : (
        <div className="flex-1 flex items-center justify-center text-xl opacity-70">
          {["🔥","💧","🌿","⚡","🔮","👊","🌑","🛡️","🐉","⭐"][
            ["Fire","Water","Grass","Lightning","Psychic","Fighting","Darkness","Metal","Dragon","Colorless"].indexOf(type) ?? 9
          ]}
        </div>
      )}
      <div className="h-1 bg-black/40 mx-1 mb-1 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${hpPct > 50 ? "bg-green-400" : hpPct > 20 ? "bg-yellow-400" : "bg-red-400"}`}
          style={{ width: `${hpPct}%` }} />
      </div>
      {energyCount > 0 && (
        <div className="text-center text-[9px] text-white/60 mb-0.5">{energyCount}⚡</div>
      )}
    </motion.div>
  );
}
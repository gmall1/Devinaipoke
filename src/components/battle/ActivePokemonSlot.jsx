import React from "react";
import { motion } from "framer-motion";
import { TYPE_COLORS } from "@/lib/cardData";
import { SPECIAL_CONDITIONS } from "@/lib/gameConstants";

const CONDITION_ICONS = {
  [SPECIAL_CONDITIONS.POISONED]: "🟣",
  [SPECIAL_CONDITIONS.BADLY_POISONED]: "☠️",
  [SPECIAL_CONDITIONS.BURNED]: "🔥",
  [SPECIAL_CONDITIONS.CONFUSED]: "😵",
  [SPECIAL_CONDITIONS.PARALYZED]: "⚡",
  [SPECIAL_CONDITIONS.ASLEEP]: "💤",
};

export default function ActivePokemonSlot({ pokemon, isOpponent, label, isMyTurn, actionMode, onClick }) {
  if (!pokemon) {
    return (
      <div className="w-36 h-28 rounded-2xl border-2 border-dashed border-border/50 flex items-center justify-center">
        <span className="text-muted-foreground text-xs font-body">No Active</span>
      </div>
    );
  }

  const typeInfo = getTypeInfo(pokemon.def.types?.[0]);
  const hpPct = Math.max(0, Math.min(100, ((pokemon.def.hp - pokemon.damage) / pokemon.def.hp) * 100));
  const energyCount = pokemon.energyAttached?.length || 0;

  return (
    <motion.div
      whileHover={onClick ? { scale: 1.03 } : {}}
      onClick={onClick}
      className={`w-44 rounded-2xl overflow-hidden border-2 cursor-pointer
        ${isOpponent ? "border-red-900/50" : "border-blue-900/50"}
        ${onClick && isMyTurn ? "hover:border-primary/50" : ""}
        bg-gradient-to-b from-card to-secondary`}
    >
      {/* Card Header */}
      <div className={`px-3 py-1.5 bg-gradient-to-r ${typeInfo.bg} flex items-center justify-between`}>
        <span className="text-white font-body text-xs font-bold truncate">{pokemon.def.name}</span>
        <div className="flex items-center gap-1">
          {pokemon.def.hp && <span className="text-white/80 text-[10px] font-display">{pokemon.def.hp - pokemon.damage}/{pokemon.def.hp}</span>}
          {pokemon.specialCondition && <span className="text-sm">{CONDITION_ICONS[pokemon.specialCondition]}</span>}
        </div>
      </div>

      {/* Art */}
      <div className="relative px-3 py-2">
        {pokemon.def.imageLarge || pokemon.def.imageSmall ? (
          <img src={pokemon.def.imageLarge || pokemon.def.imageSmall} alt={pokemon.def.name} className="w-full h-16 object-contain" />
        ) : (
          <div className="w-full h-16 flex items-center justify-center text-4xl opacity-60">
            {typeInfo.icon}
          </div>
        )}

        {/* HP Bar */}
        <div className="mt-1">
          <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full transition-colors ${hpPct > 50 ? "bg-green-400" : hpPct > 20 ? "bg-yellow-400" : "bg-red-400"}`}
              animate={{ width: `${hpPct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {/* Energy */}
        {energyCount > 0 && (
          <div className="flex gap-0.5 mt-1 flex-wrap">
            {pokemon.energyAttached.slice(0, 6).map((e, i) => {
              const eType = getTypeInfo(e.def?.types?.[0] || (e.def?.name?.includes("Water") ? "Water" : "Colorless"));
              return <span key={i} className="text-sm">{eType.icon}</span>;
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function getTypeInfo(type) {
  const map = {
    Fire: { bg: "from-orange-600 to-red-700", icon: "🔥" },
    Water: { bg: "from-blue-500 to-cyan-700", icon: "💧" },
    Grass: { bg: "from-green-500 to-emerald-700", icon: "🌿" },
    Lightning: { bg: "from-yellow-400 to-amber-600", icon: "⚡" },
    Psychic: { bg: "from-purple-500 to-pink-600", icon: "🔮" },
    Fighting: { bg: "from-orange-700 to-red-900", icon: "👊" },
    Darkness: { bg: "from-gray-700 to-gray-900", icon: "🌑" },
    Metal: { bg: "from-slate-400 to-slate-600", icon: "🛡️" },
    Dragon: { bg: "from-indigo-600 to-violet-800", icon: "🐉" },
    Fairy: { bg: "from-pink-400 to-rose-600", icon: "✨" },
    Colorless: { bg: "from-gray-400 to-gray-600", icon: "⭐" },
  };
  return map[type] || map.Colorless;
}
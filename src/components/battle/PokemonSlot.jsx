import React from "react";
import { motion } from "framer-motion";
import { getTypeInfo, CONDITIONS } from "@/lib/tcgdex";
import { tcgdex } from "@/lib/tcgdex";

export default function PokemonSlot({ pokemon, label, onClick, selected, size = "md" }) {
  const sizeClasses = {
    sm: "w-14 h-20",
    md: "w-20 h-28",
    lg: "w-24 h-32",
  };

  if (!pokemon) {
    return (
      <div className={`${sizeClasses[size]} rounded-xl border-2 border-dashed border-border flex items-center justify-center opacity-40`}>
        <span className="text-xs text-muted-foreground font-body">{label}</span>
      </div>
    );
  }

  const typeInfo = getTypeInfo(pokemon.card.types?.[0]);
  const hpPercent = pokemon.hp > 0 ? (pokemon.currentHp / pokemon.hp) * 100 : 0;
  const imgUrl = pokemon.card.image ? tcgdex.cardThumb(pokemon.card) : null;

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`${sizeClasses[size]} rounded-xl overflow-hidden relative cursor-pointer flex-shrink-0
        ${selected ? "ring-2 ring-accent ring-offset-1 ring-offset-background" : ""}`}
    >
      {/* Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${typeInfo.bg}`} />

      {/* Card image or icon */}
      <div className="relative h-full flex flex-col">
        {imgUrl ? (
          <img src={imgUrl} alt={pokemon.card.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex-1 flex items-center justify-center text-3xl opacity-70">{typeInfo.icon}</div>
        )}

        {/* HP bar overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-white text-[8px] font-body font-bold truncate max-w-[70%]">{pokemon.card.name}</span>
            <span className="text-white text-[8px] font-display">{pokemon.currentHp}</span>
          </div>
          <div className="h-1 bg-black/40 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${hpPercent > 50 ? "bg-green-400" : hpPercent > 20 ? "bg-yellow-400" : "bg-red-400"}`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {/* Conditions */}
        {pokemon.conditions?.length > 0 && (
          <div className="absolute top-1 left-1 flex gap-0.5 flex-wrap">
            {pokemon.conditions.map((c) => (
              <span key={c} className="text-[10px]" title={c}>{CONDITIONS[c]?.icon}</span>
            ))}
          </div>
        )}

        {/* Energy count */}
        {pokemon.energies?.length > 0 && (
          <div className="absolute top-1 right-1 bg-black/50 rounded-full w-4 h-4 flex items-center justify-center">
            <span className="text-[9px] text-yellow-400 font-bold">{pokemon.energies.length}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
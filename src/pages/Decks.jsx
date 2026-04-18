import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Plus } from "lucide-react";
import BottomNav from "@/components/tcg/BottomNav";
import PageHeader from "@/components/tcg/PageHeader";
import { Button } from "@/components/ui/button";
import db from "@/lib/localDb";

export default function Decks() {
  const { data: decks = [], isLoading } = useQuery({
    queryKey: ["decks"],
    queryFn: () => db.entities.Deck.list("-updated_date", 100),
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 pt-8">
        <PageHeader
          title="MY DECKS"
          subtitle={`${decks.length} saved locally`}
          rightAction={
            <Link to="/deck-builder">
              <Button size="sm" className="font-body gap-1">
                <Plus className="w-4 h-4" />
                New
              </Button>
            </Link>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : decks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {decks.map((deck, index) => (
              <DeckRow key={deck.id} deck={deck} index={index} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function DeckRow({ deck, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.16) }}
    >
      <Link to={`/deck-builder?id=${deck.id}`}>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:bg-secondary/50 transition-colors">
          <div className="w-12 h-16 rounded-lg bg-secondary overflow-hidden flex items-center justify-center text-2xl flex-shrink-0">
            {deck.cover_image ? (
              <img src={deck.cover_image} alt={deck.name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              deck.cover_icon || "🃏"
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-body font-semibold text-sm truncate">{deck.name}</p>
            <p className="font-body text-xs text-muted-foreground mt-0.5">
              {deck.card_count || 0}/60 cards · {deck.pokemon_count || 0} Pokémon · {deck.energy_count || 0} Energy
            </p>
            <span className="inline-block mt-1 text-[10px] font-body bg-secondary px-2 py-0.5 rounded-full capitalize">
              {deck.mode || "unlimited"}
            </span>
          </div>

          <span className="text-muted-foreground">›</span>
        </div>
      </Link>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="text-5xl mb-4">🃏</div>
      <h3 className="font-display text-lg font-bold mb-2">No Local Decks Yet</h3>
      <p className="text-muted-foreground font-body text-sm mb-6">
        Build a deck from live expansions and save it locally in your browser.
      </p>
      <Link to="/deck-builder">
        <Button className="font-body gap-2">
          <Plus className="w-4 h-4" />
          Create Deck
        </Button>
      </Link>
    </div>
  );
}

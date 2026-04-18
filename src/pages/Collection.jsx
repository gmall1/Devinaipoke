import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Layers, Loader2, Search } from "lucide-react";
import BottomNav from "@/components/tcg/BottomNav";
import PageHeader from "@/components/tcg/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchCatalogCards, fetchExpansionSetsCached, getTypeStyle } from "@/lib/cardCatalog";

const FILTERS = ["all", "pokemon", "trainer", "energy"];

export default function Collection() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedSet, setSelectedSet] = useState("");

  const { data: sets = [], isLoading: setsLoading } = useQuery({
    queryKey: ["expansion-sets"],
    queryFn: () => fetchExpansionSetsCached(),
    staleTime: 1000 * 60 * 60,
  });

  useEffect(() => {
    if (!selectedSet && sets.length > 0) {
      setSelectedSet(sets[0].id);
    }
  }, [selectedSet, sets]);

  const activeSet = useMemo(() => sets.find((set) => set.id === selectedSet) || null, [selectedSet, sets]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["catalog-cards", search, filter, selectedSet],
    queryFn: () =>
      fetchCatalogCards({
        search,
        filter,
        setId: selectedSet,
        page: 1,
        pageSize: 48,
      }),
    enabled: Boolean(selectedSet),
    staleTime: 1000 * 60 * 10,
  });

  const cards = data?.cards || [];
  const sourceLabel = data?.source === "api" ? "Live API" : "Local fallback";

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 pt-8 space-y-5">
        <PageHeader
          title="CARD DEX"
          subtitle={
            activeSet
              ? `${data?.totalCount || cards.length} cards · ${activeSet.name}`
              : "Browse live expansions and card art"
          }
        />

        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-body">Data source</p>
              <p className="font-body text-sm text-foreground/80 mt-1">
                Cards and expansions load from the live API when available, with local demo cards as fallback.
              </p>
            </div>
            <Badge variant="secondary">{sourceLabel}</Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search card names inside the selected expansion"
              className="pl-9 font-body"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`px-3 py-1.5 rounded-full text-xs font-body capitalize border transition-colors ${
                  filter === item
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-secondary"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-display text-lg font-bold">Expansions</h2>
          </div>

          {setsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {sets.map((set) => {
                const selected = set.id === selectedSet;
                return (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => setSelectedSet(set.id)}
                    className={`min-w-[220px] rounded-2xl border p-4 text-left transition-colors ${
                      selected ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-secondary/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-body font-semibold text-sm truncate">{set.name}</p>
                        <p className="text-xs text-muted-foreground font-body mt-1 truncate">
                          {set.series || "Series unavailable"}
                        </p>
                      </div>
                      {set.images?.symbol && <img src={set.images.symbol} alt={set.name} className="w-10 h-10 object-contain flex-shrink-0" />}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-body text-muted-foreground">
                      <span>{set.total || set.printedTotal || set.cardCount?.total || "—"} cards</span>
                      <span>{set.releaseDate || "Unknown date"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-body text-muted-foreground">
                {activeSet
                  ? `Showing cards from ${activeSet.name}${search.trim() ? ` matching “${search.trim()}”` : ""}.`
                  : "Select an expansion to begin browsing."}
              </p>
              {isFetching && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>

            {cards.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-8 text-center">
                <p className="font-display text-lg font-bold">No cards found</p>
                <p className="text-sm font-body text-muted-foreground mt-2">
                  Try a different search term, card type, or expansion.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map((card, index) => (
                  <CollectionCard key={card.id} card={card} index={index} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function CollectionCard({ card, index }) {
  const typeStyle = getTypeStyle(card.energy_type || "colorless");
  const imageUrl = card.image_small || card.image_large;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.2) }}
      className="rounded-2xl border border-border bg-card overflow-hidden"
    >
      <div className="aspect-[5/7] bg-black/20">
        {imageUrl ? (
          <img src={imageUrl} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${typeStyle.bg} flex items-center justify-center text-5xl`}>
            {typeStyle.icon}
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <p className="text-lg font-display font-bold leading-tight">{card.name}</p>
          <p className="text-xs text-muted-foreground font-body mt-1">
            {card.set_name || "Local Catalog"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="capitalize">{card.card_type}</Badge>
          {card.energy_type && <Badge variant="outline" className="capitalize">{card.energy_type}</Badge>}
          {card.stage && <Badge variant="outline" className="capitalize">{card.stage}</Badge>}
          {card.rarity && <Badge variant="outline">{String(card.rarity).replace(/_/g, " ")}</Badge>}
        </div>

        {card.card_type === "pokemon" ? (
          <div className="space-y-2 text-sm font-body text-foreground/80">
            <p>
              <span className="text-muted-foreground">HP:</span> {card.hp || "—"}
            </p>
            {card.attack1_name && (
              <p>
                <span className="text-muted-foreground">Attack 1:</span> {card.attack1_name} ({card.attack1_damage || 0})
              </p>
            )}
            {card.attack2_name && (
              <p>
                <span className="text-muted-foreground">Attack 2:</span> {card.attack2_name} ({card.attack2_damage || 0})
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm font-body text-muted-foreground">
            {card.description || "Card text unavailable."}
          </p>
        )}
      </div>
    </motion.div>
  );
}

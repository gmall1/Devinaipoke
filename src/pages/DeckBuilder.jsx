import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Layers, Loader2, Save, Search, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import PageHeader from "@/components/tcg/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import db from "@/lib/localDb";
import {
  buildStarterDeck,
  fetchCatalogCards,
  fetchExpansionSetsCached,
  getCardById,
  getTypeStyle,
  hydrateCardsByIds,
} from "@/lib/cardCatalog";

const FILTERS = ["all", "pokemon", "trainer", "energy"];

function countCards(cardIds = []) {
  return cardIds.reduce((accumulator, cardId) => {
    accumulator[cardId] = (accumulator[cardId] || 0) + 1;
    return accumulator;
  }, {});
}

export default function DeckBuilder() {
  const urlParams = new URLSearchParams(window.location.search);
  const deckId = urlParams.get("id");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [deckName, setDeckName] = useState("New Deck");
  const [mode, setMode] = useState("unlimited");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedSet, setSelectedSet] = useState("");
  const [deckCardIds, setDeckCardIds] = useState(() => buildStarterDeck());
  const [catalogVersion, setCatalogVersion] = useState(0);

  const { data: existingDeck, isLoading } = useQuery({
    queryKey: ["deck", deckId],
    queryFn: () => (deckId ? db.entities.Deck.get(deckId) : null),
    enabled: Boolean(deckId),
  });

  const { data: sets = [] } = useQuery({
    queryKey: ["expansion-sets"],
    queryFn: () => fetchExpansionSetsCached(),
    staleTime: 1000 * 60 * 60,
  });

  useEffect(() => {
    if (!selectedSet && sets.length > 0) {
      setSelectedSet(sets[0].id);
    }
  }, [selectedSet, sets]);

  useEffect(() => {
    if (!existingDeck) {
      return;
    }

    setDeckName(existingDeck.name || "Imported Deck");
    setMode(existingDeck.mode || "unlimited");
    setDeckCardIds(existingDeck.card_ids || []);
  }, [existingDeck]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      await hydrateCardsByIds(deckCardIds);
      if (!cancelled) {
        setCatalogVersion((value) => value + 1);
      }
    };

    hydrate().catch(() => {
      if (!cancelled) {
        setCatalogVersion((value) => value + 1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [deckCardIds]);

  const { data: cardResults, isFetching: cardsFetching } = useQuery({
    queryKey: ["deck-builder-cards", selectedSet, search, filter],
    queryFn: () =>
      fetchCatalogCards({
        search,
        filter,
        setId: selectedSet,
        page: 1,
        pageSize: 36,
      }),
    enabled: Boolean(selectedSet),
    staleTime: 1000 * 60 * 10,
  });

  const activeSet = useMemo(() => sets.find((set) => set.id === selectedSet) || null, [selectedSet, sets]);
  const deckCounts = useMemo(() => countCards(deckCardIds), [deckCardIds]);

  const selectedCards = useMemo(() => {
    return Object.entries(deckCounts)
      .map(([cardId, quantity]) => ({
        card: getCardById(cardId),
        quantity,
      }))
      .filter((entry) => entry.card)
      .sort((a, b) => a.card.name.localeCompare(b.card.name));
  }, [catalogVersion, deckCounts]);

  const stats = useMemo(() => {
    return deckCardIds.reduce(
      (summary, cardId) => {
        const card = getCardById(cardId);
        if (!card) return summary;
        if (card.card_type === "pokemon") summary.pokemon += 1;
        if (card.card_type === "trainer") summary.trainer += 1;
        if (card.card_type === "energy") summary.energy += 1;
        return summary;
      },
      { pokemon: 0, trainer: 0, energy: 0 }
    );
  }, [catalogVersion, deckCardIds]);

  const addCard = (card) => {
    const currentCount = deckCounts[card.id] || 0;
    const copyLimit = card.card_type === "energy" ? 60 : 4;

    if (deckCardIds.length >= 60) {
      toast({ title: "Deck is full", description: "A deck can contain at most 60 cards." });
      return;
    }

    if (currentCount >= copyLimit) {
      toast({ title: "Copy limit reached", description: `You can only add ${copyLimit} copies of ${card.name}.` });
      return;
    }

    setDeckCardIds((current) => [...current, card.id]);
  };

  const removeCard = (cardId) => {
    setDeckCardIds((current) => {
      const index = current.lastIndexOf(cardId);
      if (index === -1) return current;
      const next = [...current];
      next.splice(index, 1);
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!deckName.trim()) {
        throw new Error("Please enter a deck name.");
      }

      if (deckCardIds.length === 0) {
        throw new Error("Add at least one card before saving.");
      }

      const leadCard = getCardById(deckCardIds[0]);
      const payload = {
        name: deckName.trim(),
        mode,
        card_ids: deckCardIds,
        card_count: deckCardIds.length,
        pokemon_count: stats.pokemon,
        trainer_count: stats.trainer,
        energy_count: stats.energy,
        cover_icon: getTypeStyle(leadCard?.energy_type || "colorless").icon,
        cover_image: leadCard?.image_small || null,
        source: "hybrid",
      };

      return deckId ? db.entities.Deck.update(deckId, payload) : db.entities.Deck.create(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
      if (deckId) {
        await queryClient.invalidateQueries({ queryKey: ["deck", deckId] });
      }
      toast({ title: "Deck saved", description: "Your local deck list was updated successfully." });
      navigate("/decks");
    },
    onError: (error) => {
      toast({ title: "Unable to save deck", description: error.message || "Please try again." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deckId) return null;
      return db.entities.Deck.delete(deckId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
      toast({ title: "Deck deleted", description: "The selected local deck was removed." });
      navigate("/decks");
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="px-5 pt-8 space-y-5">
        <PageHeader
          title={deckId ? "EDIT DECK" : "BUILD DECK"}
          subtitle={`${deckCardIds.length}/60 cards · local save with live catalog`}
          backLink="/decks"
        />

        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-body">Deck name</label>
            <Input value={deckName} onChange={(event) => setDeckName(event.target.value)} className="font-body" />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-body">Mode</label>
            <div className="flex gap-2">
              {[
                ["unlimited", "Unlimited"],
                ["standard", "Standard"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`px-3 py-2 rounded-lg text-sm font-body border ${
                    mode === value ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <StatCard label="Pokémon" value={stats.pokemon} />
            <StatCard label="Trainer" value={stats.trainer} />
            <StatCard label="Energy" value={stats.energy} />
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-between">
            <Badge variant="secondary">{cardResults?.source === "api" ? "Live API" : "Local fallback"}</Badge>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => saveMutation.mutate()} className="gap-2 font-body" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Deck
              </Button>
              {deckId && (
                <Button
                  variant="outline"
                  onClick={() => deleteMutation.mutate()}
                  className="gap-2 font-body"
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-display text-lg font-bold">Choose an expansion</h2>
          </div>

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
                  <div className="mt-3 text-xs font-body text-muted-foreground flex items-center justify-between gap-2">
                    <span>{set.total || set.printedTotal || set.cardCount?.total || "—"} cards</span>
                    <span>{set.releaseDate || "Unknown date"}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search cards in the selected expansion"
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

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-body text-muted-foreground">
              {activeSet
                ? `Showing ${cardResults?.totalCount || 0} cards from ${activeSet.name}.`
                : "Choose a set to load cards."}
            </p>
            {cardsFetching && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[34rem] overflow-y-auto pr-1">
            {(cardResults?.cards || []).map((card, index) => (
              <AvailableCard key={card.id} card={card} index={index} inDeck={deckCounts[card.id] || 0} onAdd={addCard} />
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold">Selected Cards</h2>
            <Badge variant="outline">{selectedCards.length} unique</Badge>
          </div>

          {selectedCards.length === 0 ? (
            <div className="rounded-xl border border-border bg-background px-4 py-6 text-center text-sm font-body text-muted-foreground">
              Your deck is empty. Add cards from a live expansion or keep the starter list.
            </div>
          ) : (
            <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
              {selectedCards.map(({ card, quantity }) => (
                <SelectedCardRow key={card.id} card={card} quantity={quantity} onRemove={removeCard} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-body">{label}</p>
      <p className="font-display text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}

function AvailableCard({ card, index, inDeck, onAdd }) {
  const typeStyle = getTypeStyle(card.energy_type || "colorless");
  const imageUrl = card.image_small || card.image_large;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.01, 0.12) }}
      className="rounded-xl border border-border p-3 bg-background"
    >
      <div className="flex gap-3">
        <div className="w-20 h-28 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
          {imageUrl ? (
            <img src={imageUrl} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${typeStyle.bg} flex items-center justify-center text-3xl`}>
              {typeStyle.icon}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-body font-semibold text-sm">{card.name}</p>
              <p className="text-xs text-muted-foreground font-body mt-1">{card.set_name || "Local Catalog"}</p>
            </div>
            <Badge variant="secondary" className="capitalize">{card.card_type}</Badge>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {card.energy_type && <Badge variant="outline" className="capitalize">{card.energy_type}</Badge>}
            {card.stage && <Badge variant="outline" className="capitalize">{card.stage}</Badge>}
            {card.rarity && <Badge variant="outline">{String(card.rarity).replace(/_/g, " ")}</Badge>}
          </div>

          <p className="text-xs text-muted-foreground font-body mt-3">
            {card.card_type === "pokemon"
              ? `HP ${card.hp || "—"} · ${card.attack1_name || "No attack listed"}`
              : card.description || "Card text unavailable."}
          </p>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-body">In deck: {inDeck}</span>
            <Button size="sm" onClick={() => onAdd(card)} className="font-body">
              Add
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SelectedCardRow({ card, quantity, onRemove }) {
  const imageUrl = card.image_small || card.image_large;
  const typeStyle = getTypeStyle(card.energy_type || "colorless");

  return (
    <div className="rounded-xl border border-border bg-background p-3 flex items-center gap-3">
      <div className="w-14 h-20 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${typeStyle.bg} flex items-center justify-center text-2xl`}>
            {typeStyle.icon}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-body font-semibold text-sm truncate">{card.name}</p>
        <p className="text-xs text-muted-foreground font-body mt-1 truncate">{card.set_name || "Local Catalog"}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="secondary">x{quantity}</Badge>
          {card.card_type && <Badge variant="outline" className="capitalize">{card.card_type}</Badge>}
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={() => onRemove(card.id)} className="font-body">
        Remove
      </Button>
    </div>
  );
}

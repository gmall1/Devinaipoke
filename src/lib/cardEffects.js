// ============================================================
// POKÉMON TCG CARD EFFECT PARSER
// ------------------------------------------------------------
// Given any card's free-text (attack text, ability text,
// trainer rules), produces a structured list of categorized
// operations (`effects`) that the engine can execute and that
// the AI can evaluate.
//
// Effect categories we recognize:
//   damage | splash | bench_damage | recoil | self_damage
//   heal | full_heal
//   status_paralyze | status_asleep | status_poison |
//   status_burn | status_confuse | status_badly_poison |
//   heal_status
//   coin_flip (with per-heads / per-tails branches)
//   draw | discard_hand | opp_discard_hand
//   search_pokemon | search_basic | search_evolution |
//   search_energy | search_trainer
//   attach_energy_from_hand | attach_energy_from_discard |
//   accelerate_energy_from_deck
//   discard_self_energy | discard_opp_energy
//   switch_self | switch_opponent | gust
//   protect_next_turn | prevent_damage
//   scale_with_energy | scale_with_damage
//   bonus_vs_ex | double_damage
//
// Every effect object has a shape like:
//   { op: "damage", amount: 30, target: "defender" }
//   { op: "coin_flip", count: 1,
//     heads: [{ op: "status_paralyze", target: "defender" }],
//     tails: [], each: [] }
//
// `classifyCardDef(def)` is the main entry point.  It returns
// an enriched definition with:
//   - def.parsedAttacks        array of { ...attack, effects, tags, category }
//   - def.parsedAbilities      same shape
//   - def.parsedTrainer        { effects, tags, category } for trainers
//   - def.tags                 set of top-level tags
// ============================================================

export const EFFECT_CATEGORIES = Object.freeze({
  OFFENSE: "offense",
  BOARD_CONTROL: "board_control",
  SUPPORT: "support",
  DISRUPTION: "disruption",
  HEAL: "heal",
  ACCEL: "accel",
  SEARCH: "search",
  DRAW: "draw",
  SWITCH: "switch",
  STATUS: "status",
});

const STATUS_KEYWORDS = [
  { kw: "badly poisoned", op: "status_badly_poison" },
  { kw: "paraly", op: "status_paralyze" },
  { kw: "asleep", op: "status_asleep" },
  { kw: "poison", op: "status_poison" },
  { kw: "burn", op: "status_burn" },
  { kw: "confus", op: "status_confuse" },
];

const NUM_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function toNumber(w) {
  if (w == null) return 0;
  if (typeof w === "number") return w;
  const s = String(w).trim().toLowerCase();
  if (!s) return 0;
  if (NUM_WORDS[s] != null) return NUM_WORDS[s];
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

function cleanText(text) {
  return String(text || "")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchStatuses(text) {
  const effects = [];
  for (const { kw, op } of STATUS_KEYWORDS) {
    if (text.includes(kw)) {
      effects.push({ op, target: "defender" });
      if (op === "status_badly_poison") break;
    }
  }
  return effects;
}

// ── Damage parsing ────────────────────────────────────────
function parseDamageEffects(text) {
  const effects = [];

  const matchBase = text.match(/(?:does|this attack does)\s+(\d+)\s+damage/);
  if (matchBase) effects.push({ op: "damage", amount: parseInt(matchBase[1], 10), target: "defender" });

  const perEnergy = text.match(/(\d+)\s+more damage for each\s+\[([A-Za-z])\]\s+energy/)
    || text.match(/(\d+)\s+more damage for each\s+([a-z]+)\s+energy/);
  if (perEnergy) {
    effects.push({
      op: "scale_with_energy",
      perEnergy: parseInt(perEnergy[1], 10),
      energyType: perEnergy[2] ? perEnergy[2] : "any",
      target: "defender",
    });
  }

  const perDamageCounter = text.match(/(\d+)\s+more damage for each damage counter/);
  if (perDamageCounter) {
    effects.push({
      op: "scale_with_damage",
      perCounter: parseInt(perDamageCounter[1], 10),
      target: "defender",
    });
  }

  // Splash damage to benched opponents
  const benchDmg = text.match(/(\d+)\s+damage to\s+(\d+|each)\s+of your opponent'?s?\s+benched/);
  if (benchDmg) {
    effects.push({
      op: "bench_damage",
      amount: parseInt(benchDmg[1], 10),
      count: benchDmg[2] === "each" ? "all" : parseInt(benchDmg[2], 10),
      target: "opponentBench",
    });
  }

  const splashAll = text.match(/(\d+)\s+damage to each of your opponent'?s?\s+pok(?:e|é)mon/);
  if (splashAll) {
    effects.push({ op: "splash", amount: parseInt(splashAll[1], 10), target: "allOpponent" });
  }

  // Recoil damage
  const recoil = text.match(/(\d+)\s+damage(?:\s+counters)?\s+to\s+(?:itself|this\s+pok)/)
    || text.match(/this pok(?:e|é)mon (?:also )?does\s+(\d+)\s+damage to itself/);
  if (recoil) effects.push({ op: "recoil", amount: parseInt(recoil[1], 10) });

  return effects;
}

// ── Coin flip parsing ─────────────────────────────────────
function parseCoinFlipEffects(text) {
  if (!text.includes("flip")) return null;

  let count = 1;
  const multi = text.match(/flip\s+(\d+|a|two|three|four|five|six|seven|eight|nine|ten)\s+coins?/);
  if (multi) count = toNumber(multi[1]) || 1;
  else if (text.match(/flip\s+a\s+coin/)) count = 1;
  else return null;

  const node = { op: "coin_flip", count, heads: [], tails: [], each: [] };

  // Per-heads bonus damage
  const perHeads = text.match(/(\d+)\s+more damage for each heads|for each heads.*does\s+(\d+)/);
  if (perHeads) {
    const amt = parseInt(perHeads[1] || perHeads[2], 10);
    node.each.push({ op: "damage", amount: amt, target: "defender", when: "heads" });
  }

  // If heads -> apply status
  if (text.match(/if heads/)) {
    for (const s of matchStatuses(text)) node.heads.push(s);
    const healHeads = text.match(/if heads.*heal\s+(\d+)/);
    if (healHeads) node.heads.push({ op: "heal", amount: parseInt(healHeads[1], 10), target: "self" });
    const damageHeads = text.match(/if heads.*(\d+)\s+more damage/);
    if (damageHeads) node.heads.push({ op: "damage", amount: parseInt(damageHeads[1], 10), target: "defender" });
  }

  if (text.match(/if tails/)) {
    const failTails = text.match(/if tails.*this attack does nothing/);
    if (failTails) node.tails.push({ op: "cancel_attack" });
  }

  return node;
}

// ── Heal parsing ──────────────────────────────────────────
function parseHealEffects(text) {
  const effects = [];
  const h = text.match(/heal\s+(\d+)\s+damage\s+from\s+(this pok(?:e|é)mon|your active|each of your|one of your)/)
    || text.match(/remove\s+(\d+)\s+damage\s+counters?\s+from\s+(this pok(?:e|é)mon|your active|each of your|one of your)/);
  if (h) {
    const amount = parseInt(h[1], 10) * (text.includes("counter") ? 10 : 1);
    let target = "self";
    if (h[2].includes("each")) target = "allSelf";
    else if (h[2].includes("one of your")) target = "anySelf";
    else if (h[2].includes("active")) target = "active";
    effects.push({ op: "heal", amount, target });
  }
  if (/heal all damage/.test(text)) effects.push({ op: "full_heal", target: "self" });
  if (/remove all special conditions/.test(text) || /is no longer (?:poisoned|asleep|paralyzed|confused|burned)/.test(text)) {
    effects.push({ op: "heal_status", target: "self" });
  }
  return effects;
}

// ── Draw / discard / hand manipulation ────────────────────
function parseHandEffects(text) {
  const effects = [];
  const draw = text.match(/draw\s+(\d+|a|two|three|four|five|six|seven)\s+cards?/);
  if (draw) effects.push({ op: "draw", count: toNumber(draw[1]) || 1 });

  if (/discard your hand/.test(text)) effects.push({ op: "discard_hand", who: "self" });
  if (/your opponent discards (?:their )?hand/.test(text)) effects.push({ op: "discard_hand", who: "opponent" });

  const oppDiscardN = text.match(/your opponent discards?\s+(\d+|a|two|three)\s+cards?/);
  if (oppDiscardN) effects.push({ op: "opp_discard_hand", count: toNumber(oppDiscardN[1]) || 1 });

  if (/shuffle your hand (?:and|,)?.*into your deck/.test(text)) {
    effects.push({ op: "shuffle_hand_into_deck", who: "self" });
  }

  return effects;
}

// ── Search parsing ────────────────────────────────────────
function parseSearchEffects(text) {
  const effects = [];
  if (/search your deck for/.test(text)) {
    if (/basic pok/.test(text)) {
      const countMatch = text.match(/search your deck for (?:up to\s+)?(\d+|a|two|three)?\s*basic/);
      effects.push({
        op: "search_basic",
        count: toNumber(countMatch?.[1]) || 1,
        to: /onto your bench/.test(text) ? "bench" : /to your hand/.test(text) ? "hand" : "bench",
      });
    } else if (/evolution/.test(text)) {
      effects.push({ op: "search_evolution", count: 1, to: "hand" });
    } else if (/energy/.test(text)) {
      const countMatch = text.match(/for (?:up to\s+)?(\d+|a|two|three)?\s+(?:basic\s+)?\[?([A-Za-z]+)?\]?\s*energy/);
      effects.push({
        op: "search_energy",
        count: toNumber(countMatch?.[1]) || 1,
        energyType: countMatch?.[2] || "any",
        to: /attach/.test(text) ? "attach" : "hand",
      });
    } else if (/trainer/.test(text) || /supporter/.test(text) || /item/.test(text)) {
      effects.push({ op: "search_trainer", count: 1, to: "hand" });
    } else if (/pok/.test(text)) {
      effects.push({ op: "search_pokemon", count: 1, to: /bench/.test(text) ? "bench" : "hand" });
    }
  }
  return effects;
}

// ── Energy attach / discard parsing ───────────────────────
function parseEnergyEffects(text) {
  const effects = [];

  if (/attach\s+(?:a\s+|an\s+)?basic\s+energy\s+card\s+from your discard/.test(text)
    || /attach\s+(\d+)?\s*(?:basic\s+)?energy/.test(text) && /from your discard/.test(text)) {
    effects.push({ op: "attach_energy_from_discard", count: 1 });
  }
  if (/attach\s+(\d+|a|an)?\s*(?:basic\s+)?energy\s+(?:card\s+)?from your hand/.test(text)) {
    const m = text.match(/attach\s+(\d+|a|an)?\s*(?:basic\s+)?energy\s+(?:card\s+)?from your hand/);
    effects.push({ op: "attach_energy_from_hand", count: toNumber(m?.[1]) || 1 });
  }
  if (/discard (?:a|an|\d+)? ?(?:basic\s+)?energy from this pok/i.test(text)) {
    const m = text.match(/discard\s+(\d+|a|an|two|three)?\s*(?:basic\s+)?energy from this pok/);
    effects.push({ op: "discard_self_energy", count: toNumber(m?.[1]) || 1 });
  }
  if (/discard\s+(\d+|a|an|all)?\s*(?:basic\s+)?energy from (?:the\s+)?defending/.test(text)
    || /discard\s+(\d+|a|an|all)?\s*(?:basic\s+)?energy from your opponent/.test(text)) {
    const m = text.match(/discard\s+(\d+|a|an|all|two|three)?\s*(?:basic\s+)?energy/);
    const raw = m?.[1];
    effects.push({
      op: "discard_opp_energy",
      count: raw === "all" ? "all" : toNumber(raw) || 1,
    });
  }
  return effects;
}

// ── Switch / gust parsing ─────────────────────────────────
function parseSwitchEffects(text) {
  const effects = [];
  if (/switch this pok(?:e|é)mon with one of your benched/.test(text)
    || /switch your active/.test(text)) {
    effects.push({ op: "switch_self" });
  }
  if (/switch\s+(?:your opponent'?s?\s+)?(?:the\s+)?defending pok(?:e|é)mon with one of (?:their|your opponent'?s?) benched/.test(text)
    || /your opponent switches their active/.test(text)) {
    effects.push({ op: "switch_opponent" });
  }
  return effects;
}

// ── Protection parsing ────────────────────────────────────
function parseProtectionEffects(text) {
  const effects = [];
  if (/during your opponent's? next turn.*prevent all damage/.test(text)
    || /any damage done to this pok(?:e|é)mon by attacks is reduced/.test(text)) {
    effects.push({ op: "prevent_damage", nextTurn: true });
  }
  if (/this pok(?:e|é)mon can't attack during your next turn/.test(text)) {
    effects.push({ op: "cant_attack_next_turn" });
  }
  return effects;
}

// ── Bonus vs ex/GX parsing ────────────────────────────────
function parseBonusEffects(text) {
  const effects = [];
  const vsEx = text.match(/(\d+)\s+more damage.*(?:pok(?:e|é)mon ex|ex pok|vmax|vstar|gx)/);
  if (vsEx) effects.push({ op: "bonus_vs_ex", amount: parseInt(vsEx[1], 10) });
  return effects;
}

// ── Main text parser ──────────────────────────────────────
export function parseEffects(rawText, opts = {}) {
  const text = cleanText(rawText);
  if (!text) return [];
  const effects = [];

  effects.push(...parseDamageEffects(text));
  const flip = parseCoinFlipEffects(text);
  if (flip) {
    // If the text has status keywords but no explicit "if heads"
    // we still attach them under heads (common shorthand).
    if (flip.heads.length === 0 && /if heads/.test(text) === false) {
      for (const s of matchStatuses(text)) flip.heads.push(s);
    }
    effects.push(flip);
  } else {
    // No flip — if a status is applied, apply it unconditionally
    const statuses = matchStatuses(text);
    if (statuses.length && !/flip/.test(text)) effects.push(...statuses);
  }
  effects.push(...parseHealEffects(text));
  effects.push(...parseHandEffects(text));
  effects.push(...parseSearchEffects(text));
  effects.push(...parseEnergyEffects(text));
  effects.push(...parseSwitchEffects(text));
  effects.push(...parseProtectionEffects(text));
  effects.push(...parseBonusEffects(text));

  if (opts.isTrainer && effects.length === 0 && /draw/.test(text)) {
    effects.push({ op: "draw", count: 1 });
  }

  return effects;
}

// ── Category labels ───────────────────────────────────────
export function categorizeEffects(effects) {
  const tags = new Set();
  for (const e of effects) {
    switch (e.op) {
      case "damage":
      case "splash":
      case "bench_damage":
      case "scale_with_energy":
      case "scale_with_damage":
      case "bonus_vs_ex":
      case "recoil":
        tags.add(EFFECT_CATEGORIES.OFFENSE); break;
      case "heal":
      case "full_heal":
      case "heal_status":
        tags.add(EFFECT_CATEGORIES.HEAL); break;
      case "status_paralyze":
      case "status_asleep":
      case "status_poison":
      case "status_badly_poison":
      case "status_burn":
      case "status_confuse":
        tags.add(EFFECT_CATEGORIES.STATUS); break;
      case "draw":
      case "shuffle_hand_into_deck":
        tags.add(EFFECT_CATEGORIES.DRAW); break;
      case "discard_hand":
      case "opp_discard_hand":
      case "discard_opp_energy":
        tags.add(EFFECT_CATEGORIES.DISRUPTION); break;
      case "search_basic":
      case "search_pokemon":
      case "search_evolution":
      case "search_trainer":
      case "search_energy":
        tags.add(EFFECT_CATEGORIES.SEARCH); break;
      case "attach_energy_from_hand":
      case "attach_energy_from_discard":
      case "accelerate_energy_from_deck":
        tags.add(EFFECT_CATEGORIES.ACCEL); break;
      case "switch_self":
      case "switch_opponent":
        tags.add(EFFECT_CATEGORIES.SWITCH); break;
      case "prevent_damage":
      case "cant_attack_next_turn":
        tags.add(EFFECT_CATEGORIES.BOARD_CONTROL); break;
      default:
        tags.add(EFFECT_CATEGORIES.SUPPORT);
    }
    if (e.op === "coin_flip") {
      const inner = [...(e.heads || []), ...(e.tails || []), ...(e.each || [])];
      for (const t of categorizeEffects(inner)) tags.add(t);
    }
  }
  return [...tags];
}

// ── Heuristic scoring used by the AI ──────────────────────
// Higher score = more strategically valuable when played now.
export function scoreEffects(effects, ctx = {}) {
  const weights = {
    damage: 1, splash: 0.8, bench_damage: 1.2,
    heal: 0.8, full_heal: 2, heal_status: 0.4,
    status_paralyze: 15, status_asleep: 12, status_confuse: 8,
    status_poison: 10, status_burn: 10, status_badly_poison: 18,
    draw: 3, shuffle_hand_into_deck: 2,
    discard_hand: 6, opp_discard_hand: 9,
    search_basic: 8, search_pokemon: 10, search_evolution: 12,
    search_energy: 10, search_trainer: 6,
    attach_energy_from_hand: 12, attach_energy_from_discard: 10,
    accelerate_energy_from_deck: 15,
    discard_self_energy: -6, discard_opp_energy: 12,
    switch_self: 6, switch_opponent: 18,
    prevent_damage: 14, cant_attack_next_turn: -4,
    bonus_vs_ex: 6, recoil: -1,
    scale_with_energy: 2, scale_with_damage: 2,
  };

  let score = 0;
  for (const e of effects) {
    if (e.op === "coin_flip") {
      const inner = [...(e.heads || []), ...(e.tails || []), ...(e.each || [])];
      const expected = 0.5 * (e.count || 1);
      score += expected * scoreEffects(inner, ctx);
      continue;
    }
    const w = weights[e.op] ?? 1;
    const amount = e.amount ?? e.count ?? 1;
    score += w * (typeof amount === "number" ? amount : 1);
  }

  // Context-aware boosts
  if (ctx.defenderRemainingHp != null) {
    for (const e of effects) {
      if (e.op === "damage" && e.amount >= ctx.defenderRemainingHp) score += 40;
    }
  }
  return score;
}

// ── Normalize attack metadata and attach parsedEffects ────
export function enrichAttack(attack, baseTypes = []) {
  if (!attack || attack.__enriched) return attack;
  const damageValue = Number(attack.damageValue ?? parseInt(String(attack.damage || "0"), 10) || 0);
  const text = attack.text || attack.effect || "";
  const effects = parseEffects(text, { isAttack: true });
  // If no base damage parsed but the printed attack has a numeric value,
  // inject it as the primary damage effect so engine can execute uniformly.
  if (!effects.some(e => e.op === "damage") && damageValue > 0) {
    effects.unshift({ op: "damage", amount: damageValue, target: "defender" });
  }
  const tags = categorizeEffects(effects);
  return {
    ...attack,
    damageValue,
    cost: Array.isArray(attack.cost) ? attack.cost : [],
    text,
    effects,
    tags,
    category: tags[0] || EFFECT_CATEGORIES.OFFENSE,
    __enriched: true,
    baseTypes,
  };
}

export function enrichAbility(ability) {
  if (!ability || ability.__enriched) return ability;
  const text = ability.text || ability.effect || "";
  const effects = parseEffects(text, { isAbility: true });
  const tags = categorizeEffects(effects);
  return { ...ability, text, effects, tags, category: tags[0] || EFFECT_CATEGORIES.SUPPORT, __enriched: true };
}

export function enrichTrainer(def) {
  const text = (def.rules || []).join(" ") || def.description || def.text || "";
  const effects = parseEffects(text, { isTrainer: true });
  const tags = categorizeEffects(effects);
  return { text, effects, tags, category: tags[0] || EFFECT_CATEGORIES.SUPPORT };
}

// ── Main entry ────────────────────────────────────────────
export function classifyCardDef(def) {
  if (!def) return def;
  if (def.__classified) return def;

  const baseTypes = def.types || (def.energy_type ? [capitalize(def.energy_type)] : []);
  const parsedAttacks = (def.attacks || []).map(a => enrichAttack(a, baseTypes));
  const parsedAbilities = (def.abilities || []).map(enrichAbility);

  const parsedTrainer = def.supertype === "Trainer" || def.card_type === "trainer"
    ? enrichTrainer(def)
    : null;

  const tags = new Set();
  parsedAttacks.forEach(a => a.tags?.forEach(t => tags.add(t)));
  parsedAbilities.forEach(a => a.tags?.forEach(t => tags.add(t)));
  parsedTrainer?.tags?.forEach(t => tags.add(t));

  return {
    ...def,
    attacks: parsedAttacks,
    abilities: parsedAbilities,
    parsedTrainer,
    tags: [...tags],
    __classified: true,
  };
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

// ── Bulk-classify a catalog of raw cards ──────────────────
export function buildEffectCatalog(cards) {
  const byTag = new Map();
  const classified = cards.map(c => {
    const def = classifyCardDef(c);
    for (const t of def.tags || []) {
      if (!byTag.has(t)) byTag.set(t, []);
      byTag.get(t).push(def);
    }
    return def;
  });
  return { classified, byTag };
}

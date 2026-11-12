"use client";
import { useRef, useState } from "react";

// Recettes en un clic du formulaire de vidéo : elles remplissent la durée, les visuels, les sous-titres
// et les options d'histoire (champs du même formulaire, modifiables ensuite).
type Recipe = { id: string; label: string; hint: string; values: Record<string, string> };
const RECIPES: Recipe[] = [
  { id: "feuilleton", label: "🎬 Feuilleton animé", hint: "30 s, persos qui bougent (Gemini Omni), fin « à suivre »",
    values: { durationSec: "30", format: "dialogue", visuals: "video:omni", captionStyle: "bold", opt_rhythm: "rapide", opt_hook: "medias", opt_ending: "cliffhanger", opt_framing: "serre" } },
  { id: "budget", label: "💸 Petit budget", hint: "30 s en photos avec zoom, le moins cher",
    values: { durationSec: "30", format: "dialogue", visuals: "image", captionStyle: "bold", opt_rhythm: "dynamique", opt_ending: "cliffhanger" } },
  { id: "drame", label: "🔥 Drame 1 min", hint: "Révélation dès la 1re seconde, retournement, fin à suivre",
    values: { durationSec: "60", format: "dialogue", opt_genre: "drame", opt_hook: "revelation", opt_ending: "cliffhanger", opt_rhythm: "dynamique", opt_register: "theatral" } },
  { id: "comedie", label: "😂 Comédie courte", hint: "30 s, répliques qui claquent, chute drôle",
    values: { durationSec: "30", format: "dialogue", opt_genre: "comedie", opt_hook: "phrase", opt_ending: "chute", opt_rhythm: "rapide" } },
];

export default function QuickRecipes() {
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState<string | null>(null);
  function apply(r: Recipe) {
    const form = box.current?.closest("form");
    if (!form) return;
    for (const [name, value] of Object.entries(r.values)) {
      const el = form.elements.namedItem(name);
      if (el instanceof HTMLSelectElement) {
        // Valeur absente ou désactivée (clé manquante) : on garde le choix actuel.
        const opt = [...el.options].find((o) => o.value === value);
        if (opt && !opt.disabled) { el.value = value; el.dispatchEvent(new Event("change", { bubbles: true })); }
      } else if (el instanceof HTMLInputElement) {
        // Champ contrôlé par React (durée) : on passe par le setter natif puis l'événement « input ».
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    setOn(r.id);
  }
  return (
    <div ref={box} style={{ marginTop: 14 }}>
      <label>Recette rapide <span className="xs muted">(facultatif : remplit les réglages pour toi)</span></label>
      <div className="chips">
        {RECIPES.map((r) => <button key={r.id} type="button" title={r.hint} className={`chip ${on === r.id ? "on" : ""}`} onClick={() => apply(r)}>{r.label}</button>)}
      </div>
      {on && <p className="xs sec" style={{ marginTop: 6 }}>✓ {RECIPES.find((r) => r.id === on)!.hint}. Tu peux tout changer dans « Réglages techniques » et « Plus d'options ».</p>}
    </div>
  );
}

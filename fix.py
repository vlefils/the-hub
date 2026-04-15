import os

original_css = """/* Proportion-first recomposition: stable A4 page grid. */
.character-sheet-paper {
  display: grid;
  grid-template-rows: minmax(0, 18fr) minmax(0, 82fr);
  gap: 0.24rem;
  aspect-ratio: 210 / 297;
  padding: 0.48rem;
}

.character-sheet-top {
  display: grid;
  grid-template-rows: minmax(0, 52fr) minmax(0, 48fr);
  gap: 0.14rem;
  min-height: 0;
}

.character-sheet-head {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.1rem;
  margin: 0;
  min-height: 0;
}

.character-sheet-brand {
  gap: 0.22rem 0.4rem;
  padding-bottom: 0.08rem;
}

.character-sheet-caption {
  font-size: 0.62rem;
}

.character-sheet-identity {
  display: grid;
  grid-template-columns: repeat(100, minmax(0, 1fr));
  grid-template-rows: minmax(0, 30fr) minmax(0, 22fr);
  gap: 0.08rem 0.14rem;
  min-height: 0;
  align-items: stretch;
}

.character-sheet-identity > .sheet-field {
  min-height: 0;
  gap: 0.05rem;
}

.character-sheet-identity > .sheet-field-name {
  grid-column: 1 / 39;
  grid-row: 1;
}

.character-sheet-identity > .sheet-field-class {
  grid-column: 39 / 72;
  grid-row: 1;
}

.character-sheet-identity > .sheet-field-origin {
  grid-column: 72 / 91;
  grid-row: 1;
}

.character-sheet-identity > .sheet-field-level {
  grid-column: 91 / 101;
  grid-row: 1;
}

.character-sheet-identity > .sheet-field-player {
  grid-column: 1 / 23;
  grid-row: 2;
}

.character-sheet-identity > .sheet-field-concept {
  grid-column: 23 / 101;
  grid-row: 2;
}

.character-sheet-identity .sheet-input,
.character-sheet-identity .sheet-select {
  min-height: 1.08rem;
  padding: 0.08rem 0.2rem;
  font-size: 0.72rem;
}

.character-sheet-summary {
  display: grid;
  grid-template-columns: minmax(0, 44fr) minmax(0, 34fr) minmax(0, 22fr);
  grid-template-areas: "defense vitality survival";
  gap: 0.16rem;
  margin: 0;
  padding: 0.16rem 0.18rem 0.18rem;
  min-height: 0;
  align-items: stretch;
}

.sheet-summary-group {
  min-height: 0;
  padding: 0.12rem 0.14rem 0.14rem;
  border-radius: 9px;
}

.sheet-summary-group-head {
  padding-bottom: 0.05rem;
}

.sheet-summary-group-title {
  font-size: 0.48rem;
}

.sheet-summary-bonus output {
  min-width: 1.28rem;
  font-size: 0.72rem;
  line-height: 1.34;
}

.sheet-summary-group-body-defense {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  gap: 0.14rem;
}

.sheet-summary-group-body-survival {
  grid-template-columns: 1fr;
  grid-template-rows: minmax(0, 0.42fr) minmax(0, 0.58fr);
  gap: 0.12rem;
}

.sheet-summary-card {
  min-height: 0;
}

.sheet-summary-card-primary .sheet-summary-value {
  min-height: 1.72rem;
  font-size: 1.2rem;
}

.sheet-summary-card-speed .sheet-input,
.sheet-summary-card-passive .sheet-summary-value {
  min-height: 1.32rem;
  font-size: 0.9rem;
}

.sheet-summary-card-passive .sheet-summary-value {
  display: flex;
  align-items: center;
  justify-content: center;
}

.sheet-summary-card-hero {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.14rem;
  height: 100%;
}

.sheet-summary-card-hero .sheet-inline-split {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.12rem;
  min-height: 0;
}

.sheet-summary-card-hero .sheet-inline-split label {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.06rem;
  min-height: 0;
}

.sheet-summary-card-hero .sheet-input {
  min-height: 1.42rem;
  height: 100%;
  font-size: 0.86rem;
}

.sheet-summary-card-hitdice .sheet-input {
  min-height: 1.18rem;
}

.sheet-summary-card-death .sheet-death-grid {
  gap: 0.06rem;
}

.sheet-summary-card-death .sheet-death-track {
  gap: 0.1rem;
}

.character-sheet-layout {
  display: grid;
  grid-template-columns: minmax(0, 34fr) minmax(0, 66fr);
  grid-template-rows: minmax(0, 16fr) minmax(0, 28fr) minmax(0, 38fr);
  grid-template-areas:
    "abilities abilities"
    "combat skills"
    "story story";
  gap: 0.24rem;
  min-height: 0;
  height: 100%;
}

.sheet-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  padding: 0.26rem;
}

.sheet-panel-head {
  margin-bottom: 0.12rem;
  padding-bottom: 0.08rem;
  gap: 0.14rem;
}

.sheet-panel-title {
  font-size: 0.84rem;
}

.sheet-panel-abilities,
.sheet-panel-combat,
.sheet-panel-skills,
.sheet-panel-story {
  height: 100%;
}

.sheet-abilities-grid {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.22rem;
  height: 100%;
}

.sheet-ability-card {
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "top mod"
    "score score"
    "save mastery";
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 0.18rem 0.14rem;
  align-content: stretch;
  height: 100%;
  padding: 0.34rem 0.28rem 0.28rem;
}

.sheet-ability-top {
  grid-area: top;
  grid-template-columns: 1fr;
  align-items: start;
  gap: 0.05rem;
}

.sheet-ability-mod {
  grid-area: mod;
  align-self: start;
  min-width: 2.24rem;
  min-height: 1.86rem;
  font-size: 1.26rem;
}

.sheet-ability-card .sheet-field {
  grid-area: score;
  gap: 0.08rem;
}

.sheet-ability-card .sheet-field .sheet-input {
  min-height: 1.2rem;
  font-size: 0.72rem;
}

.sheet-ability-card .sheet-check-row {
  grid-area: mastery;
  align-self: end;
  min-height: 1.12rem;
  padding: 0 0.24rem;
  border-color: #d7cab7;
  background: rgba(255, 255, 255, 0.18);
}

.sheet-ability-save {
  grid-area: save;
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  justify-content: space-between;
  min-height: 1.12rem;
  padding-top: 0.08rem;
}

.sheet-ability-save output {
  min-height: 1.14rem;
}

.sheet-combat-layout {
  display: grid;
  grid-template-rows: minmax(0, 26fr) minmax(0, 56fr) minmax(0, 18fr);
  gap: 0.14rem;
  height: 100%;
  min-height: 0;
}

.sheet-combat-subsection {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.1rem;
  min-height: 0;
}

.sheet-defense-grid {
  grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.7fr) minmax(0, 0.68fr) minmax(0, 0.72fr);
  gap: 0.12rem;
  min-height: 0;
}

.sheet-attacks {
  gap: 0.1rem;
  min-height: 0;
}

.sheet-attack-head,
.sheet-attack-row {
  grid-template-columns: 0.96fr 0.42fr 0.54fr 1.48fr;
  gap: 0.1rem;
}

.sheet-attack-row .sheet-input {
  min-height: 1.2rem;
  padding-block: 0.1rem;
}

.sheet-combat-supplies {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  min-height: 0;
}

.sheet-combat-supplies .sheet-textarea-compact {
  min-height: 0;
  height: 100%;
}

.sheet-panel-head-split {
  align-items: end;
}

.sheet-skills-legend {
  gap: 0.22rem;
  font-size: 0.43rem;
}

.sheet-skills-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.08rem 0.28rem;
  align-content: start;
}

.sheet-skill-row {
  grid-template-columns: 1.36rem minmax(0, 1fr) 0.5rem 0.5rem;
  gap: 0.1rem;
  padding: 0.12rem 0.01rem;
}

.sheet-skill-meta {
  grid-template-columns: minmax(0, 1fr) 0.7rem;
  gap: 0.1rem;
}

.sheet-skill-name {
  font-size: 0.71rem;
  line-height: 1.18;
}

.sheet-skill-check input {
  width: 0.58rem;
  height: 0.58rem;
}

.sheet-story-grid {
  display: grid;
  grid-template-columns: minmax(0, 26fr) minmax(0, 44fr) minmax(0, 30fr);
  grid-template-rows: minmax(0, 78fr) minmax(0, 22fr);
  grid-template-areas:
    "gear details notes"
    "implants implants implants";
  gap: 0.18rem 0.22rem;
  height: 100%;
  min-height: 0;
}

.sheet-story-column {
  display: flex;
  min-height: 0;
}

.sheet-story-column-gear {
  grid-area: gear;
}

.sheet-story-column-details {
  grid-area: details;
}

.sheet-story-column-notes {
  grid-area: notes;
}

.sheet-story-column .sheet-field-block {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 0.08rem;
  min-height: 0;
}

.sheet-story-column .sheet-textarea {
  min-height: 0;
  height: 100%;
  flex: 1 1 auto;
  font-size: 0.71rem;
  line-height: 1.2;
}

.sheet-story-band {
  grid-area: implants;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.08rem;
  min-height: 0;
  padding-top: 0.12rem;
  border-top: 1px solid #ddcfbc;
}

.sheet-implants-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.12rem;
  min-height: 0;
}

.sheet-implants-grid .sheet-field {
  gap: 0.06rem;
}

.sheet-implants-grid .sheet-input {
  min-height: 1.28rem;
  font-size: 0.72rem;
}

@media print {
  .character-sheet-paper {
    padding: 4.6mm;
    gap: 1.8mm;
  }

  .character-sheet-top,
  .character-sheet-layout {
    gap: 1.8mm;
  }

  .character-sheet-summary,
  .sheet-summary-group,
  .sheet-panel,
  .sheet-ability-card {
    background: #ffffff;
  }
}

@media screen and (max-width: 1160px) {
  .character-sheet-paper {
    aspect-ratio: auto;
  }

  .character-sheet-identity {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    grid-template-rows: auto auto auto;
  }

  .character-sheet-identity > .sheet-field-name,
  .character-sheet-identity > .sheet-field-class,
  .character-sheet-identity > .sheet-field-origin,
  .character-sheet-identity > .sheet-field-level,
  .character-sheet-identity > .sheet-field-player,
  .character-sheet-identity > .sheet-field-concept {
    grid-column: auto;
    grid-row: auto;
  }

  .character-sheet-identity > .sheet-field-name {
    grid-column: 1 / 4;
  }

  .character-sheet-identity > .sheet-field-class {
    grid-column: 4 / 7;
  }

  .character-sheet-identity > .sheet-field-origin {
    grid-column: 1 / 5;
  }

  .character-sheet-identity > .sheet-field-level {
    grid-column: 5 / 7;
  }

  .character-sheet-identity > .sheet-field-player {
    grid-column: 1 / 3;
  }

  .character-sheet-identity > .sheet-field-concept {
    grid-column: 3 / 7;
  }

  .character-sheet-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      "defense vitality"
      "survival survival";
  }

  .character-sheet-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto auto;
    grid-template-areas:
      "abilities"
      "combat"
      "skills"
      "story";
    height: auto;
  }

  .sheet-abilities-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    height: auto;
  }

  .sheet-story-grid {
    grid-template-columns: minmax(0, 26fr) minmax(0, 74fr);
    grid-template-rows: auto auto;
    grid-template-areas:
      "gear details"
      "notes notes"
      "implants implants";
    height: auto;
  }

  .sheet-implants-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media screen and (max-width: 900px) {
  .character-sheet-top {
    grid-template-rows: auto auto;
  }

  .character-sheet-summary {
    grid-template-columns: 1fr;
    grid-template-areas: none;
  }

  .character-sheet-summary > .sheet-summary-group {
    grid-area: auto !important;
  }

  .sheet-abilities-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .character-sheet-layout {
    grid-template-rows: auto auto auto auto;
  }

  .sheet-skills-grid {
    grid-template-columns: 1fr;
  }

  .sheet-story-grid,
  .sheet-defense-grid {
    grid-template-columns: 1fr;
    grid-template-areas: none;
  }

  .sheet-story-column-gear,
  .sheet-story-column-details,
  .sheet-story-column-notes,
  .sheet-story-band {
    grid-area: auto;
  }
}

@media screen and (max-width: 680px) {
  .character-sheet-paper {
    padding: 0.4rem;
  }

  .character-sheet-identity,
  .sheet-abilities-grid {
    grid-template-columns: 1fr;
  }

  .character-sheet-identity > .sheet-field-name,
  .character-sheet-identity > .sheet-field-class,
  .character-sheet-identity > .sheet-field-origin,
  .character-sheet-identity > .sheet-field-level,
  .character-sheet-identity > .sheet-field-player,
  .character-sheet-identity > .sheet-field-concept {
    grid-column: auto;
  }

  .sheet-summary-group-body-defense,
  .sheet-summary-group-body-survival,
  .sheet-summary-card-hero .sheet-inline-split,
  .sheet-implants-grid {
    grid-template-columns: 1fr;
  }

  .sheet-panel-head-split {
    align-items: flex-start;
  }

  .sheet-ability-card {
    grid-template-columns: 1fr;
    grid-template-areas:
      "top"
      "mod"
      "score"
      "mastery"
      "save";
  }

  .sheet-attack-head {
    display: none;
  }

  .sheet-attack-row {
    grid-template-columns: 1fr 1fr;
  }
}
"""

with open(r"c:\Users\valentin\antigravity\the-hub\styles.css", "r", encoding="utf-8") as f:
    content = f.read()

start_marker = "/* Proportion-first recomposition: stable A4 page grid. */"
target_idx = content.find(start_marker)

if target_idx != -1:
    content = content[:target_idx]

with open(r"c:\Users\valentin\antigravity\the-hub\styles.css", "w", encoding="utf-8") as f:
    f.write(content + original_css + "\n")

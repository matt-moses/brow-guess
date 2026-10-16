/** A playable word deck (PRD FR-2). */
export interface Deck {
  id: string;
  title: string;
  emoji: string;
  description: string;
  /** Background colour as `#rrggbb`; must stay legible under white text. */
  color: string;
  words: string[];
}

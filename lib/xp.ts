/** XP por nível (o mesmo de v_user_xp). */
export const XP_PER_LEVEL = 800;

/** Nível a partir do XP total: 0–799 é o nível 1. */
export function levelFromXp(xp: number) {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

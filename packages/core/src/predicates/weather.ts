import type { Weather } from "./ast.js";

export const WEATHER_ABILITIES: Record<Weather, string[]> = {
  sun: ["drought", "orichalcumpulse", "desolateland"],
  rain: ["drizzle", "primordialsea"],
  sand: ["sandstream"],
  snow: ["snowwarning"],
};

export const WEATHER_MOVES: Record<Weather, string[]> = {
  sun: ["sunnyday"],
  rain: ["raindance"],
  sand: ["sandstorm"],
  snow: ["snowscape", "hail", "chillyreception"],
};

const WEATHERS: Weather[] = ["sun", "rain", "sand", "snow"];

export function weatherSetterAbilities(w?: Weather): string[] {
  return w ? WEATHER_ABILITIES[w] : WEATHERS.flatMap((x) => WEATHER_ABILITIES[x]);
}

export function weatherSetterMoves(w?: Weather): string[] {
  return w ? WEATHER_MOVES[w] : WEATHERS.flatMap((x) => WEATHER_MOVES[x]);
}

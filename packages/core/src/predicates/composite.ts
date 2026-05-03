import type { Predicate, Weather, WeatherSetterVia } from "./ast.js";

export function partnerSpreadImmuneTo(): Predicate {
  return { kind: "partnerSpreadImmuneTo" };
}

export function isWeatherSetter(weather?: Weather, via?: WeatherSetterVia): Predicate {
  if (weather !== undefined && via !== undefined) return { kind: "isWeatherSetter", weather, via };
  if (weather !== undefined) return { kind: "isWeatherSetter", weather };
  if (via !== undefined) return { kind: "isWeatherSetter", via };
  return { kind: "isWeatherSetter" };
}

export function redirectionUser(): Predicate {
  return { kind: "redirectionUser" };
}

export function speedControlUser(): Predicate {
  return { kind: "speedControlUser" };
}

export function fakeOutImmune(): Predicate {
  return { kind: "fakeOutImmune" };
}

export function intimidateImmune(): Predicate {
  return { kind: "intimidateImmune" };
}

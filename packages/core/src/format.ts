export interface FormatMechanics {
  terastallization: boolean;
  megaEvolution: boolean;
  dynamax: boolean;
  zMoves: boolean;
}

export interface Format {
  id: string;
  name: string;
  generation: number;
  mechanics: FormatMechanics;
  speciesAllowlist: Set<string> | null;
  speciesBanlist: Set<string>;
  restrictedSpecies: Set<string>;
  maxRestricted: number;
  itemBanlist: Set<string>;
  moveBanlist: Set<string>;
  abilityBanlist: Set<string>;
  megaStoneAllowlist: Set<string> | null;
}

const VGC_RESTRICTED = new Set([
  "mewtwo", "lugia", "hooh", "kyogre", "groudon", "rayquaza",
  "dialga", "palkia", "giratina", "reshiram", "zekrom", "kyurem",
  "xerneas", "yveltal", "zygarde", "cosmog", "cosmoem", "solgaleo",
  "lunala", "necrozma", "zacian", "zamazenta", "eternatus", "calyrex",
  "koraidon", "miraidon",
]);

export const REG_M_A: Format = {
  id: "vgc-2026-reg-m-a",
  name: "VGC 2026 Regulation Set M-A",
  generation: 9,
  mechanics: {
    terastallization: false,
    megaEvolution: true,
    dynamax: false,
    zMoves: false,
  },
  speciesAllowlist: null,
  speciesBanlist: new Set(["articuno", "articunogalar"]),
  restrictedSpecies: VGC_RESTRICTED,
  maxRestricted: 0,
  itemBanlist: new Set(),
  moveBanlist: new Set(),
  abilityBanlist: new Set(),
  megaStoneAllowlist: null,
};

export const REG_I: Format = {
  id: "vgc-2026-reg-i",
  name: "VGC 2026 Regulation Set I",
  generation: 9,
  mechanics: {
    terastallization: true,
    megaEvolution: false,
    dynamax: false,
    zMoves: false,
  },
  speciesAllowlist: null,
  speciesBanlist: new Set(["mythicalonly"]),
  restrictedSpecies: VGC_RESTRICTED,
  maxRestricted: 2,
  itemBanlist: new Set(),
  moveBanlist: new Set(),
  abilityBanlist: new Set(),
  megaStoneAllowlist: null,
};

export const FORMATS: Record<string, Format> = {
  [REG_M_A.id]: REG_M_A,
  [REG_I.id]: REG_I,
};

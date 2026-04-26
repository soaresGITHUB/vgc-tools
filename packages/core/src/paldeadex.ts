// Base Paldea Pokédex national dex numbers.
// Source: Serebii — Scarlet/Violet base game only, no DLC (Kitakami / Indigo Disk).
// Includes:
//   - Pre-gen9 Pokémon returning in the base game
//   - All gen9 species (906–1004)
//   - Koraidon (#1007) and Miraidon (#1008) — base-game box legendaries
// Paldean regional forms are matched by ID (contains "paldea") rather than num,
// because they share their num with the Kantonian / original form.

const PRE_GEN9: readonly number[] = [
  25, 26, 39, 40, 50, 51, 52, 53, 54, 55,
  56, 57, 58, 59, 79, 80, 81, 82, 88, 89,
  90, 91, 92, 93, 94, 96, 97, 100, 101, 113,
  123, 129, 130, 132, 133, 134, 135, 136,
  147, 148, 149, 172, 174, 179, 180, 181,
  183, 184, 185, 187, 188, 189, 191, 192,
  196, 197, 198, 199, 200, 203, 204, 205,
  206, 211, 212, 214, 215, 216, 217, 225,
  228, 229, 231, 232, 234, 242, 246, 247, 248,
  278, 279, 280, 281, 282, 283, 284, 285, 286,
  287, 288, 289, 296, 297, 298, 302, 307, 308,
  316, 317, 322, 323, 324, 325, 326, 331, 332,
  333, 334, 335, 336, 339, 340, 353, 354, 357,
  361, 362, 370, 371, 372, 373, 396, 397, 398,
  401, 402, 403, 404, 405, 415, 416, 417, 418,
  419, 422, 423, 425, 426, 429, 430, 434, 435,
  436, 437, 438, 440, 442, 443, 444, 445, 447,
  448, 449, 450, 451, 453, 454, 456, 457, 459,
  460, 461, 462, 470, 471, 475, 478, 479,
  548, 549, 550, 551, 552, 553, 570, 571, 574,
  575, 576, 585, 586, 590, 591, 592, 594, 602,
  603, 604, 610, 611, 612, 613, 614, 615, 624,
  625, 627, 628, 633, 634, 635, 636, 637, 661,
  662, 663, 664, 665, 666, 667, 668, 669, 670,
  671, 672, 673, 690, 691, 692, 693, 701, 702,
  704, 705, 706, 707, 712, 713, 714, 715, 739,
  740, 741, 744, 745, 747, 748, 749, 750, 753,
  754, 757, 758, 761, 762, 763, 765, 766, 769,
  770, 775, 778, 779, 821, 822, 823, 833, 834,
  837, 838, 839, 840, 841, 842, 843, 844, 846,
  847, 848, 849, 854, 855, 856, 857, 858, 859,
  860, 861, 870, 871, 872, 873, 874, 875, 876,
  878, 879, 885, 886, 887,
];

export const PALDEA_BASE_DEX_NUMS: ReadonlySet<number> = new Set([
  ...PRE_GEN9,
  // Gen9 native (906–1004)
  ...Array.from({ length: 99 }, (_, i) => 906 + i),
  // Box legendaries above 1004 that are in the base game
  1007, 1008,
]);

/**
 * Returns true if a species belongs to the base Paldea Pokédex
 * (Scarlet/Violet without DLC).
 *
 * @param id   - @pkmn/data species ID (lowercase, no spaces)
 * @param num  - National Pokédex number
 */
export function isInPaldeaBaseDex(id: string, num: number): boolean {
  if (id.includes("paldea")) return true;
  return PALDEA_BASE_DEX_NUMS.has(num);
}

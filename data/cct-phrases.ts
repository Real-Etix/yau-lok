// 茶餐廳 — ordering, adjusting, paying.
//
// Same shape as taxi-phrases.ts. These are spoken live, because a waiter is
// standing at the table and there is no time for a menu.

export type CctPhrase = {
  id: string;
  cantonese: string;
  jyutping: string;
  english: string;
  group: "order" | "tweak" | "pay";
};

export const CCT_PHRASES: CctPhrase[] = [
  {
    id: "order-please",
    cantonese: "唔該，落單！",
    jyutping: "m4 goi1, lok6 daan1!",
    english: "Ready to order, please.",
    group: "order",
  },
  {
    id: "same-as-that",
    cantonese: "唔該，同佢一樣。",
    jyutping: "m4 goi1, tung4 keoi5 jat1 joeng6.",
    english: "The same as theirs, please.",
    group: "order",
  },
  {
    id: "no-ice",
    cantonese: "唔該，走冰。",
    jyutping: "m4 goi1, zau2 bing1.",
    english: "No ice, please.",
    group: "tweak",
  },
  {
    id: "less-sweet",
    cantonese: "唔該，少甜。",
    jyutping: "m4 goi1, siu2 tim4.",
    english: "Less sugar, please.",
    group: "tweak",
  },
  {
    id: "takeaway",
    cantonese: "唔該，行街。",
    jyutping: "m4 goi1, haang4 gaai1.",
    english: "To take away, please.",
    group: "tweak",
  },
  {
    id: "bill-please",
    cantonese: "唔該，埋單！",
    jyutping: "m4 goi1, maai4 daan1!",
    english: "The bill, please.",
    group: "pay",
  },
  {
    id: "receipt",
    cantonese: "唔該，要張單。",
    jyutping: "m4 goi1, jiu3 zoeng1 daan1.",
    english: "A receipt, please.",
    group: "pay",
  },
  {
    id: "split",
    cantonese: "唔該，分開俾。",
    jyutping: "m4 goi1, fan1 hoi1 bei2.",
    english: "Separate bills, please.",
    group: "pay",
  },
];

/**
 * The shorthand a waiter writes on the chit and shouts at the kitchen. The
 * drink codes are homophones — 九 for 奶, 零 for 檸 — which is exactly why a
 * newcomer cannot decode their own order without being told.
 *
 * `meaning` and `note` are catalogue keys, not text: the explanations are
 * Chinese on the design and have to be translatable.
 *
 * Source: Kong Tea, 《茶餐廳術語》
 * https://kongtea.ca/zh-hant/blogs/news/cha-chaan-teng-slangs
 */
export type CctCode = { code: string; key: string };

export const CCT_CODES: CctCode[] = [
  { code: "9T", key: "cct.code.9t" },
  { code: "0T", key: "cct.code.0t" },
  { code: "果T", key: "cct.code.gwot" },
  { code: "妹T", key: "cct.code.muit" },
];

export type CctSlang = { id: string; term: string; spoken: string };

export const CCT_SLANG: CctSlang[] = [
  { id: "caa-zau", term: "茶走", spoken: "唔該，茶走。" },
  { id: "fei-saa", term: "飛沙走奶", spoken: "唔該，飛沙走奶。" },
  { id: "leng-zai", term: "靚仔 / 靚女", spoken: "唔該，一碗靚仔。" },
  { id: "wo-soeng", term: "和尚跳海", spoken: "唔該，和尚跳海。" },
  { id: "baai-gaa-zai", term: "敗家仔", spoken: "唔該，一杯敗家仔。" },
  { id: "dung-daai-go", term: "凍大個仔 / 凍大個女", spoken: "唔該，凍大個女。" },
  { id: "sai-jung", term: "細蓉", spoken: "唔該，一碗細蓉。" },
  { id: "lou-ding", term: "撈丁", spoken: "唔該，一個撈丁。" },
  { id: "naai-jau-zyu", term: "奶油豬", spoken: "唔該，一個奶油豬。" },
  { id: "haang-gaai", term: "行街", spoken: "唔該，行街。" },
];

/**
 * What you can change about a dish, in the words a waiter uses.
 *
 * `chit` is what gets written on the paper and is **never translated** — the
 * kitchen reads 走冰, not "no ice". The gloss beside it in the UI comes from
 * `cct.tweak.<id>` and is translated like everything else.
 *
 * `surchargeHkd` exists only where the shop's own board states one; it is
 * never inferred. `group` decides which section of 特別要求 a chip sits in.
 */
export type CctTweak = {
  id: string;
  chit: string;
  group: "drink" | "set" | "extra";
  surchargeHkd?: number;
  /** Free-text: the user writes the chit string themselves */
  custom?: boolean;
};

export const CCT_TWEAK_LIST: CctTweak[] = [
  // 飲品 — what a drink order can change
  { id: "zau-bing", chit: "走冰", group: "drink" },
  { id: "siu-bing", chit: "少冰", group: "drink" },
  { id: "zau-tim", chit: "走甜", group: "drink" },
  { id: "siu-tim", chit: "少甜", group: "drink" },
  { id: "do-ning", chit: "多檸", group: "drink" },
  { id: "caa-zau", chit: "茶走", group: "drink" },
  { id: "fe-zau", chit: "啡走", group: "drink" },
  { id: "joeng-zau", chit: "鴦走", group: "drink" },
  { id: "fei-saa", chit: "飛沙走奶", group: "drink" },
  { id: "zau-naai", chit: "走奶", group: "drink" },

  // 跟餐 — rice, noodles and the plate itself
  { id: "gaa-dai", chit: "加底", group: "set" },
  { id: "kau-dai", chit: "扣底", group: "set" },
  { id: "caau-dai", chit: "炒底", group: "set" },
  { id: "zau-ceng", chit: "走青", group: "set" },
  { id: "zau-goeng-cung", chit: "走薑蔥", group: "set" },
  { id: "leng-zai", chit: "靚仔", group: "set" },
  { id: "haang-gaai", chit: "行街", group: "set" },

  // 仲有 — bread, eggs and the rest
  { id: "hung-dai", chit: "烘底", group: "extra" },
  { id: "fei-bin", chit: "飛邊", group: "extra" },
  { id: "taai-joeng-daan", chit: "太陽蛋", group: "extra" },
  { id: "caau-daan", chit: "炒蛋", group: "extra" },
  { id: "gaa-daan", chit: "加蛋", group: "extra", surchargeHkd: 6 },
  { id: "zau-laat", chit: "走辣", group: "extra" },
  { id: "zau-cing-gwaa", chit: "走青瓜", group: "extra" },
  { id: "custom", chit: "", group: "extra", custom: true },
];

/** The ids, kept for the existing 落單 chip row on app/cct. */
export const CCT_TWEAKS = CCT_TWEAK_LIST.filter(
  (t) => t.id !== "custom" && t.id !== "leng-zai",
).map((t) => t.id);

export function cctTweak(id: string): CctTweak | undefined {
  return CCT_TWEAK_LIST.find((t) => t.id === id);
}

/** The house rules a first-timer gets wrong. */
export const CCT_RULES = ["pay-at-till", "no-tip", "leave-when-busy"] as const;

export type CctItem = {
  id: string;
  /** Melamine token: the character or drink code on the plate */
  token: string;
  tone: "yellow" | "mint" | "code";
  price: number;
  kind: "food" | "drink";
  /** Written on the chit in the waiter's own shorthand */
  chit: string;
  /** Shown on the 水牌 price strips of the 入座 screen */
  wallBoard?: boolean;
};

/**
 * A standard 茶餐廳 board, for the 手動揀 path when a photo cannot be read.
 *
 * The dishes and drinks are the ones that actually appear on nearly every
 * board in Hong Kong. **The prices are indicative, not any shop's** — a real
 * price only ever comes off a photo (see `recogniseMenu`) or from the user.
 * `wallBoard` marks the handful shown on the 水牌 strips of screen 01.
 */
export const CCT_MENU: CctItem[] = [
  // 常餐 / 碟頭飯 / 麵
  { id: "set-meal", token: "餐", tone: "yellow", price: 48, kind: "food", chit: "常餐" },
  { id: "instant-noodle", token: "麵", tone: "yellow", price: 42, kind: "food", chit: "餐蛋麵" },
  { id: "ham-macaroni", token: "通", tone: "yellow", price: 38, kind: "food", chit: "腿通" },
  { id: "satay-beef-noodle", token: "沙", tone: "yellow", price: 46, kind: "food", chit: "沙嗲牛麵" },
  { id: "lo-ding", token: "撈", tone: "yellow", price: 44, kind: "food", chit: "撈丁" },
  { id: "baked-pork-rice", token: "焗", tone: "yellow", price: 62, kind: "food", chit: "焗豬扒飯" },
  { id: "swiss-wings", token: "瑞", tone: "yellow", price: 58, kind: "food", chit: "瑞士雞翼飯" },
  { id: "beef-ho-fun", token: "河", tone: "yellow", price: 58, kind: "food", chit: "乾炒牛河" },
  { id: "yeung-chow-rice", token: "揚", tone: "yellow", price: 54, kind: "food", chit: "揚州炒飯" },
  { id: "wonton-noodle", token: "蓉", tone: "yellow", price: 40, kind: "food", chit: "細蓉" },

  // 三文治 / 多士 / 包
  { id: "egg-sandwich", token: "蛋", tone: "mint", price: 26, kind: "food", chit: "蛋治" },
  { id: "ham-sandwich", token: "腿", tone: "mint", price: 28, kind: "food", chit: "腿治" },
  { id: "beef-sandwich", token: "牛", tone: "mint", price: 32, kind: "food", chit: "牛治" },
  { id: "french-toast", token: "多", tone: "mint", price: 28, kind: "food", chit: "西多", wallBoard: true },
  { id: "pineapple-bun", token: "菠", tone: "mint", price: 24, kind: "food", chit: "菠蘿油", wallBoard: true },
  { id: "milk-bun", token: "豬", tone: "mint", price: 22, kind: "food", chit: "奶油豬" },
  { id: "egg-tart", token: "撻", tone: "mint", price: 12, kind: "food", chit: "蛋撻" },
  { id: "borscht", token: "羅", tone: "mint", price: 20, kind: "food", chit: "羅宋湯" },

  // 飲品 — the codes are what the waiter writes
  { id: "milk-tea", token: "9T", tone: "code", price: 24, kind: "drink", chit: "9T", wallBoard: true },
  { id: "lemon-tea", token: "0T", tone: "code", price: 24, kind: "drink", chit: "0T", wallBoard: true },
  { id: "lemon-water", token: "檸", tone: "code", price: 22, kind: "drink", chit: "檸水" },
  { id: "yuenyeung", token: "鴦", tone: "mint", price: 26, kind: "drink", chit: "鴦" },
  { id: "coffee", token: "啡", tone: "mint", price: 24, kind: "drink", chit: "啡" },
  { id: "horlicks", token: "克", tone: "mint", price: 26, kind: "drink", chit: "好立克" },
  { id: "ovaltine", token: "華", tone: "mint", price: 26, kind: "drink", chit: "阿華田" },
  { id: "red-bean-ice", token: "紅", tone: "mint", price: 28, kind: "drink", chit: "紅豆冰" },
  { id: "watercress-honey", token: "蜜", tone: "mint", price: 24, kind: "drink", chit: "菜蜜" },
  { id: "coke-lemon-ginger", token: "薑", tone: "mint", price: 28, kind: "drink", chit: "薑檸樂" },
  { id: "boiled-egg-water", token: "滾", tone: "mint", price: 14, kind: "drink", chit: "滾水蛋" },
];

// Phrases for a Hong Kong taxi. Spoken live (not pre-rendered) except the
// ones a passenger may need in a hurry.
export type TaxiPhrase = {
  id: string;
  cantonese: string;
  jyutping: string;
  english: string;
  group: "boarding" | "during" | "paying";
};

export const TAXI_PHRASES: TaxiPhrase[] = [
  {
    id: "please-meter",
    cantonese: "唔該，用咪錶。",
    jyutping: "m4 goi1, jung6 mai1 biu1.",
    english: "Please use the meter.",
    group: "boarding",
  },
  {
    id: "know-the-way",
    cantonese: "唔該，跟導航行。",
    jyutping: "m4 goi1, gan1 dou6 hong4 haang4.",
    english: "Please follow the navigation route.",
    group: "boarding",
  },
  {
    id: "which-tunnel",
    cantonese: "請問行邊條隧道？",
    jyutping: "cing2 man6 haang4 bin1 tiu4 seoi6 dou6?",
    english: "Which tunnel are we taking?",
    group: "boarding",
  },
  {
    id: "slow-down",
    cantonese: "唔該，慢啲。",
    jyutping: "m4 goi1, maan6 di1.",
    english: "Please slow down.",
    group: "during",
  },
  {
    id: "stop-here",
    cantonese: "唔該，呢度停。",
    jyutping: "m4 goi1, ni1 dou6 ting4.",
    english: "Please stop here.",
    group: "during",
  },
  {
    id: "front-corner",
    cantonese: "唔該，前面轉角落。",
    jyutping: "m4 goi1, cin4 min6 zyun3 gok3 lok6.",
    english: "Drop me at the corner ahead.",
    group: "during",
  },
  {
    id: "how-much",
    cantonese: "唔該，幾多錢？",
    jyutping: "m4 goi1, gei2 do1 cin2?",
    english: "How much is it?",
    group: "paying",
  },
  {
    id: "receipt",
    cantonese: "唔該，我要收據。",
    jyutping: "m4 goi1, ngo5 jiu3 sau1 geoi3.",
    english: "I'd like a receipt, please.",
    group: "paying",
  },
];

/**
 * Passenger rights and practical notes. General information gathered from
 * Transport Department guidance — not legal advice, and worth confirming on
 * td.gov.hk before relying on it in a dispute.
 *
 * Only ids live here: the wording is Chinese on the design and has to be
 * translatable, so title and body come from the catalogue as
 * `taxi.tip.<id>.title` / `.body`.
 */
export type TaxiTip = { id: string };

export const TAXI_TIPS: TaxiTip[] = [
  { id: "detour-normal" },
  { id: "meter-on" },
  { id: "receipt-right" },
  { id: "extras-on-top" },
  { id: "refusal" },
  { id: "note-details" },
];

/** The two shown while off-route, and the three shown when paying. */
export const DETOUR_TIPS = ["detour-normal", "meter-on"] as const;
export const PAYING_TIPS = ["receipt-right", "extras-on-top", "refusal"] as const;

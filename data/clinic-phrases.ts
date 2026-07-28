// Survival phrases for a clinic, A&E or government counter.
// Spoken live rather than pre-rendered: unlike the minibus shout these
// aren't time-critical, so a ~1s round trip is fine.
export type ClinicPhrase = {
  id: string;
  cantonese: string;
  jyutping: string;
  english: string;
  group: "arrive" | "symptom" | "ask";
};

export const CLINIC_PHRASES: ClinicPhrase[] = [
  {
    id: "need-doctor",
    cantonese: "唔該，我要睇醫生。",
    jyutping: "m4 goi1, ngo5 jiu3 tai2 ji1 sang1.",
    english: "Excuse me, I need to see a doctor.",
    group: "arrive",
  },
  {
    id: "no-cantonese",
    cantonese: "唔好意思，我唔識講廣東話，可唔可以搵個翻譯？",
    jyutping:
      "m4 hou2 ji3 si1, ngo5 m4 sik1 gong2 gwong2 dung1 waa2, ho2 m4 ho2 ji5 wan2 go3 faan1 jik6?",
    english: "Sorry, I don't speak Cantonese — can someone interpret?",
    group: "arrive",
  },
  {
    id: "where-queue",
    cantonese: "請問喺邊度排隊登記？",
    jyutping: "cing2 man6 hai2 bin1 dou6 paai4 deoi2 dang1 gei3?",
    english: "Where do I queue to register?",
    group: "arrive",
  },
  {
    id: "unwell",
    cantonese: "我唔舒服，好辛苦。",
    jyutping: "ngo5 m4 syu1 fuk6, hou2 san1 fu2.",
    english: "I feel unwell and I'm in distress.",
    group: "symptom",
  },
  {
    id: "fever",
    cantonese: "我發燒，仲有咳。",
    jyutping: "ngo5 faat3 siu1, zung6 jau5 kat1.",
    english: "I have a fever and a cough.",
    group: "symptom",
  },
  {
    id: "allergy",
    cantonese: "我對某啲藥物敏感。",
    jyutping: "ngo5 deoi3 mau5 di1 joek6 mat6 man5 gam2.",
    english: "I'm allergic to some medicines.",
    group: "symptom",
  },
  {
    id: "how-long",
    cantonese: "請問要等幾耐？",
    jyutping: "cing2 man6 jiu3 dang2 gei2 noi6?",
    english: "How long is the wait?",
    group: "ask",
  },
  {
    id: "how-much-fee",
    cantonese: "請問收幾多錢？",
    jyutping: "cing2 man6 sau1 gei2 do1 cin2?",
    english: "How much does it cost?",
    group: "ask",
  },
];

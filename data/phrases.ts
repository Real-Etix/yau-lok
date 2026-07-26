// Survival phrase pack: minibus scenario.
// `spoken` is what the TTS shouts; `jyutping` is shown in coach mode.
export type Phrase = {
  id: string;
  cantonese: string;
  jyutping: string;
  english: string;
  /** When the app proactively surfaces this phrase */
  context: "approaching" | "boarding" | "general";
  /** Bigger = more prominent button */
  primary?: boolean;
};

export const MINIBUS_PHRASES: Phrase[] = [
  {
    id: "yau-lok",
    cantonese: "唔該，有落！",
    jyutping: "m4 goi1, jau5 lok6!",
    english: "Please, getting off!",
    context: "approaching",
    primary: true,
  },
  {
    id: "bus-stop",
    cantonese: "唔該，巴士站有落！",
    jyutping: "m4 goi1, baa1 si6 zaam6 jau5 lok6!",
    english: "Please stop at the bus stop ahead",
    context: "approaching",
  },
  {
    id: "traffic-light",
    cantonese: "唔該，燈位有落！",
    jyutping: "m4 goi1, dang1 wai2 jau5 lok6!",
    english: "Please stop at the traffic light",
    context: "approaching",
  },
  {
    id: "after-turn",
    cantonese: "唔該，轉彎位有落！",
    jyutping: "m4 goi1, zyun3 waan1 wai2 jau5 lok6!",
    english: "Please stop after the turn",
    context: "approaching",
  },
  {
    id: "does-it-go",
    cantonese: "司機，去唔去銅鑼灣呀？",
    jyutping: "si1 gei1, heoi3 m4 heoi3 tung4 lo4 waan1 aa3?",
    english: "Driver, do you go to Causeway Bay?",
    context: "boarding",
  },
  {
    id: "how-much",
    cantonese: "唔該，幾多錢呀？",
    jyutping: "m4 goi1, gei2 do1 cin2 aa3?",
    english: "How much is it, please?",
    context: "boarding",
  },
  {
    id: "excuse-me",
    cantonese: "唔該借借！",
    jyutping: "m4 goi1 ze3 ze3!",
    english: "Excuse me, coming through!",
    context: "general",
  },
];

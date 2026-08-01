// The Observatory feed gives the current condition as Traditional Chinese
// (text_en is usually null), so "陰" was reaching English and Mandarin users
// verbatim. Its vocabulary is small and fixed, so it maps cleanly onto the
// translated catalogue.
//
// Order matters: the longer, more specific phrases have to be tested before
// the single characters they contain (大致多雲 before 多雲, 驟雨 before 雨).

const CONDITIONS: [RegExp, string][] = [
  [/雷暴|雷/, "wx.thunderstorms"],
  [/狂風大雨|大雨/, "wx.heavyRain"],
  [/驟雨|陣雨/, "wx.showers"],
  [/微雨|毛毛雨/, "wx.drizzle"],
  [/雨/, "wx.rain"],
  [/有霧|霧(?!霞)/, "wx.foggy"],
  [/薄霧/, "wx.misty"],
  [/煙霞/, "wx.hazy"],
  [/大致天晴/, "wx.mainlySunny"],
  [/短暫時間有陽光|短暂时间有阳光/, "wx.sunnyPeriods"],
  [/部分時間有陽光|間中有陽光|部分时间有阳光/, "wx.sunnyIntervals"],
  [/天晴|晴/, "wx.sunny"],
  [/大致多雲|大致多云/, "wx.mainlyCloudy"],
  [/密雲|密云|陰|阴/, "wx.overcast"],
  [/多雲|多云/, "wx.cloudy"],
  [/天色良好/, "wx.fine"],
  [/大風|大风|風勢|风势/, "wx.windy"],
  [/炎熱|炎热|酷熱|酷热/, "wx.hot"],
  [/寒冷|嚴寒|严寒/, "wx.cold"],
  [/乾燥|干燥/, "wx.dry"],
  [/潮濕|潮湿/, "wx.humid"],
];

/**
 * The catalogue key for an Observatory condition string, or null when the
 * wording is one we don't recognise — the caller then shows it as it came,
 * which is better than dropping the reading entirely.
 */
export function weatherKey(text: string): string | null {
  for (const [re, key] of CONDITIONS) if (re.test(text)) return key;
  return null;
}

import { Platform } from "./types";

export const platforms: Record<string, Platform> = {
  dmmtv: {
    id: "dmmtv",
    name: "DMM TV",
    color: "#ff6b6b",
    url: "https://tv.dmm.com",
    searchUrl: "https://tv.dmm.com/vod/list/?keyword=",
  },
  netflix: {
    id: "netflix",
    name: "Netflix",
    color: "#e50914",
    url: "https://www.netflix.com",
    searchUrl: "https://www.netflix.com/search?q=",
  },
  abema: {
    id: "abema",
    name: "ABEMA",
    color: "#00c95c",
    url: "https://abema.tv",
    searchUrl: "https://abema.tv/search?q=",
  },
  crunchyroll: {
    id: "crunchyroll",
    name: "Crunchyroll",
    color: "#f47521",
    url: "https://www.crunchyroll.com",
    searchUrl: "https://www.crunchyroll.com/search?q=",
  },
  amazon: {
    id: "amazon",
    name: "Prime Video",
    color: "#00a8e1",
    url: "https://www.amazon.co.jp/gp/video",
    searchUrl: "https://www.amazon.co.jp/s?i=instant-video&k=",
  },
  danime: {
    id: "danime",
    name: "dアニメストア",
    color: "#ff4081",
    url: "https://animestore.docomo.ne.jp",
    searchUrl: "https://animestore.docomo.ne.jp/animestore/sch_pc?searchKey=",
  },
  disney: {
    id: "disney",
    name: "Disney+",
    color: "#113ccf",
    url: "https://www.disneyplus.com",
    searchUrl: "https://www.disneyplus.com/ja-jp/search?q=",
  },
  hulu: {
    id: "hulu",
    name: "Hulu",
    color: "#1ce783",
    url: "https://www.hulu.jp",
    searchUrl: "https://www.hulu.jp/search?q=",
  },
  unext: {
    id: "unext",
    name: "U-NEXT",
    color: "#00b4d8",
    url: "https://video.unext.jp",
    searchUrl: "https://video.unext.jp/freeword?query=",
  },
  theater: {
    id: "theater",
    name: "映画館",
    color: "#d4a017",
    url: "https://movies.yahoo.co.jp",
    searchUrl: "https://movies.yahoo.co.jp/movie?q=",
  },
};

export function getPlatformSearchUrl(platformId: string, animeTitle: string): string {
  const p = platforms[platformId];
  if (p?.searchUrl) {
    return p.searchUrl + encodeURIComponent(animeTitle);
  }
  return p?.url ?? "#";
}

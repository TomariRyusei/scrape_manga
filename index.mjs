import fs from "fs";
import fetch from "node-fetch";
import jsdom from "jsdom";

const { JSDOM } = jsdom;

(async () => {
  try {
    const res = await fetch(
      "https://www.navi-comi.com/20488/arrival-list/?page=1"
    );
    const html = await res.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const nodes = document.querySelectorAll(".arrival_detail ");
    const childNodes = Array.from(nodes, (dd) => dd.childNodes);

    // 漫画のタイトルだけ抽出
    const mangaTitles = childNodes.map((childNode) => {
      let mangaTitle = "";
      childNode.forEach((elem, index) => {
        if (index === 1) {
          mangaTitle = elem.textContent.trim();
        }
      });
      return mangaTitle;
    });
    outputMangaInfo(mangaTitles.join("\n"));
  } catch (e) {
    outputLog(e.toString());
  }
})();

// 日付データ取得
const getFormattedDate = () => {
  const date = new Date();
  const y = date.getFullYear();
  const m = ("0" + (date.getMonth() + 1)).slice(-2);
  return y + m;
};

// テキスト出力
const outputMangaInfo = (text) => {
  const outputFilepath = `/Users/tryu/desktop/mangaInfo/mangaInfo_${getFormattedDate()}`;
  try {
    fs.writeFileSync(outputFilepath, text);
  } catch (e) {
    outputLog(e.toString());
  }
};

// ログ出力
const outputLog = (val) => {
  const outputFilepath = `/Users/tryu/desktop/mangaInfo/log/mangaInfo_${getFormattedDate()}_log`;
  try {
    fs.writeFileSync(outputFilepath, val);
  } catch (e) {
    outputLog(e.toString());
  }
};

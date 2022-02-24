import fs from "fs";
import fetch from "node-fetch";
import jsdom from "jsdom";

const { JSDOM } = jsdom;

// ページネーションの長さを取得する
const getPaginationLength = async () => {
  const res = await fetch(
    "https://www.navi-comi.com/20488/arrival-list/?page=1"
  );
  const html = await res.text();
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // ページネーション対応
  const pager = document.querySelectorAll("#list_footer .pager");
  // ページネーション部のli要素のみ抽出
  const pagerLiElems = Array.from(pager[0].childNodes[1].childNodes, (elem) => {
    if (elem.nodeName === "LI") {
      return elem.childNodes;
    }
  }).filter((val) => {
    return !(val === null || val === undefined || val === "");
  });

  // 一番最後を取得しそのaタグのhrefを取得
  const lastLiElem = pagerLiElems.slice(-1)[0];
  const href = lastLiElem[0].href;
  return Number(href.substring(href.indexOf("page=") + 5, href.indexOf("&")));
};

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
  fs.writeFileSync(outputFilepath, text);
};

// ログ出力
const outputLog = (val) => {
  const outputFilepath = `/Users/tryu/desktop/mangaInfo/log/mangaInfo_${getFormattedDate()}_log`;
  const date = new Date();
  try {
    fs.writeFileSync(outputFilepath, `${date} ${val}`);
  } catch (e) {
    outputLog(e.toString());
  }
};

(async () => {
  try {
    // ページネーションの長さ
    const pageLen = await getPaginationLength();

    // ページネーション分ループ
    const outputDataAll = [];
    for (let i = 1; i <= pageLen; i++) {
      const res = await fetch(
        `https://www.navi-comi.com/20488/arrival-list/?page=${i}`
      );
      const html = await res.text();
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // 漫画入荷日付を抽出
      const arrivalDateNodes = document.querySelectorAll(".arrival_date");
      // 入荷日付データ
      const arrivalDateList = Array.from(arrivalDateNodes, (date) =>
        date.textContent.trim()
      );

      // 漫画のタイトルだけ抽出
      const arrivalDetailNodes = document.querySelectorAll(".arrival_detail ");
      const arrivalDetailChildNodes = Array.from(
        arrivalDetailNodes,
        (dd) => dd.childNodes
      );
      // 漫画タイトルデータ
      const mangaTitleList = arrivalDetailChildNodes.map((childNode) => {
        let mangaTitle = "";
        childNode.forEach((elem, index) => {
          if (index === 1) {
            mangaTitle = elem.textContent.trim();
          }
        });
        return mangaTitle;
      });

      // 件数は同じになるはず
      if (arrivalDateList.length !== mangaTitleList.length)
        throw new Error("漫画の入荷日付数とタイトル数が一致しません。");

      // 日付とタイトルを結合
      const outputData = mangaTitleList.map((mangaTitle, index) => {
        let joinedData = "";
        arrivalDateList.forEach((date, dateIndex) => {
          if (index === dateIndex) {
            joinedData = `${date} ${mangaTitle}`;
          }
        });
        return joinedData;
      });

      // outputDataを展開して結合していく
      outputDataAll.push(...outputData);
    }

    // ファイルに書き出す
    outputMangaInfo(outputDataAll.join("\n"));
  } catch (e) {
    outputLog(e.toString());
  }
})();

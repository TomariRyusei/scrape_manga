import fs from "fs";
import fetch from "node-fetch";
import jsdom from "jsdom";
import dotenv from "dotenv";
import { myMangaList } from "./myMangaList.js";

const { JSDOM } = jsdom;

// .envをprocess.envに割当て
dotenv.config();

// ページネーションの長さを取得する
const getPaginationLength = async () => {
  const res = await fetch(process.env.KAIKATSU_MANGA_ARRIVAL_LIST_URL_PAGE1);
  const html = await res.text();
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // ページネーション対応
  const pager = document.querySelectorAll(process.env.HTML_PAGER_ID);
  // ページネーション部のli要素のみ抽出
  const pagerLiElems = Array.from(pager[0].childNodes[1].childNodes, (elem) => {
    if (elem.nodeName === "LI") {
      return elem.childNodes;
    }
  }).filter((val) => {
    return !!val;
  });

  // 一番最後を取得しそのaタグのhrefを取得
  const lastLiElem = pagerLiElems.slice(-1)[0];
  const href = lastLiElem[0].href;
  return Number(href.substring(href.indexOf("page=") + 5, href.indexOf("&")));
};

// 入荷予定日付を返す
const getArrivalDate = (document) => {
  return Array.from(
    document.querySelectorAll(process.env.HTML_ARRIVAL_DATE_CLASS),
    (date) => date.textContent.trim()
  );
};

// 入荷予定漫画タイトルを返す
const getArrivalMangaTitle = (document) => {
  // 入荷予定漫画詳細情報
  const arrivalDetailChildNodes = Array.from(
    document.querySelectorAll(process.env.HTML_ARRIVAL_DETAIL_CLASS),
    (dd) => dd.childNodes
  );

  // 入荷予定漫画詳細情報からタイトルのみ抽出して返す
  return arrivalDetailChildNodes.map((childNode) => {
    let mangaTitle = "";
    childNode.forEach((elem, index) => {
      if (index === 1) {
        mangaTitle = elem.textContent.trim();
      }
    });
    return mangaTitle;
  });
};

// 読んでいる漫画の情報(myMangaList)のみ抽出する
const filterManga = (outputDataAll) => {
  let returnArr = [];
  myMangaList.forEach((mangaTitle) => {
    const arr = outputDataAll.filter((data) => {
      return data.includes(mangaTitle);
    });
    returnArr.push(...arr);
  });
  return returnArr;
};

// 日付とタイトルを結合して返す
const combinedDateAndTitle = (mangaTitleList, arrivalDateList) => {
  return mangaTitleList.map((mangaTitle, index) => {
    let joinedData = "";
    arrivalDateList.forEach((date, dateIndex) => {
      if (index === dateIndex) {
        joinedData = `${date} ${mangaTitle}`;
      }
    });
    return joinedData;
  });
};

// 日付で昇順にソート
const sortOutputData = (outputData) => {
  return outputData.sort((a, b) => {
    return a.substring(0, 5).trim() > b.substring(0, 5).trim() ? 1 : -1;
  });
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
  const outputFilePath = `${
    process.env.PATH_FOR_OUTPUT_MANGAINFO
  }${getFormattedDate()}`;
  fs.writeFileSync(outputFilePath, text);
};

// ログ出力
const outputLog = (val) => {
  const outputFilePath = `${
    process.env.PATH_FOR_OUTPUT_ERROR_LOG
  }${getFormattedDate()}_log`;
  const date = new Date();
  try {
    fs.writeFileSync(outputFilePath, `${date} ${val}`);
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
        `${process.env.KAIKATSU_MANGA_ARRIVAL_LIST_BASE_URL}${i}`
      );
      const html = await res.text();
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // 入荷日付データ
      const arrivalDateList = getArrivalDate(document);

      // 入荷予定漫画詳細情報からタイトルのみ抽出
      const mangaTitleList = getArrivalMangaTitle(document);

      // 件数は同じになるはず
      if (arrivalDateList.length !== mangaTitleList.length)
        throw new Error("漫画の入荷日付数とタイトル数が一致しません。");

      // 日付とタイトルを結合
      const combinedOutputData = combinedDateAndTitle(
        mangaTitleList,
        arrivalDateList
      );

      // outputDataを展開して結合していく
      outputDataAll.push(...combinedOutputData);
    }

    // 読んでいる漫画のみ抽出する
    const filteredOutputData = filterManga(outputDataAll);

    // 日付で昇順にソート
    const sortedOutputData = sortOutputData(filteredOutputData);

    // ファイルに書き出す
    outputMangaInfo(sortedOutputData.join("\n"));
  } catch (e) {
    outputLog(e.toString());
  }
})();

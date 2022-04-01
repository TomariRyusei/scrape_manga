const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const jsdom = require("jsdom");
const nodemailer = require("nodemailer");

const { JSDOM } = jsdom;

const config = functions.config();

admin.initializeApp(config.firebase);
const firestore = admin.firestore();

// ページネーションの長さを取得する
const getPaginationLength = async () => {
  const res = await fetch(config.kaikatsu_manga_arrival_list_url.page1);
  const html = await res.text();
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // ページネーション対応
  const pager = document.querySelectorAll(config.html.pager_id);
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

// 購読している漫画リストを取得
const getMyMangaList = async () => {
  const snapShot = await firestore.collection("mangalist").get();
  const data = snapShot.docs.map((doc) => {
    return doc.data().title;
  });
  return data;
};

// 入荷予定日付を返す
const getArrivalDate = (document) => {
  return Array.from(
    document.querySelectorAll(config.html.arrival_date_class),
    (date) => date.textContent.trim()
  );
};

// 入荷予定漫画タイトルを返す
const getArrivalMangaTitle = (document) => {
  // 入荷予定漫画詳細情報
  const arrivalDetailChildNodes = Array.from(
    document.querySelectorAll(config.html.arrival_detail_class),
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
const filterManga = async (outputDataAll) => {
  // 購読している漫画リストを取得
  const myMangaList = await getMyMangaList();
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
  const y = `${date.getFullYear()}年`;
  const m = `${date.getMonth() + 1}月`;
  return y + m;
};

// メール送信関数
function sendMail(mailContent) {
  // smtp情報
  const smtpData = {
    host: "smtp.gmail.com",
    port: "465",
    secure: true,
    auth: {
      user: config.gmail.email,
      pass: config.gmail.password,
    },
  };

  // メール内容
  const mailData = {
    from: "テストユーザ",
    to: config.gmail.email,
    subject: `${getFormattedDate()}の新刊入荷情報`,
    text: mailContent.join("\n"),
  };

  // SMTPサーバの情報をまとめる
  const transporter = nodemailer.createTransport(smtpData);

  // メール送信
  transporter.sendMail(mailData, (e) => {
    if (e) {
      console.log(e);
    }
  });
}

exports.scheduledFunction = functions
  .region("asia-northeast1")
  .pubsub.schedule("0 8 1 * *")
  .timeZone("Asia/Tokyo")
  .onRun(async () => {
    // ページネーションの長さ
    const pageLen = await getPaginationLength();
    // ページネーション分ループ
    const outputDataAll = [];
    for (let i = 1; i <= pageLen; i++) {
      const res = await fetch(
        `${config.kaikatsu_manga_arrival_list_url.base}${i}`
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
    const filteredOutputData = await filterManga(outputDataAll);
    // 日付で昇順にソート
    const sortedOutputData = sortOutputData(filteredOutputData);
    // メール送信
    sendMail(sortedOutputData);
  });

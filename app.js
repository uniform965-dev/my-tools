const GAS_URL =
  "https://script.google.com/macros/s/AKfycbya4sVzUa02qIJ8VmCvQXm2rmBopsRym2FxzqSWQW0MnEinUaDRdD_CKM97Xdt9Ke7slA/exec";


/* =========================
   全域狀態
========================= */

let recognition = null;

let isRunning = false;

let startTime = null;

let timerInterval = null;

let sessionId = "";

let finalEnglishText = "";

let textBuffer = "";


/*
 * 翻譯模式
 *
 * instant = 每一句 final 立即翻譯
 * buffer  = 累積指定字數後翻譯
 */
let translationMode = "instant";


/*
 * GAS 傳送 Queue
 */
let translationQueue = [];

let processingQueue = false;


/* =========================
   HTML 元件
========================= */

const startButton =
  document.getElementById(
    "startButton"
  );

const stopButton =
  document.getElementById(
    "stopButton"
  );

const statusElement =
  document.getElementById(
    "status"
  );

const timerElement =
  document.getElementById(
    "timer"
  );

const interimTextElement =
  document.getElementById(
    "interimText"
  );

const englishTextElement =
  document.getElementById(
    "englishText"
  );

const chineseTextElement =
  document.getElementById(
    "chineseText"
  );

const transcriptElement =
  document.getElementById(
    "transcript"
  );


/*
 * 翻譯模式 UI
 */
const modeInputs =
  document.querySelectorAll(
    'input[name="translationMode"]'
  );

const bufferSetting =
  document.getElementById(
    "bufferSetting"
  );

const bufferSizeInput =
  document.getElementById(
    "bufferSize"
  );


/* =========================
   一般工具
========================= */

function updateStatus(text) {

  statusElement.textContent =
    text;

}


function createSessionId() {

  return (
    "session_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .substring(2, 8)
  );

}


/*
 * 取得目前設定的字數
 */
function getBufferSize() {

  if (!bufferSizeInput) {
    return 80;
  }


  let value =
    parseInt(
      bufferSizeInput.value,
      10
    );


  if (
    isNaN(value) ||
    value < 10
  ) {

    value = 80;

  }


  return value;

}


/* =========================
   翻譯模式切換
========================= */

if (modeInputs.length > 0) {

  modeInputs.forEach(
    input => {

      input.addEventListener(
        "change",
        function () {

          translationMode =
            this.value;


          /*
           * Buffer 模式
           */
          if (
            translationMode ===
            "buffer"
          ) {

            if (bufferSetting) {

              bufferSetting
                .style
                .display =
                  "block";

            }

          }


          /*
           * 即時模式
           */
          else {

            if (bufferSetting) {

              bufferSetting
                .style
                .display =
                  "none";

            }


            /*
             * 切換模式時，
             * 如果 Buffer 還有內容，
             * 先送出去避免遺失
             */
            if (
              textBuffer.trim()
            ) {

              queueTranslation(
                textBuffer.trim(),
                "buffer",
                getBufferSize()
              );


              textBuffer =
                "";

            }

          }

        }
      );

    }
  );

}


/*
 * 預設即時模式時
 * 隱藏字數設定
 */
if (
  bufferSetting &&
  translationMode === "instant"
) {

  bufferSetting.style.display =
    "none";

}


/* =========================
   SpeechRecognition 建立
========================= */

function createSpeechRecognition() {

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


  if (!SpeechRecognition) {

    updateStatus(
      "此瀏覽器不支援 SpeechRecognition"
    );


    alert(
      "目前瀏覽器不支援語音辨識。"
    );


    return false;

  }


  recognition =
    new SpeechRecognition();


  /*
   * 英文
   */
  recognition.lang =
    "en-US";


  /*
   * 持續辨識
   */
  recognition.continuous =
    true;


  /*
   * 顯示 interim result
   */
  recognition.interimResults =
    true;


  recognition.maxAlternatives =
    1;


  /* -------------------------
     Recognition Started
  ------------------------- */

  recognition.onstart =
    function () {

      updateStatus(
        "🎤 正在聆聽英文..."
      );

    };


  /* -------------------------
     Recognition Result
  ------------------------- */

  recognition.onresult =
    function (event) {

      let interimText = "";


      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {

        const transcript =
          event.results[i][0]
            .transcript;


        /*
         * Final sentence
         */
        if (
          event.results[i].isFinal
        ) {

          const finalText =
            transcript.trim();


          if (!finalText) {
            continue;
          }


          /*
           * 顯示完整英文逐字稿
           */
          finalEnglishText +=
            finalText + " ";


          englishTextElement
            .textContent =
              finalEnglishText
                .trim();


          /* =====================
             模式 1：
             每一句立即翻譯
          ===================== */

          if (
            translationMode ===
            "instant"
          ) {

            queueTranslation(
              finalText,
              "instant",
              0
            );

          }


          /* =====================
             模式 2：
             累積指定字數
          ===================== */

          else if (
            translationMode ===
            "buffer"
          ) {

            textBuffer +=
              finalText + " ";


            const targetSize =
              getBufferSize();


            if (
              textBuffer.length >=
              targetSize
            ) {

              const textToSend =
                textBuffer.trim();


              textBuffer =
                "";


              queueTranslation(
                textToSend,
                "buffer",
                targetSize
              );

            }

          }

        }


        /*
         * Interim result
         */
        else {

          interimText +=
            transcript;

        }

      }


      interimTextElement
        .textContent =
          interimText ||
          "正在聆聽...";

    };


  /* -------------------------
     Recognition Error
  ------------------------- */

  recognition.onerror =
    function (event) {

      console.error(
        "SpeechRecognition error:",
        event.error
      );


      updateStatus(
        "語音辨識錯誤：" +
        event.error
      );


      /*
       * 麥克風權限問題
       */
      if (
        event.error ===
          "not-allowed" ||
        event.error ===
          "service-not-allowed"
      ) {

        isRunning =
          false;


        startButton.disabled =
          false;


        stopButton.disabled =
          true;

      }

    };


  /* -------------------------
     Recognition Ended
  ------------------------- */

  recognition.onend =
    function () {

      console.log(
        "SpeechRecognition ended"
      );


      /*
       * 使用者還在錄音狀態
       * 就自動重啟
       */
      if (isRunning) {

        setTimeout(
          function () {

            try {

              recognition.start();

            }

            catch (error) {

              console.error(
                "Recognition restart failed:",
                error
              );

            }

          },

          700
        );

      }

    };


  return true;

}


/* =========================
   麥克風權限
========================= */

async function requestMicrophonePermission() {

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    throw new Error(
      "瀏覽器不支援 getUserMedia"
    );

  }


  /*
   * 取得 microphone permission
   */
  const stream =
    await navigator.mediaDevices
      .getUserMedia({
        audio: true
      });


  /*
   * SpeechRecognition 會自行使用麥克風
   * 所以這個 stream 可以關閉
   */
  stream
    .getTracks()
    .forEach(
      track =>
        track.stop()
    );

}


/* =========================
   開始錄音
========================= */

async function startRecognition() {

  if (isRunning) {
    return;
  }


  try {

    updateStatus(
      "正在取得麥克風權限..."
    );


    await requestMicrophonePermission();

  }

  catch (error) {

    console.error(error);


    updateStatus(
      "無法取得麥克風權限"
    );


    alert(
      "請允許此網站使用麥克風。"
    );


    return;

  }


  /*
   * 第一次使用建立 recognition
   */
  if (!recognition) {

    const success =
      createSpeechRecognition();


    if (!success) {
      return;
    }

  }


  /*
   * 新 Session
   */
  sessionId =
    createSessionId();


  /*
   * 清空本次資料
   */
  finalEnglishText =
    "";


  textBuffer =
    "";


  translationQueue =
    [];


  processingQueue =
    false;


  englishTextElement.textContent =
    "尚無內容";


  chineseTextElement.textContent =
    "等待翻譯...";


  interimTextElement.textContent =
    "正在準備...";


  transcriptElement.innerHTML =
    "";


  /*
   * 開始狀態
   */
  isRunning =
    true;


  startButton.disabled =
    true;


  stopButton.disabled =
    false;


  startTime =
    Date.now();


  startTimer();


  try {

    recognition.start();

  }

  catch (error) {

    console.error(
      "Recognition start failed:",
      error
    );


    updateStatus(
      "啟動語音辨識失敗"
    );

  }

}


/* =========================
   停止錄音
========================= */

async function stopRecognition() {

  isRunning =
    false;


  /*
   * 停止 SpeechRecognition
   */
  if (recognition) {

    try {

      recognition.stop();

    }

    catch (error) {

      console.error(error);

    }

  }


  /*
   * Buffer 模式如果還有文字，
   * 停止時一定補送
   */
  if (
    translationMode ===
      "buffer" &&
    textBuffer.trim()
  ) {

    const remainingText =
      textBuffer.trim();


    const targetSize =
      getBufferSize();


    textBuffer =
      "";


    queueTranslation(
      remainingText,
      "buffer",
      targetSize
    );

  }


  clearInterval(
    timerInterval
  );


  startButton.disabled =
    false;


  stopButton.disabled =
    true;


  interimTextElement.textContent =
    "已停止";


  /*
   * 如果 Queue 還有資料
   */
  if (
    processingQueue ||
    translationQueue.length > 0
  ) {

    updateStatus(
      "已停止錄音，剩餘內容翻譯中..."
    );

  }

  else {

    updateStatus(
      "已停止"
    );

  }

}


/* =========================
   加入翻譯 Queue
========================= */

function queueTranslation(
  english,
  mode,
  threshold
) {

  if (!english) {
    return;
  }


  translationQueue.push({

    text:
      english,

    mode:
      mode,

    threshold:
      threshold

  });


  processTranslationQueue();

}


/* =========================
   GAS Queue 處理
========================= */

async function processTranslationQueue() {

  /*
   * 已經在翻譯
   */
  if (processingQueue) {
    return;
  }


  /*
   * Queue 空
   */
  if (
    translationQueue.length === 0
  ) {

    if (!isRunning) {

      updateStatus(
        "已停止"
      );

    }

    return;

  }


  processingQueue =
    true;


  /*
   * 取第一筆
   */
  const item =
    translationQueue.shift();


  updateStatus(
    "正在翻譯..."
  );


  try {

    const response =
      await fetch(
        GAS_URL,
        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "text/plain;charset=utf-8"

          },

          body:
            JSON.stringify({

              sessionId:
                sessionId,

              text:
                item.text,

              translationMode:
                item.mode,

              threshold:
                item.threshold

            })

        }
      );


    /*
     * HTTP 錯誤
     */
    if (!response.ok) {

      throw new Error(
        "HTTP Error: " +
        response.status
      );

    }


    /*
     * GAS JSON
     */
    const result =
      await response.json();


    console.log(
      "GAS Response:",
      result
    );


    /*
     * GAS 回傳錯誤
     */
    if (!result.success) {

      throw new Error(
        result.error ||
        "GAS 翻譯失敗"
      );

    }


    /*
     * 顯示最新中文
     */
    chineseTextElement.textContent =
      result.chinese;


    /*
     * 加入翻譯紀錄
     */
    addTranscript(
      result.english,
      result.chinese,
      result.translationMode,
      result.characterCount
    );


    if (isRunning) {

      updateStatus(
        "🎤 正在聆聽英文..."
      );

    }

  }

  catch (error) {

    console.error(
      "GAS ERROR:",
      error
    );


    updateStatus(
      "翻譯連線失敗"
    );


    /*
     * 暫時失敗時，
     * 把這筆放回 Queue 最前面
     */
    translationQueue.unshift(
      item
    );


    /*
     * 避免一直瘋狂重送
     */
    await delay(
      2000
    );

  }

  finally {

    processingQueue =
      false;

  }


  /*
   * 還有下一筆
   */
  if (
    translationQueue.length > 0
  ) {

    setTimeout(
      processTranslationQueue,
      300
    );

  }

  else {

    if (isRunning) {

      updateStatus(
        "🎤 正在聆聽英文..."
      );

    }

    else {

      updateStatus(
        "已停止"
      );

    }

  }

}


/* =========================
   翻譯紀錄顯示
========================= */

function addTranscript(
  english,
  chinese,
  mode,
  characterCount
) {

  const item =
    document.createElement(
      "div"
    );


  item.className =
    "transcript-item";


  /*
   * 時間
   */
  const timeDiv =
    document.createElement(
      "div"
    );


  timeDiv.className =
    "transcript-time";


  timeDiv.textContent =
    new Date()
      .toLocaleTimeString();


  /*
   * English
   */
  const englishDiv =
    document.createElement(
      "div"
    );


  englishDiv.className =
    "transcript-english";


  englishDiv.textContent =
    english;


  /*
   * Chinese
   */
  const chineseDiv =
    document.createElement(
      "div"
    );


  chineseDiv.className =
    "transcript-chinese";


  chineseDiv.textContent =
    chinese;


  /*
   * Debug / mode info
   */
  const infoDiv =
    document.createElement(
      "div"
    );


  infoDiv.style.fontSize =
    "11px";


  infoDiv.style.color =
    "#999";


  infoDiv.style.marginTop =
    "8px";


  const modeText =
    mode === "buffer"
      ? "累積字數模式"
      : "即時模式";


  infoDiv.textContent =
    modeText +
    " · " +
    characterCount +
    " 字元";


  /*
   * 組裝
   */
  item.appendChild(
    timeDiv
  );


  item.appendChild(
    englishDiv
  );


  item.appendChild(
    chineseDiv
  );


  item.appendChild(
    infoDiv
  );


  /*
   * 最新翻譯放最上方
   */
  transcriptElement.prepend(
    item
  );

}


/* =========================
   Timer
========================= */

function startTimer() {

  clearInterval(
    timerInterval
  );


  timerElement.textContent =
    "00:00";


  timerInterval =
    setInterval(
      function () {

        const elapsed =
          Date.now() -
          startTime;


        const seconds =
          Math.floor(
            elapsed / 1000
          );


        const minutes =
          Math.floor(
            seconds / 60
          );


        const remainingSeconds =
          seconds % 60;


        timerElement.textContent =
          String(minutes)
            .padStart(
              2,
              "0"
            )
          +
          ":"
          +
          String(
            remainingSeconds
          )
            .padStart(
              2,
              "0"
            );

      },

      1000
    );

}


/* =========================
   Delay
========================= */

function delay(ms) {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );

}


/* =========================
   Button Events
========================= */

startButton.addEventListener(
  "click",
  startRecognition
);


stopButton.addEventListener(
  "click",
  stopRecognition
);

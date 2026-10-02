let accessPassword = "";

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

let translationMode = "instant";

let translationQueue = [];
let processingQueue = false;


/* =========================
   登入 HTML 元件
========================= */

const loginPanel =
  document.getElementById(
    "loginPanel"
  );

const translatorPanel =
  document.getElementById(
    "translatorPanel"
  );

const futureTools =
  document.getElementById(
    "futureTools"
  );

const passwordInput =
  document.getElementById(
    "passwordInput"
  );

const loginButton =
  document.getElementById(
    "loginButton"
  );

const loginMessage =
  document.getElementById(
    "loginMessage"
  );


/* =========================
   翻譯 HTML 元件
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


/* =========================
   翻譯模式 UI
========================= */

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
   登入功能
========================= */

function showLogin() {

  loginPanel.style.display =
    "block";

  translatorPanel.style.display =
    "none";

  if (futureTools) {
    futureTools.style.display =
      "none";
  }

}


function showTools() {

  loginPanel.style.display =
    "none";

  translatorPanel.style.display =
    "block";

  if (futureTools) {
    futureTools.style.display =
      "block";
  }

}


/*
 * 登入
 *
 * 密碼不會寫死在 GitHub。
 * 這裡只暫存在 sessionStorage。
 */
function login() {

  const password =
    passwordInput.value.trim();


  if (!password) {

    loginMessage.textContent =
      "請輸入存取密碼";

    return;
  }


  accessPassword =
    password;


  sessionStorage.setItem(
    "myToolsAccessPassword",
    password
  );


  loginMessage.textContent =
    "";


  showTools();

}


/*
 * 登出
 */
function logout() {

  sessionStorage.removeItem(
    "myToolsAccessPassword"
  );


  accessPassword =
    "";


  passwordInput.value =
    "";


  showLogin();

}


/*
 * 網頁載入時
 * 檢查這個分頁之前有沒有登入
 */
const savedPassword =
  sessionStorage.getItem(
    "myToolsAccessPassword"
  );


if (savedPassword) {

  accessPassword =
    savedPassword;

  showTools();

}
else {

  showLogin();

}


/*
 * Login Button
 */
loginButton.addEventListener(
  "click",
  login
);


/*
 * 按 Enter 也可以登入
 */
passwordInput.addEventListener(
  "keydown",
  function (event) {

    if (
      event.key ===
      "Enter"
    ) {

      login();

    }

  }
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


          if (
            translationMode ===
            "buffer"
          ) {

            if (bufferSetting) {

              bufferSetting.style.display =
                "block";

            }

          }
          else {

            if (bufferSetting) {

              bufferSetting.style.display =
                "none";

            }


            /*
             * 如果之前 Buffer 還有文字，
             * 切換模式前先送出去。
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


if (
  bufferSetting &&
  translationMode ===
    "instant"
) {

  bufferSetting.style.display =
    "none";

}


/* =========================
   SpeechRecognition
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


  recognition.lang =
    "en-US";


  recognition.continuous =
    true;


  recognition.interimResults =
    true;


  recognition.maxAlternatives =
    1;


  recognition.onstart =
    function () {

      updateStatus(
        "🎤 正在聆聽英文..."
      );

    };


  recognition.onresult =
    function (event) {

      let interimText =
        "";


      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {

        const transcript =
          event.results[i][0]
            .transcript;


        /*
         * Final
         */
        if (
          event.results[i].isFinal
        ) {

          const finalText =
            transcript.trim();


          if (!finalText) {
            continue;
          }


          finalEnglishText +=
            finalText + " ";


          englishTextElement.textContent =
            finalEnglishText.trim();


          /*
           * 即時模式
           */
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


          /*
           * 累積模式
           */
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

        else {

          interimText +=
            transcript;

        }

      }


      interimTextElement.textContent =
        interimText ||
        "正在聆聽...";

    };


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


  recognition.onend =
    function () {

      console.log(
        "SpeechRecognition ended"
      );


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
    !navigator.mediaDevices
      .getUserMedia
  ) {

    throw new Error(
      "瀏覽器不支援 getUserMedia"
    );

  }


  const stream =
    await navigator.mediaDevices
      .getUserMedia({
        audio: true
      });


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

  /*
   * 沒登入就不允許使用
   */
  if (!accessPassword) {

    alert(
      "請先登入"
    );

    showLogin();

    return;
  }


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


  if (!recognition) {

    const success =
      createSpeechRecognition();


    if (!success) {
      return;
    }

  }


  sessionId =
    createSessionId();


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


  if (recognition) {

    try {

      recognition.stop();

    }
    catch (error) {

      console.error(error);

    }

  }


  /*
   * Buffer 模式剩餘內容
   * 停止時補送
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
   Queue
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
   GAS Queue
========================= */

async function processTranslationQueue() {

  if (processingQueue) {
    return;
  }


  if (
    translationQueue.length ===
    0
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

              /*
               * 新增：
               * 每一次翻譯都附上密碼
               */
              accessPassword:
                accessPassword,

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


    if (!response.ok) {

      throw new Error(
        "HTTP Error: " +
        response.status
      );

    }


    const result =
      await response.json();


    console.log(
      "GAS Response:",
      result
    );


    /*
     * 密碼錯誤
     */
    if (
      result.error ===
      "ACCESS_DENIED"
    ) {

      sessionStorage.removeItem(
        "myToolsAccessPassword"
      );


      accessPassword =
        "";


      /*
       * 停止錄音
       */
      isRunning =
        false;


      if (recognition) {

        try {

          recognition.stop();

        }
        catch (error) {

          console.error(error);

        }

      }


      clearInterval(
        timerInterval
      );


      showLogin();


      passwordInput.value =
        "";


      loginMessage.textContent =
        "密碼錯誤，請重新輸入";


      throw new Error(
        "ACCESS_DENIED"
      );

    }


    if (!result.success) {

      throw new Error(
        result.error ||
        "GAS 翻譯失敗"
      );

    }


    chineseTextElement.textContent =
      result.chinese;


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


    /*
     * ACCESS_DENIED 不要重新排入 Queue
     */
    if (
      error.message !==
      "ACCESS_DENIED"
    ) {

      updateStatus(
        "翻譯連線失敗"
      );


      /*
       * 暫時失敗重新排入
       */
      translationQueue.unshift(
        item
      );


      await delay(
        2000
      );

    }

  }
  finally {

    processingQueue =
      false;

  }


  /*
   * 已經登出就停止 Queue
   */
  if (!accessPassword) {
    return;
  }


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
   翻譯紀錄
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


  const timeDiv =
    document.createElement(
      "div"
    );


  timeDiv.className =
    "transcript-time";


  timeDiv.textContent =
    new Date()
      .toLocaleTimeString();


  const englishDiv =
    document.createElement(
      "div"
    );


  englishDiv.className =
    "transcript-english";


  englishDiv.textContent =
    english;


  const chineseDiv =
    document.createElement(
      "div"
    );


  chineseDiv.className =
    "transcript-chinese";


  chineseDiv.textContent =
    chinese;


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
   Buttons
========================= */

startButton.addEventListener(
  "click",
  startRecognition
);


stopButton.addEventListener(
  "click",
  stopRecognition
);

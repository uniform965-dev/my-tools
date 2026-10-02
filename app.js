const GAS_URL =
  "https://script.google.com/macros/s/AKfycbya4sVzUa02qIJ8VmCvQXm2rmBopsRym2FxzqSWQW0MnEinUaDRdD_CKM97Xdt9Ke7slA/exec";


let recognition = null;

let isRunning = false;

let startTime = null;

let timerInterval = null;

let finalEnglishText = "";

let sessionId = "";

let textBuffer = "";

let sending = false;


const startButton =
  document.getElementById("startButton");

const stopButton =
  document.getElementById("stopButton");

const statusElement =
  document.getElementById("status");

const timerElement =
  document.getElementById("timer");

const interimTextElement =
  document.getElementById("interimText");

const englishTextElement =
  document.getElementById("englishText");

const chineseTextElement =
  document.getElementById("chineseText");

const transcriptElement =
  document.getElementById("transcript");


function updateStatus(text) {
  statusElement.textContent = text;
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

      let interimText = "";


      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {

        const transcript =
          event.results[i][0]
            .transcript;


        if (
          event.results[i].isFinal
        ) {

          const finalText =
            transcript.trim();


          finalEnglishText +=
            finalText + " ";


          textBuffer +=
            finalText + " ";


          englishTextElement.textContent =
            finalEnglishText.trim();


          /*
           * 每累積約 80 個字元
           * 就送 GAS 翻譯
           */
          if (
            textBuffer.length >= 80
          ) {

            sendBufferToGas();

          }


        } else {

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
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {

        isRunning = false;

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

            } catch (error) {

              console.error(
                "Restart failed:",
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


async function requestMicrophonePermission() {

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
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
      track => track.stop()
    );

}


async function startRecognition() {

  if (isRunning) {
    return;
  }


  try {

    updateStatus(
      "正在取得麥克風權限..."
    );


    await requestMicrophonePermission();


  } catch (error) {

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


  /*
   * 建立這次錄音的 Session ID
   */
  sessionId =
    createSessionId();


  finalEnglishText =
    "";


  textBuffer =
    "";


  englishTextElement.textContent =
    "尚無內容";


  chineseTextElement.textContent =
    "等待翻譯...";


  transcriptElement.innerHTML =
    "";


  interimTextElement.textContent =
    "正在準備...";


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


  } catch (error) {

    console.error(error);


    updateStatus(
      "啟動語音辨識失敗"
    );

  }

}


async function stopRecognition() {

  isRunning =
    false;


  if (recognition) {

    try {

      recognition.stop();

    } catch (error) {

      console.error(error);

    }

  }


  clearInterval(
    timerInterval
  );


  /*
   * 停止時把剩下不足 80 字的
   * 英文也送去翻譯
   */
  if (
    textBuffer.trim()
  ) {

    await sendBufferToGas();

  }


  startButton.disabled =
    false;


  stopButton.disabled =
    true;


  interimTextElement.textContent =
    "已停止";


  updateStatus(
    "已停止"
  );

}


/*
 * 將目前 Buffer 送到 GAS
 */
async function sendBufferToGas() {

  /*
   * 避免同時送出兩次
   */
  if (sending) {
    return;
  }


  const english =
    textBuffer.trim();


  if (!english) {
    return;
  }


  /*
   * 先清空 Buffer
   */
  textBuffer =
    "";


  sending =
    true;


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
                english

            })

        }
      );


    const result =
      await response.json();


    console.log(
      "GAS response:",
      result
    );


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
      result.chinese
    );


    if (isRunning) {

      updateStatus(
        "🎤 正在聆聽英文..."
      );

    }


  } catch (error) {

    console.error(
      "GAS ERROR:",
      error
    );


    updateStatus(
      "翻譯連線失敗"
    );


    /*
     * 發送失敗，
     * 把英文放回 Buffer
     */
    textBuffer =
      english + " " + textBuffer;


  } finally {

    sending =
      false;

  }

}


/*
 * 把翻譯紀錄加入畫面
 */
function addTranscript(
  english,
  chinese
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


  item.appendChild(
    timeDiv
  );


  item.appendChild(
    englishDiv
  );


  item.appendChild(
    chineseDiv
  );


  transcriptElement.prepend(
    item
  );

}


function startTimer() {

  clearInterval(
    timerInterval
  );


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
            .padStart(2, "0")
          +
          ":"
          +
          String(
            remainingSeconds
          )
            .padStart(2, "0");

      },

      1000
    );

}


startButton.addEventListener(
  "click",
  startRecognition
);


stopButton.addEventListener(
  "click",
  stopRecognition
);

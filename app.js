let recognition = null;

let isRunning = false;

let startTime = null;

let timerInterval = null;

let finalEnglishText = "";

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const statusElement = document.getElementById("status");
const timerElement = document.getElementById("timer");
const interimTextElement = document.getElementById("interimText");
const englishTextElement = document.getElementById("englishText");
const chineseTextElement = document.getElementById("chineseText");


function updateStatus(text) {
  statusElement.textContent = text;
}


function createSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    updateStatus("此瀏覽器不支援 SpeechRecognition");
    alert("目前瀏覽器不支援語音辨識。");
    return false;
  }

  recognition = new SpeechRecognition();

  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;


  recognition.onstart = function () {
    updateStatus("🎤 正在聆聽英文...");
  };


  recognition.onresult = function (event) {
    let interimText = "";

    for (
      let i = event.resultIndex;
      i < event.results.length;
      i++
    ) {
      const transcript =
        event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        finalEnglishText +=
          transcript.trim() + " ";

      } else {
        interimText += transcript;
      }
    }

    interimTextElement.textContent =
      interimText || "正在聆聽...";

    englishTextElement.textContent =
      finalEnglishText.trim() || "尚無內容";
  };


  recognition.onerror = function (event) {
    console.error(
      "SpeechRecognition error:",
      event.error
    );

    updateStatus(
      "語音辨識錯誤：" + event.error
    );

    if (
      event.error === "not-allowed" ||
      event.error === "service-not-allowed"
    ) {
      isRunning = false;

      startButton.disabled = false;
      stopButton.disabled = true;
    }
  };


  recognition.onend = function () {
    console.log("SpeechRecognition ended");

    if (isRunning) {
      setTimeout(function () {
        try {
          recognition.start();
        } catch (error) {
          console.error(
            "Restart failed:",
            error
          );
        }
      }, 700);
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
    await navigator.mediaDevices.getUserMedia({
      audio: true
    });

  // 这里只用來觸發麥克風授權
  stream
    .getTracks()
    .forEach(track => track.stop());
}


async function startRecognition() {
  if (isRunning) {
    return;
  }

  try {
    updateStatus("正在取得麥克風權限...");

    await requestMicrophonePermission();

  } catch (error) {
    console.error(error);

    updateStatus("無法取得麥克風權限");

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


  finalEnglishText = "";

  englishTextElement.textContent =
    "尚無內容";

  chineseTextElement.textContent =
    "尚未連接翻譯功能";

  interimTextElement.textContent =
    "正在準備...";


  isRunning = true;

  startButton.disabled = true;
  stopButton.disabled = false;


  startTime = Date.now();

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


function stopRecognition() {
  isRunning = false;

  if (recognition) {
    try {
      recognition.stop();
    } catch (error) {
      console.error(error);
    }
  }

  clearInterval(timerInterval);

  startButton.disabled = false;
  stopButton.disabled = true;

  interimTextElement.textContent =
    "已停止";

  updateStatus("已停止");
}


function startTimer() {
  clearInterval(timerInterval);

  timerInterval =
    setInterval(function () {
      const elapsed =
        Date.now() - startTime;

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
        String(minutes).padStart(2, "0") +
        ":" +
        String(
          remainingSeconds
        ).padStart(2, "0");

    }, 1000);
}


startButton.addEventListener(
  "click",
  startRecognition
);

stopButton.addEventListener(
  "click",
  stopRecognition
);

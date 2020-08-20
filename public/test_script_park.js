function _assert(desc, v) {
  if (v) {
    return;
  } else {
    let caller = _assert.caller || "Top level";
    console.error("ASSERT in %s, %s is :", caller, desc, v);
  }
}

// デバイスのメディアにアクセス
let localVideo = document.getElementById("local_video");
let localStream = null;

// 複数接続用にピアコネクションの準備
let peerConnections = [];
let remoteVideos = [];
const MAX_CONNECTION_COUNT = 20;

// --- multi video ---
// let container = document.getElementById("container");
let container = document.getElementById("videoSlider");
_assert("container", container);

// --- prefix -----
navigator.getUserMedia =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia;
RTCPeerConnection =
  window.RTCPeerConnection ||
  window.webkitRTCPeerConnection ||
  window.mozRTCPeerConnection;
RTCSessionDescription =
  window.RTCSessionDescription ||
  window.webkitRTCSessionDescription ||
  window.mozRTCSessionDescription;

// ----------------------------------------------------------------
// ---------------------- SOCKET.IOの設定  -----------------------
// ----------------------------------------------------------------

// ----- use socket.io ---
let port = 3000;
let socket = io();
let room = getRoomName();

socket.on("connect", function (evt) {
  console.log("socket.io connected. enter room=" + room);
  socket.emit("enter", room);
});
socket.on("message", function (message) {
  console.log("message:", message);
  let fromId = message.from;

  if (message.type === "offer") {
    // -- got offer ---
    console.log("Received offer ...");
    let offer = new RTCSessionDescription(message);
    setOffer(fromId, offer);
  } else if (message.type === "answer") {
    // --- got answer ---
    console.log("Received answer ...");
    let answer = new RTCSessionDescription(message);
    setAnswer(fromId, answer);
  } else if (message.type === "candidate") {
    // --- got ICE candidate ---
    console.log("Received ICE candidate ...");
    let candidate = new RTCIceCandidate(message.ice);
    console.log(candidate);
    addIceCandidate(fromId, candidate);
  } else if (message.type === "call me") {
    if (!isReadyToConnect()) {
      console.log("Not ready to connect, so ignore");
      return;
    } else if (!canConnectMore()) {
      console.warn("TOO MANY connections, so ignore");
    }

    if (isConnectedWith(fromId)) {
      // already connnected, so skip
      console.log("already connected, so ignore");
    } else {
      // connect new party
      makeOffer(fromId);
    }
  } else if (message.type === "bye") {
    if (isConnectedWith(fromId)) {
      stopConnection(fromId);
    }
  }
});
socket.on("user disconnected", function (evt) {
  console.log("====user disconnected==== evt:", evt);
  let id = evt.id;
  if (isConnectedWith(id)) {
    stopConnection(id);
  }
});

socket.on("chat", function (msg) {
  // $("#chat").append($("<li>").text(msg));
  chatVue.addContent2(msg);
});

socket.on("alert", function (msg) {
  toastr.success(msg);
  $("#alert_se").get(0).play();
});

socket.on("being", function (msg) {
  var text = msg;
  const words = text.split("---");
  // 名前欄を更新する
  if ($("#user_name_" + words[1]).text() !== words[0]) {
    $("#user_name_" + words[1]).text(words[0]);
  }
  memberVue.updateMemberList(msg);
});

socket.on("leaveSignal", function (msg) {
  memberVue.unsableUser(msg);
});

socket.on("talkSignal", function (msg) {
  var text = msg;
  const words = text.split("---");

  // マイク使用中ユーザの色を変える
  $("#userlist_" + words[1]).addClass("nowtalking");

  // マイクボタンを使用不可にする
  $("#unmutebutton").addClass("unavailable");
});

socket.on("releaseSignal", function (msg) {
  var text = msg;
  const words = text.split("---");

  // マイク使用中ユーザの色を戻す
  $("#userlist_" + words[1]).removeClass("nowtalking");

  // マイクボタンを使用可にする
  $("#unmutebutton").removeClass("unavailable");
});

// --- broadcast message to all members in room
function emitRoom(msg) {
  socket.emit("message", msg);
}

function emitTo(id, msg) {
  msg.sendto = id;
  socket.emit("message", msg);
}

// -- room名を取得 --
function getRoomName() {
  /* パラメータで指定する場合
      let url = document.location.href;
      let args = url.split("?");
      if (args.length > 1) {
        let room = args[1];
        if (room != "") {
          console.log("RoomName:" + room);
          return room;
        }
      }
      return "_testroom";
      */

  // 埋め込みで指定する場合
  let args = $("#table_id").val();
  if (args == "") {
    return "_testroom";
  }
  return args;
}

// ---- for multi party -----
function isReadyToConnect() {
  if (localStream) {
    return true;
  } else {
    return false;
  }
}

// --- RTCPeerConnections ---
function getConnectionCount() {
  return peerConnections.length;
}

function canConnectMore() {
  return getConnectionCount() < MAX_CONNECTION_COUNT;
}

function isConnectedWith(id) {
  if (peerConnections[id]) {
    return true;
  } else {
    return false;
  }
}

function addConnection(id, peer) {
  _assert("addConnection() peer", peer);
  _assert("addConnection() peer must NOT EXIST", !peerConnections[id]);
  peerConnections[id] = peer;
}

function getConnection(id) {
  let peer = peerConnections[id];
  _assert("getConnection() peer must exist", peer);
  return peer;
}

function deleteConnection(id) {
  _assert("deleteConnection() peer must exist", peerConnections[id]);
  delete peerConnections[id];
}

function stopConnection(id) {
  detachVideo(id);

  if (isConnectedWith(id)) {
    let peer = getConnection(id);
    peer.close();
    deleteConnection(id);
  }
}

function stopAllConnection() {
  for (let id in peerConnections) {
    stopConnection(id);
  }
}

// ----------------------------------------------------------------
// ---------------------- ビデオ要素の管理  -----------------------
// ----------------------------------------------------------------

// --- video elements ---
function attachVideo(id, stream) {
  let video = addRemoteVideoElement(id);
  playVideo(video, stream);
  video.volume = 1.0;

  $("#remote_video_" + id).wrap(
    '<div class="videoWrapper" id="video_container_' + id + '"/>'
  );
  $("#remote_video_" + id).after(
    '<p class="membername" id="user_name_' + id + '">　</p>'
  );
}

function detachVideo(id) {
  let video = getRemoteVideoElement(id);
  pauseVideo(video);
  deleteRemoteVideoElement(id);

  // $('#remote_video_'+id).remove();
  $("#video_container_" + id).remove();

  // ダミービデオ要素を追加
  // 今回はダミーは表示させない
  // addBlankVideoElement();
}

function isRemoteVideoAttached(id) {
  if (remoteVideos[id]) {
    return true;
  } else {
    return false;
  }
}

function addRemoteVideoElement(id) {
  _assert("addRemoteVideoElement() video must NOT EXIST", !remoteVideos[id]);
  let video = createVideoElement("remote_video_" + id);
  remoteVideos[id] = video;
  return video;
}

function getRemoteVideoElement(id) {
  let video = remoteVideos[id];
  _assert("getRemoteVideoElement() video must exist", video);
  return video;
}

function deleteRemoteVideoElement(id) {
  _assert("deleteRemoteVideoElement() stream must exist", remoteVideos[id]);
  //removeVideoElement("remote_video_" + id);
  removeVideoWrapperElement("video_container_" + id);
  delete remoteVideos[id];
}

function createVideoElement(elementId) {
  // ダミービデオを一つ削除
  // 今回はダミー表示を使用しない
  // removeBlankVideoElement();

  // ビデオ要素を作成
  let video = document.createElement("video");
  video.id = elementId;
  video.className = "membersvideo optionalvideo";
  // container.prepend(video);
  container.appendChild(video);
  return video;
}

// 元の処理
function removeVideoElement(elementId) {
  let video = document.getElementById(elementId);
  _assert("removeVideoElement() video must exist", video);

  container.removeChild(video);
  return video;
}

// DIVでラップしてるので、DIVごと削除
function removeVideoWrapperElement(elementId) {
  let wrapper = document.getElementById(elementId);
  _assert("removeVideoWrapperElement() video must exist", wrapper);

  //container.remove(wrapper);
  $("#" + elementId).remove();
}

// ダミーのビデオを削除する
function removeBlankVideoElement() {
  $(".blankVideo")[0].remove();
}

// ダミーのビデオを追加する
function addBlankVideoElement() {
  $("#container").append(
    '<div class="col-1 col-12-small blankVideo" ><img src="/assets/images/dummy.png" class="dummyvideo"/></div>'
  );
}

// function

// ----------------------------------------------------------------
// ---------------------- ボタン操作  -----------------------
// ----------------------------------------------------------------

/**
 * イベントリスナ
 */
$("#startbutton").on("click", () => {
  startVideo();
});

$("#stopbutton").on("click", () => {
  stopVideo();
});

$("#local_video").on("click", () => {
  toggleVideo();
});
$("#playbutton").on("click", () => {
  toggleVideo();
});

$("#unmutebutton").on("click", () => {
  var classStr = $("#unmutebutton").attr("class");
  if (classStr.indexOf("unavailable") !== -1) {
    toastr.error("他の参加者が話し中です。");
  } else {
    $("#mic_switch_on_se").get(0).play();
    startVoice();
  }
});

$("#mutebutton").on("click", () => {
  $("#mic_switch_off_se").get(0).play();
  stopVoice();
});

$(window).on("beforeunload", () => {
  sendLeaveUser();
  stopVoice();
  sendLeaveRoom();
});

$("#colorselectbutton").on("click", () => {
  togglePalette();
});

function togglePalette() {
  if ($("#colorselectbutton").hasClass("fab-disable")) {
    closePalette();
    $("#colorselectbutton").removeClass("fab-disable");
    $("#colorselectbutton").addClass("fab-rainbow");
  } else {
    openPalette();
    $("#colorselectbutton").addClass("fab-disable");
    $("#colorselectbutton").removeClass("fab-rainbow");
  }
}

$("#ink-black").on("click", () => {
  setInk("text-black");
});
$("#ink-red").on("click", () => {
  setInk("text-red");
});
$("#ink-blue").on("click", () => {
  setInk("text-blue");
});
$("#ink-green").on("click", () => {
  setInk("text-green");
});

// connect video
function connectVideo() {
  var videoParam = {
    audio: true,
    video: {
      width: 480,
      height: 480,
      frameRate: { ideal: 10, max: 15 },
    },
  };
  getDeviceStream(videoParam) // audio: false <-- ontrack once, audio:true --> ontrack twice!!
    .then(function (stream) {
      // success

      // 取得したメディア情報をぶち込む
      localStream = stream;

      // 自分のビデオを再生する
      playVideo(localVideo, stream);

      // ビデオ・音声の送信をポーズ
      stopVideo();
      stopVoice();

      connect();
    })
    .catch(function (error) {
      // error
      console.error("getUserMedia error:", error);
      toastr.error(
        "Chromeブラウザを使用してください。他のブラウザは使用できません"
      );
      return;
    });
  return false;
}

/*
// start local video
function startVideo() {
  getDeviceStream({ video: true, audio: true }) // audio: false <-- ontrack once, audio:true --> ontrack twice!!
    .then(function(stream) {
      // success
      localStream = stream;
      playVideo(localVideo, stream);

      // ボタンの表示を切り替え
      $("#startbutton").addClass("hidden");
      $("#stopbutton").removeClass("hidden");

      connect();
    })
    .catch(function(error) {
      // error
      console.error("getUserMedia error:", error);
      return;
    });
    return false;
}

// stop local video
function stopVideo() {
  pauseVideo(localVideo);
  stopLocalStream(localStream);

  // ボタンの表示を切り替え
  $("#startbutton").removeClass("hidden");
  $("#stopbutton").addClass("hidden");

  return false;
}
*/

// マイクON/OFFボタン
function startVoice() {
  sendTalkSignal();

  var tracks = localStream.getAudioTracks();
  tracks[0].enabled = true;
  $("#mutebutton").removeClass("hidden");
  $("#unmutebutton").addClass("hidden");
  $("#userlist_myname").addClass("nowtalking");
}
function stopVoice() {
  sendReleaseSignal();

  var tracks = localStream.getAudioTracks();
  tracks[0].enabled = false;
  $("#unmutebutton").removeClass("hidden");
  $("#mutebutton").addClass("hidden");
  $("#userlist_myname").removeClass("nowtalking");
}

// ビデオON/OFFボタン
function startVideo() {
  localStream.getVideoTracks().forEach((track) => {
    track.enabled = true;
  });
  $("#stopbutton").removeClass("hidden");
  $("#startbutton").addClass("hidden");
}
function stopVideo() {
  localStream.getVideoTracks().forEach((track) => {
    track.enabled = false;
  });
  // stopLocalStream(localStream);
  $("#startbutton").removeClass("hidden");
  $("#stopbutton").addClass("hidden");
}
function toggleVideo() {
  localStream.getVideoTracks().forEach((track) => {
    if (track.enabled == true) {
      stopVideo();
      $("#playbutton").removeClass("invisiblize");
    } else {
      startVideo();
      $("#playbutton").addClass("invisiblize");
    }
  });
}

//
function sendChat() {
  if ($("#input_msg").val().length == 0) {
    toastr.error("文字を入力してください");
  } else {
    if (checkSendRestrict()) {
      var text = $("#user_name").val() + " : " + $("#input_msg").val();
      socket.emit("chat", text);
      chatVue.addContent(text);
      $("#input_msg").val("");
    } else {
      toastr.error(
        "連続投稿は禁止されています。しばらくしてからお試しください。"
      );
    }
  }

  return false;
}

function sendChat2() {
  if ($("#input_msg").val().length == 0) {
    toastr.error("文字を入力してください");
  } else {
    if (checkSendRestrict()) {
      var content = {
        user_id: "wakaran",
        user_name: $("#user_name").val(),
        message: $("#input_msg").val(),
        chat_color: $("#chat_color").attr("class"),
      };
      socket.emit("chat", JSON.stringify(content));
      chatVue.addContent2(JSON.stringify(content));
      $("#input_msg").val("");
    } else {
      toastr.error(
        "連続投稿は禁止されています。しばらくしてからお試しください。"
      );
    }
  }
  return false;
}

function sendBeing() {
  var message = $("#user_name").val() + "---" + socket.id;
  socket.emit("being", message);
  return false;
}

function sendTalkSignal() {
  var message = $("#user_name").val() + "---" + socket.id;
  socket.emit("talkSignal", message);
}

function sendReleaseSignal() {
  var message = $("#user_name").val() + "---" + socket.id;
  socket.emit("releaseSignal", message);
}

function sendLeaveUser() {
  var message = $("#user_name").val() + "---" + socket.id;
  socket.emit("leaveSignal", message);
}

function sendLeaveRoom() {
  var today = new Date();
  var hour = today.getHours();
  var minut = today.getMinutes();
  var textdate = hour + "時" + minut + "分";

  var text = $("#user_name").val() + "さんが退室しました。（" + textdate + "）";
  socket.emit("chat", text);
}

function stopLocalStream(stream) {
  let tracks = stream.getTracks();
  if (!tracks) {
    console.warn("NO tracks");
    return;
  }

  for (let track of tracks) {
    track.stop();
  }
}

function getDeviceStream(option) {
  if ("getUserMedia" in navigator.mediaDevices) {
    console.log("navigator.mediaDevices.getUserMadia");
    return navigator.mediaDevices.getUserMedia(option);
  } else {
    console.log("wrap navigator.getUserMadia with Promise");
    return new Promise(function (resolve, reject) {
      navigator.getUserMedia(option, resolve, reject);
    });
  }
}

function playVideo(element, stream) {
  if ("srcObject" in element) {
    element.srcObject = stream;
  } else {
    element.src = window.URL.createObjectURL(stream);
  }
  element.play();
  element.volume = 0;
}

function pauseVideo(element) {
  element.pause();
  if ("srcObject" in element) {
    //element.srcObject = null;
  } else {
    if (element.src && element.src !== "") {
      window.URL.revokeObjectURL(element.src);
    }
    element.src = "";
  }
}

/*--
  // ----- hand signaling ----
  function onSdpText() {
    let text = textToReceiveSdp.value;
    if (peerConnection) {
      console.log('Received answer text...');
      let answer = new RTCSessionDescription({
        type : 'answer',
        sdp : text,
      });
      setAnswer(answer);
    }
    else {
      console.log('Received offer text...');
      let offer = new RTCSessionDescription({
        type : 'offer',
        sdp : text,
      });
      setOffer(offer);
    }
    textToReceiveSdp.value ='';
  }
  --*/

function sendSdp(id, sessionDescription) {
  console.log("---sending sdp ---");
  let message = {
    type: sessionDescription.type,
    sdp: sessionDescription.sdp,
  };
  console.log("sending SDP=" + message);
  //ws.send(message);
  emitTo(id, message);
}

function sendIceCandidate(id, candidate) {
  console.log("---sending ICE candidate ---");
  let obj = { type: "candidate", ice: candidate };
  if (isConnectedWith(id)) {
    emitTo(id, obj);
  } else {
    console.warn("connection NOT EXIST or ALREADY CLOSED. so skip candidate");
  }
}

// ----------------------------------------------------------------
// ---------------------- ピアコネクションの管理  -----------------------
// ----------------------------------------------------------------
function prepareNewConnection(id) {
  // ネットワーク超えする場合
  let pc_config = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };
  let peer = new RTCPeerConnection(pc_config);

  // ローカルネットワークのみの場合
  // let pc_config = { iceServers: [] };
  // let peer = new RTCPeerConnection(pc_config);

  // --- on get remote stream ---
  if ("ontrack" in peer) {
    peer.ontrack = function (event) {
      let stream = event.streams[0];
      console.log("-- peer.ontrack() stream.id=" + stream.id);
      if (isRemoteVideoAttached(id)) {
        console.log("stream already attached, so ignore");
      } else {
        //playVideo(remoteVideo, stream);
        attachVideo(id, stream);
      }
    };
  } else {
    peer.onaddstream = function (event) {
      let stream = event.stream;
      console.log("-- peer.onaddstream() stream.id=" + stream.id);
      //playVideo(remoteVideo, stream);
      attachVideo(id, stream);
    };
  }

  // --- on get local ICE candidate
  peer.onicecandidate = function (evt) {
    if (evt.candidate) {
      console.log(evt.candidate);

      // Trickle ICE の場合は、ICE candidateを相手に送る
      sendIceCandidate(id, evt.candidate);

      // Vanilla ICE の場合には、何もしない
    } else {
      console.log("empty ice event");

      // Trickle ICE の場合は、何もしない

      // Vanilla ICE の場合には、ICE candidateを含んだSDPを相手に送る
      //sendSdp(id, peer.localDescription);
    }
  };

  // --- when need to exchange SDP ---
  peer.onnegotiationneeded = function (evt) {
    console.log("-- onnegotiationneeded() ---");
  };

  // --- other events ----
  peer.onicecandidateerror = function (evt) {
    console.error("ICE candidate ERROR:", evt);
  };

  peer.onsignalingstatechange = function () {
    console.log("== signaling status=" + peer.signalingState);
  };

  peer.oniceconnectionstatechange = function () {
    console.log("== ice connection status=" + peer.iceConnectionState);
    if (peer.iceConnectionState === "disconnected") {
      console.log("-- disconnected --");
      stopConnection(id);
    }
  };

  peer.onicegatheringstatechange = function () {
    console.log("==***== ice gathering state=" + peer.iceGatheringState);
  };

  peer.onconnectionstatechange = function () {
    console.log("==***== connection state=" + peer.connectionState);
  };

  peer.onremovestream = function (event) {
    console.log("-- peer.onremovestream()");
    deleteRemoteStream(id);
    detachVideo(id);
  };

  // -- add local stream --
  if (localStream) {
    console.log("Adding local stream...");
    // peer.addStream(localStream);

    localStream.getTracks().forEach((track) => {
      peer.addTrack(track, localStream);
    });
  } else {
    console.warn("no local stream, but continue.");
  }

  return peer;
}

function makeOffer(id) {
  _assert("makeOffer must not connected yet", !isConnectedWith(id));
  peerConnection = prepareNewConnection(id);
  addConnection(id, peerConnection);

  peerConnection
    .createOffer()
    .then(function (sessionDescription) {
      console.log("createOffer() succsess in promise");
      return peerConnection.setLocalDescription(sessionDescription);
    })
    .then(function () {
      console.log("setLocalDescription() succsess in promise");

      // -- Trickle ICE の場合は、初期SDPを相手に送る --
      sendSdp(id, peerConnection.localDescription);

      // -- Vanilla ICE の場合には、まだSDPは送らない --
    })
    .catch(function (err) {
      console.error(err);
    });
}

function setOffer(id, sessionDescription) {
  _assert("setOffer must not connected yet", !isConnectedWith(id));
  let peerConnection = prepareNewConnection(id);
  addConnection(id, peerConnection);

  peerConnection
    .setRemoteDescription(sessionDescription)
    .then(function () {
      console.log("setRemoteDescription(offer) succsess in promise");
      makeAnswer(id);
    })
    .catch(function (err) {
      console.error("setRemoteDescription(offer) ERROR: ", err);
    });
}

function makeAnswer(id) {
  console.log("sending Answer. Creating remote session description...");
  let peerConnection = getConnection(id);
  if (!peerConnection) {
    console.error("peerConnection NOT exist!");
    return;
  }

  peerConnection
    .createAnswer()
    .then(function (sessionDescription) {
      console.log("createAnswer() succsess in promise");
      return peerConnection.setLocalDescription(sessionDescription);
    })
    .then(function () {
      console.log("setLocalDescription() succsess in promise");

      // -- Trickle ICE の場合は、初期SDPを相手に送る --
      sendSdp(id, peerConnection.localDescription);

      // -- Vanilla ICE の場合には、まだSDPは送らない --
    })
    .catch(function (err) {
      console.error(err);
    });
}

function setAnswer(id, sessionDescription) {
  let peerConnection = getConnection(id);
  if (!peerConnection) {
    console.error("peerConnection NOT exist!");
    return;
  }

  peerConnection
    .setRemoteDescription(sessionDescription)
    .then(function () {
      console.log("setRemoteDescription(answer) succsess in promise");
    })
    .catch(function (err) {
      console.error("setRemoteDescription(answer) ERROR: ", err);
    });
}

// --- tricke ICE ---
function addIceCandidate(id, candidate) {
  if (!isConnectedWith(id)) {
    console.warn(
      "NOT CONNEDTED or ALREADY CLOSED with id=" + id + ", so ignore candidate"
    );
    return;
  }

  let peerConnection = getConnection(id);
  if (peerConnection) {
    peerConnection.addIceCandidate(candidate);
  } else {
    console.error("PeerConnection not exist!");
    return;
  }
}

// start PeerConnection
function connect() {
  console.log("connect sequence start.");
  if (!isReadyToConnect()) {
    console.warn("NOT READY to connect");
  } else if (!canConnectMore()) {
    console.log("TOO MANY connections");
  } else {
    callMe();
  }
}

// close PeerConnection
function hangUp() {
  emitRoom({ type: "bye" });
  stopAllConnection();
}

// ---- multi party --
function callMe() {
  emitRoom({ type: "call me" });
}

window.onload = function () {
  var today = new Date();
  // var year = today.getFullYear();
  // var month = today.getMonth() + 1;
  // var day = today.getDate();
  var hour = today.getHours();
  var minut = today.getMinutes();
  // var seccond = today.getSeconds();
  // var textdate = year + '年' + month + '月' + day + '日';
  var textdate = hour + "時" + minut + "分";

  var text = $("#user_name").val() + "さんが参加しました。（" + textdate + "）";
  socket.emit("alert", text);
  socket.emit("chat", text);

  var systemmesage =
    //"ようこそ" + $("#user_name").val() + "さん。（" + textdate + "）";
    "※メンテナンス中です　Sorry, you can not use now... m(_ _;)m";
  chatVue.addContent(systemmesage);

  setInterval(function () {
    sendBeing();
  }, 5000);

  connectVideo();
};

$("#chatToggle").on("click", function () {
  $("#chatSlide").slideToggle();
});

function copyToClipboard() {
  // コピー対象をJavaScript上で変数として定義する
  var copyTarget = document.getElementById("copyTarget");

  // コピー対象のテキストを選択する
  copyTarget.select();

  // 選択しているテキストをクリップボードにコピーする
  document.execCommand("Copy");

  // コピーをお知らせする
  alert("コピーできました！ : " + copyTarget.value);
}

function jumpOtherRoom(roomname) {
  const param = {
    table_name: roomname,
    user_name: $("#user_name").val(),
  };
  execPost("", param);
}

/**
 * データをPOSTする
 * @param String アクション
 * @param Object POSTデータ連想配列
 * 記述元Webページ http://fujiiyuuki.blogspot.jp/2010/09/formjspost.html
 * サンプルコード
 * <a onclick="execPost('/hoge', {'fuga':'fuga_val', 'piyo':'piyo_val'});return false;" href="#">POST送信</a>
 */
function execPost(action, data) {
  // フォームの生成
  var form = document.createElement("form");
  form.setAttribute("action", action);
  form.setAttribute("method", "post");
  form.style.display = "none";
  document.body.appendChild(form);
  // パラメタの設定
  if (data !== undefined) {
    for (var paramName in data) {
      var input = document.createElement("input");
      input.setAttribute("type", "hidden");
      input.setAttribute("name", paramName);
      input.setAttribute("value", data[paramName]);
      form.appendChild(input);
    }
  }
  // submit
  form.submit();
}

var sendTimeArr = [];
const MAX_RAPIDFIRE = 10;
const COOL_TIME = 60;

/**
 * 投稿制限をチェックする
 */
function checkSendRestrict() {
  var date = new Date();
  var a = date.getTime();
  var nowtime = Math.floor(a / 1000);

  // 配列が４以下の時は送信OK
  if (sendTimeArr.length < MAX_RAPIDFIRE) {
    setSendTime(nowtime);
    return true;

    // 配列が許容最大のときは判定
  } else {
    if (nowtime - sendTimeArr[0] > COOL_TIME) {
      // 送信OK
      setSendTime(nowtime);
      return true;
    } else {
      // 送信NG（送信しすぎの場合）
      return false;
    }
  }
}

function setSendTime(timeInt) {
  // 配列長が最大なら配列の頭を削除
  if (sendTimeArr.length >= MAX_RAPIDFIRE) {
    sendTimeArr.shift();
  }
  // 配列の末尾に時間を格納
  sendTimeArr.push(timeInt);
}

function openPalette() {
  $("#mini-balloon").removeClass("hidden");
  $("#palette-balloon").removeClass("hidden");
}

function closePalette() {
  $("#mini-balloon").addClass("hidden");
  $("#palette-balloon").addClass("hidden");
}

function setInk(classname) {
  $("#chat_color").removeClass().addClass(classname);
  $("#palette-icon").removeClass().addClass(classname);
}

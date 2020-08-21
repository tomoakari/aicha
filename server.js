/*
var https = require('https');
var fs = require('fs');
var ssl_server_key = '/etc/letsencrypt/live/www.aice.cloud/privkey.pem';
var ssl_server_crt = '/etc/letsencrypt/live/www.aice.cloud/fullchain.pem';
var sslport = 8443;

var options = {
        key: fs.readFileSync(ssl_server_key),
        cert: fs.readFileSync(ssl_server_crt)
};

https.createServer(options, function (req,res) {
        res.writeHead(200, {
                'Content-Type': 'text/plain'
        });
        res.end("Hello, world\n");
}).listen(sslport);
*/

// SSL版・エクスプレスサーバ・ソケットサーバの基本設定
// SSL準備
var fs = require("fs");
var ssl_server_key = "/etc/letsencrypt/live/aicha.aice.cloud/privkey.pem";
var ssl_server_crt = "/etc/letsencrypt/live/aicha.aice.cloud/fullchain.pem";
var options = {
  key: fs.readFileSync(ssl_server_key),
  cert: fs.readFileSync(ssl_server_crt),
};
var express = require("express");
var app = express();
var server = require("https").createServer(options, app);
var io = require("socket.io")(server);
var port = process.env.PORT || 8444; //aiceは8443

/*
// エクスプレスサーバ・ソケットサーバの基本設定
var express = require("express");
var app = express();
var server = require("http").createServer(app);
var io = require("socket.io")(server);
var port = process.env.PORT || 3000;
*/

// テンプレートエンジン
app.set("view engine", "ejs");

// POSTにも対応
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ハッシュライブラリ
const crypto = require("crypto");

/**
 * ルーティング
 */

// あいちゃ
app.get("/", (request, response) => {
  response.sendFile(__dirname + "/views/test_index.html");
});
app.post("/", (request, response) => {
  var table_id = crypto
    .createHash("md5")
    .update(request.body.table_name)
    .digest("hex");

  var data = {
    roomlist: getRoomList(),
    user_name: request.body.user_name,
    table_id: table_id,
    table_name: request.body.table_name,
  };
  // レンダリングを行う
  response.render("./test_room.ejs", data);
});

// ファイル置き場
app.use(express.static("public"));

// リッスン開始
server.listen(port, function () {
  console.log("Server listening at port %d", port);
});

// ソケットの設定
io.on("connection", function (socket) {
  // ---- multi room ----
  socket.on("enter", function (roomname) {
    socket.join(roomname);
    console.log("id=" + socket.id + " enter room=" + roomname);
    setRoomname(roomname);
  });

  function setRoomname(room) {
    socket.roomname = room;
  }

  function getRoomname() {
    var room = socket.roomname;
    return room;
  }

  function emitMessage(type, message) {
    // ----- multi room ----
    var roomname = getRoomname();

    if (roomname) {
      //console.log('===== message broadcast to room -->' + roomname);
      socket.broadcast.to(roomname).emit(type, message);
    } else {
      console.log("===== message broadcast all");
      socket.broadcast.emit(type, message);
    }
  }

  // When a user send a SDP message
  // broadcast to all users in the room
  socket.on("message", function (message) {
    var date = new Date();
    message.from = socket.id;
    //console.log(date + 'id=' + socket.id + ' Received Message: ' + JSON.stringify(message));

    // get send target
    var target = message.sendto;
    if (target) {
      //console.log('===== message emit to -->' + target);
      socket.to(target).emit("message", message);
      return;
    }

    // broadcast in room
    emitMessage("message", message);
  });

  // When the user hangs up
  // broadcast bye signal to all users in the room
  socket.on("disconnect", function () {
    // close user connection
    console.log(new Date() + " Peer disconnected. id=" + socket.id);

    // --- emit ----
    emitMessage("user disconnected", { id: socket.id });

    // --- leave room --
    var roomname = getRoomname();
    if (roomname) {
      socket.leave(roomname);
    }
  });

  // チャットメッセージの配信
  socket.on("chat", function (message) {
    console.log(" chat send. socket.id= " + socket.id + "message= " + message);
    message.from = socket.id;

    // broadcast in room
    emitMessage("chat", message);
  });

  // ログインメッセージの配信
  socket.on("alert", function (message) {
    message.from = socket.id;

    // broadcast in room
    emitMessage("alert", message);
  });

  // PINGの配信
  socket.on("being", function (message) {
    //message.from = socket.id;
    console.log("being received. " + message);
    emitMessage("being", message);
  });

  // マイク使用シグナルの配信
  socket.on("talkSignal", function (message) {
    emitMessage("talkSignal", message);
  });
  // マイクリリースシグナルの配信
  socket.on("releaseSignal", function (message) {
    emitMessage("releaseSignal", message);
  });

  // 退出シグナルの配信
  socket.on("leaveSignal", function (message) {
    emitMessage("leaveSignal", message);
  });
});

// DBから部屋リストを取得
function getRoomList() {
  var data = [
    {
      roomname: "ロビー",
      membercount: "",
    },
    {
      roomname: "IT",
      membercount: "",
    },
    {
      roomname: "政治",
      membercount: "",
    },
    {
      roomname: "音楽",
      membercount: "",
    },
    {
      roomname: "アニメ",
      membercount: "",
    },
    {
      roomname: "旅行",
      membercount: "",
    },
    {
      roomname: "出会い",
      membercount: "",
    },
  ];
  return data;
} // DBから部屋リストを取得
function getRoomList2() {
  var data = {
    roomlist: [
      {
        roomname: "ロビー",
        membercount: "",
      },
      {
        roomname: "IT",
        membercount: "",
      },
      {
        roomname: "政治",
        membercount: "",
      },
      {
        roomname: "音楽",
        membercount: "",
      },
      {
        roomname: "アニメ",
        membercount: "",
      },
      {
        roomname: "旅行",
        membercount: "",
      },
      {
        roomname: "出会い",
        membercount: "",
      },
    ],
  };
  return data;
}

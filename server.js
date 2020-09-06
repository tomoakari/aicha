/**
 * SSL基本設定
 */
var fs = require("fs");
var ssl_server_key = "/etc/letsencrypt/live/aicha.aice.cloud/privkey.pem";
var ssl_server_crt = "/etc/letsencrypt/live/aicha.aice.cloud/fullchain.pem";
var options = {
  key: fs.readFileSync(ssl_server_key),
  cert: fs.readFileSync(ssl_server_crt),
};

/**
 * Expressサーバの基本設定
 */
var express = require("express");
var app = express();
var server = require("https").createServer(options, app);
var io = require("socket.io")(server);
var port = process.env.PORT || 8444; //aiceは8443

app.set("views", __dirname + "/views");
app.set("public", __dirname + "/public");

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
  response.render("test_room.ejs", data);
});

// ファイル置き場
app.use(express.static(__dirname + "/public"));

// リッスン開始
server.listen(port, function () {
  console.log("Server listening at port %d", port);
});

/**
 * ソケットの設定
 */
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

  // DBアクセステスト
  socket.on("dbtest", function () {
    const createData = { name: "神山アリス" }; //更新データ
    create(createData);
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

/**
 * ****************************************************************************
 * DBアクセス
 * ****************************************************************************
 */

/**
 * Sequelizeの定義
 */
const DB_NAME = "aicha";
const USER_NAME = "aichauser";
const PASSWORD = "aichauser";
const Sequelize = require("sequelize");
const sequelize = new Sequelize(DB_NAME, USER_NAME, PASSWORD, {
  dialect: "mysql",
});

/**
 * Userモデルクラス
 * create table user (id int primary key auto_increment, name varchar(32), created_at datetime, updated_at datetime, deleted_at datetime );
 */
const UserModel = sequelize.define(
  "users",
  {
    id: {
      field: "id",
      type: Sequelize.INTEGER(11),
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      field: "name",
      type: Sequelize.STRING(32),
      allowNull: true,
    },
    /*
    mail: {
      field: 'mail',
      type: Sequelize.STRING(32),
      allowNull: true
    },
    sex: {
      field: 'sex',
      type: Sequelize.INTEGER(11),
      default: 0
    },
    */
  },
  {
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    tableName: "users", //明示的にテーブル名を指定
  }
);

/**
 * Roomモデルクラス
 */
const RoomModel = sequelize.define(
  "rooms",
  {
    id: {
      field: "id",
      type: Sequelize.INTEGER(11),
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      field: "name",
      type: Sequelize.STRING(32),
      allowNull: true,
    },
    hashedName: {
      field: "hashed_name",
      type: Sequelize.STRING(32),
      allowNull: true,
    },
  },
  {
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    tableName: "rooms", //明示的にテーブル名を指定
  }
);

exports.find = async function (whereData) {
  return await UserModel.findAll({
    where: whereData,
  });
};

exports.get = async function (userId) {
  return await UserModel.findByPk(userId);
};

exports.update = async function (updateData, whereCondition, updateFields) {
  return await UserModel.update(updateData, {
    where: whereCondition,
    fields: updateFields,
  });
};

exports.create = async function (userData) {
  return await UserModel.create(userData);
};

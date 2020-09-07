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
 * ************************************************************
 * ルーティング
 * ************************************************************
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
// 秘密の管理ページ
app.get("/adminroom", (request, response) => {
  response.sendFile(__dirname + "/views/adminroom.html");
});
app.post("/adminroom", (request, response) => {
  var data = {
    name: request.body.room_name,
    category_name: request.body.category_name,
    category_id: request.body.category_id,
    default_flg: request.body.default_flg,
    create_user_id: request.body.create_user_id,
  };
  createRoom(data);
  response.sendFile(__dirname + "/views/adminroom.html");
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

  // ルーム一覧を取得
  // とりあえず全部取得
  socket.on("roomList", function (message) {
    wheredata = {
      default_flg: 1,
    };

    socket.emit("roomList", "だみー");
    /*
    findRoom(wheredata).then((rooms) => {
      // emitMessage("roomList", JSON.stringify(rooms));
      // 送信者に向かって返す
      socket.to(socket.id).emit("roomList", "rooms");
    });
    */
  });

  // ルームの新規登録
  socket.on("createroom", function (message) {
    var data = JSON.parse(message);
    const hashed_name = crypto
      .createHash("md5")
      .update(data.room_name)
      .digest("hex");
    const createData = {
      name: data.room_name,
      hashed_name: hashed_name,
      create_user_id: data.user_id,
      category_name: data.category_name,
      default_flg: 0,
    };
    createRoom(createData);
  });

  // ルームの人数追加
  // ※動作確認後、「enter」に統合しますたぶん
  socket.on("joinroom", function (message) {
    var data = JSON.parse(message);
    const createData = {
      room_id: data.room_id,
      // user_id: data.user_id, //今はuserテーブルを使わないので
      session_id: data.session_id,
    };
    createEnroll(createData);
  });
  // ルームの人数削除
  socket.on("leaveroom", function (message) {
    var data = JSON.parse(message);
    const whereData = {
      room_id: data.room_id,
      // user_id: data.user_id, //今はuserテーブルを使わないので
      session_id: data.session_id,
    };
    deleteEnroll(whereData);
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
  wheredata = {};
  findRoom(wheredata).then((rooms) => {
    return rooms;
  });
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
const PASSWORD = "Aicha_user2020";
const Sequelize = require("sequelize");
const sequelize = new Sequelize(DB_NAME, USER_NAME, PASSWORD, {
  dialect: "mysql",
});

/**
 * Userモデルクラス
 * create table users (id int primary key auto_increment, name varchar(32), created_at datetime, updated_at datetime, deleted_at datetime );
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
 create table rooms (
   id int primary key auto_increment, 
   name varchar(32), 
   hashed_name varchar(32),
   category_name varchar(32),
   category_id int,
   create_user_id int,
   default_flg int,
   createdAt datetime, updatedAt datetime, deletedAt datetime );
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
    hashed_name: {
      field: "hashed_name",
      type: Sequelize.STRING(32),
      allowNull: true,
    },
    category_name: {
      field: "category_name",
      type: Sequelize.STRING(32),
      allowNull: true,
    },
    create_user_id: {
      field: "create_user_id",
      type: Sequelize.INTEGER(11),
      allowNull: true,
    },
    default_flg: {
      field: "default_flg",
      type: Sequelize.INTEGER(11),
      allowNull: true,
    },
  },
  {
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    tableName: "rooms", //明示的にテーブル名を指定
  }
);

/**
 * Enrollモデルクラス
 */
const EnrollModel = sequelize.define(
  "enrolls",
  {
    id: {
      field: "id",
      type: Sequelize.INTEGER(11),
      primaryKey: true,
      autoIncrement: true,
    },
    roomId: {
      field: "room_id",
      type: Sequelize.INTEGER(11),
    },
    userId: {
      field: "user_id",
      type: Sequelize.INTEGER(11),
    },
    sessionId: {
      field: "session_id",
      type: Sequelize.STRING(32),
    },
  },
  {
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    tableName: "enrolls", //明示的にテーブル名を指定
  }
);

RoomModel.associate = function (models) {
  RoomModel.hasMany(models.EnrollModel, { foreignKey: "roomId" });
};
UserModel.associate = function (models) {
  UserModel.hasMany(models.EnrollModel, { foreignKey: "userId" });
};

/**
 * Userテーブルへのアクセスメソッド
 */
findUser = async function (whereData) {
  return await UserModel.findAll({
    where: whereData,
  });
};
getUser = async function (userId) {
  return await UserModel.findByPk(userId);
};
updateUser = async function (updateData, whereCondition, updateFields) {
  return await UserModel.update(updateData, {
    where: whereCondition,
    fields: updateFields,
  });
};
createUser = async function (userData) {
  return await UserModel.create(userData);
};

/**
 * Roomテーブルへのアクセスメソッド
 */
findRoom = async function (whereData) {
  return await RoomModel.findAll({
    where: whereData,
  });
};
getRoom = async function (userId) {
  return await RoomModel.findByPk(userId);
};
updateRoom = async function (updateData, whereCondition, updateFields) {
  return await RoomModel.update(updateData, {
    where: whereCondition,
    fields: updateFields,
  });
};
createRoom = async function (roomData) {
  return await RoomModel.create(roomData);
};

/**
 * Enrollテーブルへのアクセスメソッド
 */
findEnroll = async function (whereData) {
  return await EnrollModel.findAll({
    where: whereData,
  });
};
getEnroll = async function (userId) {
  return await EnrollModel.findByPk(userId);
};
updateEnroll = async function (updateData, whereCondition, updateFields) {
  return await EnrollModel.update(updateData, {
    where: whereCondition,
    fields: updateFields,
  });
};
createEnroll = async function (roomData) {
  return await EnrollModel.create(roomData);
};
deleteEnroll = async function (whereData) {
  return await EnrollModel.destroy({
    where: whereData,
  });
};

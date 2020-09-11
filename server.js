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
    user_name: request.body.user_name,
    table_id: table_id,
    table_name: request.body.table_name,
  };
  response.render("test_room.ejs", data);
});
app.get("/createroom", (request, response) => {
  const category_id = request.query.cat;
  const room_name = request.query.name;
  console.log("request:" + category_id + " / " + room_name);
  const resultData = chackAndCreateRoom(category_id, room_name);

  const result = {
    statusText: "OK",
    ok: true,
    room_name: room_name,
  };

  response.json(result);
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
app.get("/admincategory", (request, response) => {
  response.sendFile(__dirname + "/views/admincategory.html");
});
app.post("/admincategory", (request, response) => {
  var data = {
    name: request.body.category_name,
    order_no: request.body.order_no,
  };
  createCategory(data);
  response.sendFile(__dirname + "/views/admincategory.html");
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

  // カテゴリ一覧を取得
  socket.on("categoryList", function (message) {
    wheredata = {};

    findCategory(wheredata).then((categories) => {
      // 送信者に向かって返す
      socket.emit("categoryList", JSON.stringify(categories));
    });
  });

  // ルーム一覧を取得
  // とりあえず全部取得
  socket.on("roomList", function (message) {
    var dt = new Date();
    dt.setHours(dt.getHours() - 12);
    var year = dt.getFullYear();
    var month = dt.getMonth() + 1;
    var day = dt.getDate();
    var hour = dt.getHours();
    var minut = dt.getMinutes();
    var seccond = dt.getSeconds();
    const limitStr =
      year + "-" + month + "-" + day + " " + hour + ":" + minut + ":" + seccond;

    const { Op } = require("sequelize");
    wheredata = {
      createdAt: {
        [Op.gt]: limitStr,
      },
    };

    findRoom(wheredata).then((rooms) => {
      // emitMessage("roomList", JSON.stringify(rooms));
      // 送信者に向かって返す
      socket.emit("roomList", JSON.stringify(rooms));
    });
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

/**
 * 部屋を新規作成する
 */
function chackAndCreateRoom(category_id, room_name) {
  // トランザクション開始
  sequelize.transaction(async function (tx) {
    // 名前被りの確認
    await RoomModel.findAll({
      where: { name: room_name },
    }).then((roomlist) => {
      var ids = [];
      roomlist.forEach((room) => {
        ids.push(room.id);
      });
      EnrollModel.findAll({
        group: "room_id",
        where: {
          id: ids,
          // deletedAtが正しく動いてれば、削除済みのユーザはカウントしないハズ…
        },
      }).then((livingroomlist) => {
        // 入室者がいるルームが一つでもあれば、エラーで返す
        if (livingroomlist.length) {
          // Object.keys(livingroomlist)かも
          return false;
        } else {
          // 入室者がいるルームが一つもなければ、作成する
          var data = {
            name: room_name,
            category_name: "",
            category_id: category_id,
            default_flg: 0,
            create_user_id: "",
          };
          createRoom(data);
          const result = {
            statusText: "OK",
            ok: true,
            room_name: room_name,
          };
          return result;
        }
      });
    });
  });
}

/**
 * ****************************************************************************
 * DBアクセス
 *
 * ※文字コードでエラーになったとき
 * alter table posts modify title varchar(255) character set utf8;
 * alter table posts character set utf8;
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
    category_id: {
      field: "category_id",
      type: Sequelize.INTEGER(11),
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
 create table enrolls (
   id int primary key auto_increment, 
   room_id int,
   user_id int,
   session_id varchar(32),
   createdAt datetime, updatedAt datetime, deletedAt datetime );
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
    room_id: {
      field: "room_id",
      type: Sequelize.INTEGER(11),
    },
    user_id: {
      field: "user_id",
      type: Sequelize.INTEGER(11),
    },
    session_id: {
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

/**
 * Categoryモデルクラス
 create table categories (
   id int primary key auto_increment, 
   name varchar(32),
   order_no int,
   createdAt datetime, updatedAt datetime, deletedAt datetime );

   insert categories set name="世代",order_no=3;
 */
const CategoryModel = sequelize.define(
  "categories",
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
    order_no: {
      field: "order_no",
      type: Sequelize.INTEGER(11),
      allowNull: true,
    },
  },
  {
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    tableName: "categories", //明示的にテーブル名を指定
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

/**
 * Categoryテーブルへのアクセスメソッド
 */
findCategory = async function (whereData) {
  return await CategoryModel.findAll({
    where: whereData,
  });
};
getCategory = async function (categoryId) {
  return await CategoryModel.findByPk(categoryId);
};
updateCategory = async function (updateData, whereCondition, updateFields) {
  return await CategoryModel.update(updateData, {
    where: whereCondition,
    fields: updateFields,
  });
};
createCategory = async function (categoryData) {
  return await CategoryModel.create(categoryData);
};
deleteCategory = async function (whereData) {
  return await CategoryModel.destroy({
    where: whereData,
  });
};


/**
 * **********************************************************
 * ルームメンバーを管理するVue
 * **********************************************************
 */
const app = Vue.createApp({
  data() {
    return {
      members: [
        /*
        {
          user_id: "uid",
          user_name: "name1",
          timestamp: "1111111111"
        }
        */
      ],
    }

  },

  computed: {
    loginmembers: function () {
      var viewList = [];

      var date = new Date();
      var a = date.getTime();
      var nowtime = Math.floor(a / 1000);

      for (var i in this.members) {
        var member = this.members[i];

        if (Number(member.timestamp) > nowtime - 10) {
          viewList.push(member);
        }
      }
      return viewList;
    },
  },

  methods: {
    updateMemberList: function (msg) {
      var text = msg;
      const words = text.split("---");
      const user_name = words[0];
      const user_id = words[1];

      var date = new Date();
      var a = date.getTime();
      var nowtime = Math.floor(a / 1000);
      var exist_count = 0;

      // 一致するものがあったらtimestampを更新
      this.members.forEach((member, index) => {
        if (member.user_id === user_id) {
          this.members[index].timestamp = nowtime;
          exist_count++;
        }
      });

      // 新規メンバーならmemberに追加
      if (exist_count == 0) {
        const new_member = {
          user_id: user_id,
          user_name: user_name,
          timestamp: nowtime,
        };
        this.members.push(new_member);
      }
    },

    unsableUser: function (msg) {
      var text = msg;
      const words = text.split("---");
      const user_name = words[0];
      const user_id = words[1];

      // 一致するものがあったらtimestampを0にする
      this.members.forEach((member, index) => {
        if (member.user_id === user_id) {
          this.members[index].timestamp = 0;
          exist_count++;
        }
      });
    },
  },
});
const vue = app.mount('#app')

/**
 * チャットのコンテンツを制御するVue
 */
const chatApp = Vue.createApp({
  data() {
    return {
      contents: [
        {
          // id: 1,
          // text: "ルームに参加しました。左下のカメラボタンでスタートしてください。"
        }
      ]
    }
  },

  computed: {
    loginmembers: function () {
      var viewList = [];

      var date = new Date();
      var a = date.getTime();
      var nowtime = Math.floor(a / 1000);

      for (var i in this.members) {
        var member = this.members[i];

        if (Number(member.timestamp) > nowtime - 10) {
          viewList.push(member);
        }
      }
      return viewList;
    },
  },

  methods: {
    // チャットメッセージを受信したら呼ばれる
    addContent: function (msg) {
      var date = new Date();
      var a = date.getTime();
      var nowtime = Math.floor(a / 1000);
      var newMessage = {
        id: nowtime,
        text: msg,
      };
      this.contents.push(newMessage);
      // this.scrollBottom();

      this.$nextTick(function () {
        this.scrollToEnd();
      });
    },
    addContent2: function (content) {
      // できればdataとconputedViewは分けたいところだけど、
      // 混乱するので今の時点では編集してしまうことにしました。

      var data = JSON.parse(content);
      const text = data.user_name + " : " + data.message;
      var date = new Date();
      var a = date.getTime();
      var nowtime = Math.floor(a / 1000);
      var newMessage = {
        id: nowtime,
        text: text,
        chat_color: data.chat_color,
      };
      this.contents.push(newMessage);
      // this.scrollBottom();

      this.$nextTick(function () {
        this.scrollToEnd();
      });
    },
    scrollToEnd: function () {
      var container = document.getElementById("chatscrollarea");
      container.scrollTop = container.scrollHeight;
    },
  },
});
const chatVue = chatApp.mount('#chatapp')

/**
 * **********************************************************
 * ルームリストを管理するVue
 * **********************************************************
 */
const roomApp = Vue.createApp({
  data() {
    return {
      roomlist: [
        /*
        {
          room_id: "room_id",
          room_name: "room_name",
          category_name: "category_name",
          category_id: "category_id",
          enroll_count: "enroll_count"
        },
        */
      ],
      categorylist: [
        /*
        {
          category_id: "category.id",
          category_name: "category.name",
          order_no: "category.order_no",
        },
        */
      ],
      category_id: 0,
    }

  },
  computed: {
    sortedRoomlist: function () {
      if (this.category_id > 0) {
        const result = this.roomlist.filter(
          (room) => room.category_id === this.category_id
        );

        // const notExpired = result.filter((room) => room.createdAt);

        return result;
      } else {
        return [];
      }
    },
  },
  methods: {
    updateCategoryList: function (msg) {
      var categories = JSON.parse(msg);
      this.categorylist = [];
      categories.forEach((category, index) => {
        var data = {
          category_id: category.id,
          category_name: category.name,
          order_no: category.order_no,
        };
        this.categorylist.push(data);
      });
    },
    setCategory: function (id) {
      this.category_id = id;

      $(".category_li").each(function (idx, elm) {
        $(elm).removeClass("selectedCategory");
      });
      $("#categorylist_" + id).addclass("selectedCategory");
    },
    updateRoomList: function (msg) {
      var rooms = JSON.parse(msg);

      this.roomlist = [];

      rooms.forEach((room, index) => {
        var data = {
          room_id: room.room_id,
          room_name: room.name,
          category_name: room.category_name,
          category_id: room.category_id,
          // enroll_count: "enroll_count", // 人数はいったん置いておく
        };
        this.roomlist.push(data);
      });
    },
    jumpRoom: function (event) {
      const param = {
        table_name: event.target.innerText,
        user_name: $("#user_name").val(),
      };
      execPost("", param);
    },
    /**
     * データをPOSTする
     * @param String アクション
     * @param Object POSTデータ連想配列
     * 記述元Webページ http://fujiiyuuki.blogspot.jp/2010/09/formjspost.html
     * サンプルコード
     * <a onclick="execPost('/hoge', {'fuga':'fuga_val', 'piyo':'piyo_val'});return false;" href="#">POST送信</a>
     */
    execPost: function (action, data) {
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
    },
  },
});
const roomVue = roomApp.mount('#roomlist')


/**
 * ルームリストを管理するVue
var roomcreateVue = new Vue({
  el: "#roomcreate",

  data: {
    categorylist: [
    ],
    selected: "",
  },
  methods: {
    updateCategoryList: function (msg) {
      var categories = JSON.parse(msg);
      this.categorylist = [];
      categories.forEach((category, index) => {
        var data = {
          category_id: category.id,
          category_name: category.name,
          order_no: category.order_no,
        };
        this.categorylist.push(data);
      });
    },
  },
});
 */

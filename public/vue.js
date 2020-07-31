/**
 * ライブラリ読み込み
 */
const vueSeamless  = window.vueSeamlessScroll;

/**
 * ルームメンバーを管理するVue
 */
var memberVue = new Vue({
  el: "#app",

  data: {
    members: [
      /*
      {
        user_id: "uid",
        user_name: "name1",
        timestamp: "1111111111"
      }
      */
    ]
  },

  computed: {
    loginmembers: function() {
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
    }
  },

  methods: {
    updateMemberList: function(msg) {
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
          this.$set(this.members[index], "timestamp", nowtime);
          exist_count ++;
        }
      });
      
      // 新規メンバーならmemberに追加
      if(exist_count == 0){
        const new_member = {
          user_id: user_id,
          user_name: user_name,
          timestamp: nowtime
        }
        this.members.push(new_member);
      }
    },

    unsableUser: function(msg){
      var text = msg;
      const words = text.split("---");
      const user_name = words[0];
      const user_id = words[1];

      // 一致するものがあったらtimestampを0にする
      this.members.forEach((member, index) => {
        if (member.user_id === user_id) {
          this.$set(this.members[index], "timestamp", 0);
          exist_count ++;
        }
      });
    }
  }
});


/**
 * チャットのコンテンツを制御するVue
 */
var chatVue = new Vue({
  el: "#chatapp",

  data: {
    contents: [
      {
        // id: 1,
        // text: "ルームに参加しました。左下のカメラボタンでスタートしてください。"
      }
    ]
  },

  computed: {
    loginmembers: function() {
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
    }
  },

  methods: {
    // チャットメッセージを受信したら呼ばれる
    addContent: function(msg) {
      var date = new Date();
      var a = date.getTime();
      var nowtime = Math.floor(a / 1000);
      var newMessage = {
          id: nowtime,
          text: msg
        }
      this.contents.push(newMessage);
      // this.scrollBottom();
      
      var $this = this;
        Vue.nextTick(function() {
          $this.scrollToEnd();
        });
    },
    scrollToEnd: function() {    	
      var container = document.getElementById('chatscrollarea');
      container.scrollTop = container.scrollHeight;
    }
  }
});


/**
 * 
const MAX_KEEP_TIME = 300000;
const timerVue = new Vue({
  el: '#timerApp',
  data: {
    message: '',
    count :''
  },
  computed: {
    isTimeOver: function(){
      if(countDown <= 0){
        return true;
      }else{
        stopCount();
        return false;
      }
    }
  },
  methods: {
    startCount: function(){
      setInterval();
    },
    stopCount: function(){
    }
  }
})

setInterval(function () {//一秒間に一回再取得
  // ミリ秒からdurationオブジェクトを生成
  const duration = moment.duration( MAX_KEEP_TIME );

  // 日・時・分・秒を取得
  const days = Math.floor( duration.asDays());
  const hours   = duration.hours();
  const minutes = duration.minutes();
  const seconds = duration.seconds();

  //カウントダウンの結果を変数に代入
  timerVue.message = 'あと' + minutes + '分' + seconds + '秒';
}, 1000);
 */

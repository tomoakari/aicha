var vo = new Vue({
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

    }
  }
});

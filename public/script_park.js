パーク用オーバーライド


function attachVideo(id, stream) {
  let video = addRemoteVideoElement(id);
  playVideo(video, stream);
  video.volume = 1.0;

  $("#remote_video_" + id).wrap('<div class="col-1 col-12-small" id="video_container_' + id + '"/>');
  $("#remote_video_" + id).after(
    '<p class="membername" id="user_name_' + id + '">　</p>'
  );
}

// ダミーのビデオを追加する
function addBlankVideoElement(){
  $('#container').append('<div class="col-1 col-12-small blankVideo" ><img src="/assets/images/dummy.png" class="dummyvideo"/></div>');
}
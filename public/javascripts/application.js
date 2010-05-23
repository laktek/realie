$(function() {
  //spawn a new worker to notify the changes
  var change_notifier = new Worker('/public/javascripts/change_notifier.js');
  var patch_worker = new Worker('/public/javascripts/patch_worker.js');

  var get_editable_content = function(){
    editable_content = "";
    $("#editable_content").children("li").each(function(i){
      editable_content = (editable_content + $(this).text() + "\n"); 
    });
    return editable_content
  }

  function getCursorNode() {
    var cursorPos;
    if (window.getSelection) {
      var selObj = window.getSelection();
      //var selRange = selObj.getRangeAt(0);
      //cursorPos =  findNode(selObj.anchorNode.parentNode.childNodes, selObj.anchorNode) + selObj.anchorOffset;
      /* FIXME the following works wrong in Opera when the document is longer than 32767 chars */
      if(selObj.anchorNode)
        if(selObj.anchorNode.nodeName == "li")
          return selObj.anchorNode;
        else
          return selObj.anchorNode.parentNode;
      else
        return false;
    }
    // else if (document.selection) {
    //   var range = document.selection.createRange();
    //   var bookmark = range.getBookmark();
    //   /* FIXME the following works wrong when the document is longer than 65535 chars */
    //   //cursorPos = bookmark.charCodeAt(2) - 11; /* Undocumented function [3] */
    //   //alert(cursorPos);
    // }
  }

  var set_editable_content = function(field, content, highlight_color){
    console.log(content);
    content = content.replace("[hl]", "<span style='background-color:" + highlight_color + "'>")
    content = content.replace("[ehl]", "</span>")
    $.each(content.split("\n"), function(i, val){
      //if(val != ""){
        editing_line = field.children()[i];
        if(editing_line != undefined){
          //check the curosr is at current updating line
          if(editing_line == getCursorNode()){
            //update the whole line if there are changes
            if($(val).text() != "")
              $(editing_line).html(val); 
          }
          else
            $(editing_line).html(val);
        }
        else {
          field.append("<li>" + val + "</li>"); 
        }
     // }
    }) 
    patching_process_running = false;
  }

  var previous_text = get_editable_content();

  change_notifier.onmessage = function(ev){
    console.log(ev.data);
    // send the diff to server via the open socket
    if(ev.data != "send_snapshot")
      socket.send('{"type": "diff", "message":' + JSON.stringify(ev.data) + '}');
    else
      takeSnapshot();
  };

  patch_worker.onmessage = function(ev){
    patch_user_id = ev.data[0];
    changed_content = ev.data[1];

    if(changed_content!= ""){
      set_editable_content($("#editable_content"), changed_content, assigned_colors[patch_user_id]);
      previous_text = get_editable_content();
    }
  }

  // *Sending updates as users type*
  var takeDiff = function(){
    // when function is fired assign current text in editable area to a variable
    current_text = get_editable_content(); //$("#editable_content").text();
    // run the diff function with content stored in local storage, and in the current variable (run this in a worker)
    change_notifier.postMessage([previous_text, current_text]);
    //set the current text as previous text
    previous_text = current_text;
  };

  //take a snapshot of current edit
  var takeSnapshot = function(){
    socket.send('{"type": "snapshot", "message":' + JSON.stringify($("#editable_content").html()) + '}');
  };

  var testSetContent = function(){
    set_editable_content($('#editable_content'), 'hello\nim testing this');
  }

    var user_id;
  var predefined_colors = ["#FFCFEA", "#E8FF9C", "#FFCC91", "#42C0FF", "#A7FF9E", "#7DEFFF",
                           "#BABDFF", "#FFD4EB", "#AAFF75", "#FF9EAB", "#DCFF91", "#8088FF"
                          ];
  var assigned_colors = {};
  var diff_queue = [];
  var patching_process_running = false;

  //Client Socket Methods
  var socket = new WebSocket('ws://localhost:8080');
  socket.onmessage = function(ev){
    received_msg = JSON.parse(ev.data);

    switch(received_msg["channel"]){
      case "initial":
        user_id = received_msg["id"];
        for(var user_index in received_msg["users"]){
          addUser(received_msg["users"][user_index]);
        }
        break;
      case "join":
        if(received_msg["payload"]["user"] != user_id)
          addUser(received_msg["payload"]["user"]);
        break;
      case "chat":
        newChatMessage(received_msg["payload"]["user"], received_msg["payload"]["message"]);
        break;
      case "diff":
        //store the diff in a queue
        diff_queue.push({'user': received_msg["payload"]["user"], 'patch':received_msg["payload"]["message"]})
        break;
      default:
        console.log(received_msg);
    }
  }
  
  // *Receiving updates*
  var applyPatch = function(uid, patch){
    // when function is fired assign current text in editable area to a variable
    current_text = get_editable_content(); //$("#editable_content").text();
    patch_worker.postMessage([uid, patch, current_text]);
  };

  var checkForPatches = function(){
    if(diff_queue.length > 0 && patching_process_running == false) {
      current_patch = diff_queue.shift(); 
      
      if(current_patch["user"] != user_id){
        applyPatch(current_patch["user"], current_patch["patch"]);
        patching_process_running = true;
      }
    }
  }

  // set an interval to invoke taking diffs  (every 500ms)
  window.setInterval(takeDiff, 500);

  // periodically check for available patches and apply them
  window.setInterval(checkForPatches, 100);

  // TODO: highlight the changes

  var addUser = function(id){
    new_user_li = $("<li></li>");
    assigned_colors[id] = predefined_colors.pop();

    new_user_li.append("<span class='user_color' style='background-color:" + assigned_colors[id] + "; color: " + assigned_colors[id] + "'>.</span>");
    new_user_li.append("<span class='user_name'>User-" + id + "</span>");
    $("#users_list").append(new_user_li); 
  }
  
  var play_chat_sound = true;

  $("#chat_sound_control").toggle(function(){
    $(this).children("img").attr("src", "/images/chat_mute_icon.png"); 
    play_chat_sound = false;
  },
  function(){
    $(this).children("img").attr("src", "/images/chat_sound_icon.png"); 
    play_chat_sound = true;
  });

  var newChatMessage = function(uid, msg){
    chat_user = $("<span class='user' style='color:" + assigned_colors[uid] + "'>User-" + uid + "</span>")
    chat_message = $("<span class='message'>" + msg + "</span>");
    chat_timestamp = $("<span class='timestamp'>6.53am</span>");

    chat_line = $("<li class='chat_message unread'></li>");
    chat_line.append(chat_user);
    chat_line.append(chat_message);
    chat_line.append(chat_timestamp);

    $("ul#chat_messages").append(chat_line)  
    //TODO: set focus on last line added
    $(chat_line).scroll();

    //TODO: sound doesn't play in chrome
    if(play_chat_sound)
      $("#chat_alert_sound")[0].play();
  }

  var doPlayback = function(){
    //send a request to get all the diffs available
    socket.send('{"type": "playback", "message":""}');

    //clear the pad
    $("#editable_content").html("<li></li>");

  }


  $("#input_chat_message").keypress(function(ev){
    if((ev.keyCode || ev.which) == 13){
      ev.preventDefault();

      socket.send('{"type": "chat", "message":"' +  $(this).val() + '"}');
      $(this).val("");

    }
  });

  $("#pad_playback").click(function(){
    doPlayback();
    return false;     
  })

});

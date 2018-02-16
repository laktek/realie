$(function() {
  //spawn a new worker to notify the changes
  var diff_worker = new Worker('/javascripts/diff_worker.js');
  var patch_worker = new Worker('/javascripts/patch_worker.js');
  //var syntax_highlighting_worker = new Worker('/public/javascripts/syntax_highlighting_worker.js');

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
    if(highlight_color != ""){
      content = content.replace(/\[hl\]/g, "<span style='background-color:" + highlight_color + "'>")
      content = content.replace(/\[ehl\]/g, "</span>")
    }

    $.each(content.split("\n"), function(i, val){
      //if(val != ""){
        editing_line = field.children()[i];
        if(editing_line != undefined){
          //check the curosr is at current updating line
          if(editing_line == getCursorNode()){
            //update the whole line if there are changes
            if($(val).text() != ""){
             // $(editing_line).hide();
             // $(editing_line).before("<li>" + val + "</li>");
             // $(editing_line).html(val); 
            }
          }
          else{
            $(editing_line).html(val);
          }
        }
        else {
          field.append("<li>" + val + "</li>"); 
        }
     // }
    }) 
    patching_process_running = false;
  }

  var set_highlighted_content = function(field, content){
     $.each(content.split("\n"), function(i, val){
      //if(val != ""){
        editing_line = field.children()[i];
        if(editing_line != undefined){
          //check the curosr is at current updating line
          if(editing_line == getCursorNode()){
            //update the whole line if there are changes
            if($(val).text() != ""){
             // $(editing_line).hide();
             // $(editing_line).before("<li>" + val + "</li>");
             // $(editing_line).html(val); 
            }
          }
          else{
            $(editing_line).html(val);
          }
        }
        else {
          field.append("<li>" + val + "</li>"); 
        }
     // }
    }) 
    patching_process_running = false;
  }


  var previous_text = get_editable_content();

  diff_worker.onmessage = function(ev){
    var uuid = ev.data.id;
    var content = ev.data.changes;

    // send the diff to server via the open socket
    //if(ev.data != "send_snapshot")
    var line_msg = {"uuid": uuid, "content": content };
    socket.send('{ "type": "modify_line", "message": ' + JSON.stringify(line_msg) + '}');
  };

  patch_worker.onmessage = function(ev){
    var patching_uuid = ev.data[0];
    var patch_user_id = ev.data[1];
    var changed_content = ev.data[2];
    var modifying_line = $("[data-uuid=" + patching_uuid + "]");

    if(changed_content != ""){
      $(modifying_line).html(changed_content);

      //highlight the line
      highlightUserEdit(modifying_line, patch_user_id);
      
      //apply syntax highlighting 
      applySyntaxHighlighting(modifying_line);
      
      //update the stored line in hash
      stored_lines[patching_uuid] = {"content": changed_content}
    }
  }

  var user_id;
  var predefined_colors = ["#FFCFEA", "#E8FF9C", "#FFCC91", "#42C0FF", "#A7FF9E", "#7DEFFF",
                           "#BABDFF", "#FFD4EB", "#AAFF75", "#FF9EAB", "#DCFF91", "#8088FF"
                          ];
  var assigned_colors = {};
  var update_queue  = [];
  var updating_process_running = false;
  var playback_mode = false;
  var take_diffs = true;
  var stored_lines = {};

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

         // periodically check for available updates and apply them
         window.setInterval(checkForUpdates, 100);

         // periodically send the content for syntax highlighting
         window.setInterval(inspectLineChanges, 99);

         break;
       case "join":
         if(received_msg["payload"]["user"] != user_id)
           addUser(received_msg["payload"]["user"]);
         break;
       case "leave":
         removeUser(received_msg["payload"]["user"]);
         break;
       case "chat":
         update_queue.push(received_msg);
         break;
       case "add_line":
         //store the update in the queue
         update_queue.push(received_msg);
         break;
       case "modify_line":
         //store the update in the queue
         update_queue.push(received_msg);
         break;
       case "remove_line":
         //store the update in the queue
         update_queue.push(received_msg);
         break;
       case "playback_done":
         //store the update in the queue
         update_queue.push(received_msg);
         break;

       default:
         console.log(received_msg);
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
    socket.send('{"type": "snapshot", "message":' + JSON.stringify(get_editable_content()) + '}');
  };

  var testSetContent = function(){
    set_editable_content($('#editable_content'), 'hello\nim testing this');
  }

  //do the updates sequentially. 
  //updates are stored in a stack.
  var checkForUpdates = function(){
   if(update_queue.length > 0 && updating_process_running == false) {
     var current_update = update_queue.shift(); 

     if(current_update["channel"] != "chat"){
       if(!playback_mode && (current_update["payload"]["user"] == user_id))
         return false;
     }

     updating_process_running = true;
     applyUpdate(current_update["channel"], current_update["payload"]);
   }
  }

  // perform received updates to the pad
  // should send the action to perform - add line, modify line or remove line
  // also all update parameters enclosed in a hash
  var applyUpdate = function(action, update){
     switch(action){
       case "add_line":
         addLine(update);
         break;
       case "modify_line":
         modifyLine(update);
         break;
       case "remove_line":
         removeLine(update);
         break;
       case "playback_done":
         playback_mode = false;
         break;
       case "chat":
         newChatMessage(update["user"], update["message"]);
         break;
       default:
         console.log("invalid update");
      };
    // when function is fired assign current text in editable area to a variable
    //current_text = get_editable_content(); //$("#editable_content").text();
    //patch_worker.postMessage([uid, patch, current_text]);
  };

  //To add a line we need:
  //it's uuid, previous line uuid and next line uuid and content 
  var addLine = function(payload){
    content = payload["message"]["content"];
    //new line html
    var new_line = $("<p data-uuid='" + payload["message"]["uuid"] + "'>" + content + "</p>");

    //find the line with next uuid
    var next_line = $("[data-uuid =" + payload["message"]["next_uuid"] + "]");
    var previous_line = $("[data-uuid =" + payload["message"]["previous_uuid"] + "]");

    if(next_line.length > 0){
      //insert before next uuid
      next_line.before(new_line);
    }
    //else find the line with previous uuid
    else if(previous_line.length > 0){
      //insert after previous uuid
      previous_line.after(new_line);
    }
    else {
      // insert as the first line
      $("div#editable_content div").append(new_line)
    }

    //highlight the line
    highlightUserEdit(new_line, payload["user"]);

    //apply syntax highlighting 
    applySyntaxHighlighting(new_line);
     
    //update the stored line in hash
    stored_lines[payload["message"]["uuid"]] = {"content": payload["message"]["content"]};

    updating_process_running = false;
  };

  //To modify a line we need:
  // the uuid of the line and diff
  var modifyLine = function(payload){
    //find the line with uuid
    var uuid = payload["message"]["uuid"];
    var user_id = payload["user"];
    var patch = payload["message"]["content"];

    var current_text = $("[data-uuid=" + uuid + "]").text();

    // send the uuid, line content and diff to patch worker
    patch_worker.postMessage({"uuid": uuid, "patch": patch, 
                              "current_text": current_text, "user_id": user_id });
    updating_process_running = false;
  };

  //To remove a line we need:
  // the uuid of the line
  var removeLine = function(payload){
    //find the line with uuid
    var uuid = payload["message"]["uuid"];
    var user_id = payload["user"];
    var line = $("[data-uuid=" + uuid + "]");

    //highlight the line
    highlightUserEdit(line, payload["user"], function(){
      // remove the line from the pad
      line.remove();
      delete stored_lines[uuid];
    });

       updating_process_running = false;
  };

  var highlightUserEdit = function(line, user, callback){
    line.animate({ backgroundColor: assigned_colors[user] }, 'fast')
        .animate({ backgroundColor: "#FFFFFF" }, 'slow');

    if(callback)
      callback.call();
  };

  $("#editable_content").keydown(function(ev){
      //don't delete the beyond p
      if(ev.keyCode == 8 || ev.keyCode == 46){
        var editing_lines = $("#editable_content").children("div").children("p");
        if(editing_lines.length == 1 && $(editing_lines[0]).html() == ""){
          $(editing_lines[0]).html("&nbsp;"); 
          return false;
        }
      }
  });


  var generateUUID = function(){
    //get the pad id
    var padid = "1";
    
    //get the user id
    var userid = user_id;

    //get the current timestamp (in UTC)
    var d = new Date();
    var timestamp = $.map([d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
                     d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()], 
                     function(n, i){
                      return (n < 10) ? "0"+n : n; 
                     }).join("");

    //combine them and generate the UUID
    //format: padid_userid_timestamp
    return padid + "_" + userid + "_" + timestamp;
  };

  var setCaretPosition = function(elem, caretPos) {
      //var elem = document.getElementById(elemId);

      if(elem != null) {
          if(document.createRange) {
              var range = document.createRange();
              range.setStart(elem, 1);
              //range.setEnd(elem, 1);
              //range.move('character', caretPos);
              //range.select();
              console.log("change caret")
          }
          else {
              if(elem.selectionStart) {
                  elem.focus();
                  elem.setSelectionRange(caretPos, caretPos);
              }
              else
                  elem.focus();
          }
      }
  };

  var applySyntaxHighlighting = function(line){
    //get the uuid of the line
    //(jquery confuses the lines when the content changes, we can avoid it by explicitly calling the line id)
    var line_id = "[data-uuid=" + $(line).attr("data-uuid") + "]";

    //keep checking whether the line is still edited by user
    $(line_id).everyTime(500, function(){
      if(window.getSelection){
        var selObj = window.getSelection();
        var selParent = (selObj.anchorNode && selObj.anchorNode.parentNode);
        var thisLine = $(line_id);

        //if the line is or its child elements are currently focused;
        //done attempt to highlight 
        if(thisLine[0] == selParent || $.contains(thisLine[0], selParent)){
          // var last_cursor_pos = selObj.anchorOffset;
          // var highlighted_node = prettyPrintOne(selObj.anchorNode.textContent.substr(0, last_cursor_pos));
          // $(selParent).html(highlighted_node);

          // setCaretPosition($(selParent).children()[0], 1);

          // $(selParent).children().each(function(){
          //   if($(this).text().length >= last_cursor_pos)
          //     setCaretPosition(this, last_cursor_pos);
          //   else
          //     last_cursor_pos -= $(this).text().length
          // });


          //selParent.insertBefore(highlighted_node, selObj.anchorNode);
          //selObj.anchorNode.textContent = selObj.anchorNode.textContent.slice(0, selObj.anchorOffset-1) ;

          return false
        }
        //if the cursor is not on the line;
        //apply syntax highlighting;
        //stop this timer loop
        else {
          thisLine.html(prettyPrintOne(thisLine.text()));
          $(this).stopTime();
        }
      }
    });
  }

  var inspectLineChanges = function(i){
    //get all lines inside editable area
    var editable_lines = $("#editable_content").children("div").children("p");

    removed_lines_uuids = [];
    //first get the uuids of all the stored lines in to an array
    for(var line_uuid in stored_lines){
      removed_lines_uuids.push(line_uuid); 
    }

    //iterate throught all lines in the editable area
    editable_lines.each(function(i){
      //get the uuid of the line
      var uuid = $(this).attr('data-uuid');
      var prev_uuid = $(this).prev('p').attr('data-uuid') || '';
      var next_uuid = $(this).next('p').attr('data-uuid') || '';
      var content = $(this).text();

      //is this a newly added line?
      //all previously stored lines will have a unique uuid 
      //when a new line is added browser copies the attributes of the previous line as is
      //also a new line could be without a uuid (first line & pasted lines)
      if(uuid == undefined || uuid == prev_uuid){
        //this is a newly added line

        //give it a new id
        $(this).attr('id', "line" + editable_lines.length);
        
        //give it a new uuid
        new_uuid =  generateUUID();
        $(this).attr('data-uuid', new_uuid);

        //apply syntax highlighting 
        applySyntaxHighlighting(this);
        
        //store it in the hash
        stored_lines[new_uuid] = {"content": content}
        
        //send 'add line' message to server
        var line_msg = { "uuid": new_uuid, "previous_uuid": prev_uuid, "next_uuid": next_uuid, "content": content }
        socket.send('{"type": "add_line", "message":' + JSON.stringify(line_msg) + '}');
      }

      else {
        //check whether this exisiting line was updated 
        if(stored_lines[uuid].content.length != $(this).text().length ||
            stored_lines[uuid].content != $(this).text()){

          //send off to diff worker to take the diff and update the server
          diff_worker.postMessage([uuid, stored_lines[uuid].content, $(this).text()]);

          //update the stored line in hash
          stored_lines[uuid] = {"content": $(this).text()}
          
          //re-apply syntax highlighting
          applySyntaxHighlighting(this);
        }

        //uncheck this lines uuid from removed lines array
        removed_lines_uuids.splice(removed_lines_uuids.indexOf(uuid), 1);
      }
    });

    //work with deleted lines
    if(removed_lines_uuids.length > 0){
      //iterate through the stale uuids
      $.each(removed_lines_uuids, function(){
        //remove the line from hash
        delete stored_lines[this];

        //send 'remove line' message to server
        var line_msg = {"uuid": this}
        socket.send('{"type": "remove_line", "message":' + JSON.stringify(line_msg) + '}');
      });
    }
  }

  var workOnDirtyNodes = function(){
    $("#editable_content").children("div").children("p").each(function(i){
        //add the new element to array
        if(dirty_nodes[i] == undefined){
          addToDirtyNodes(i, this)
        }
        //update existing element
        else if(dirty_nodes[i].content.length != $(this).text().length ||
                dirty_nodes[i].content != $(this).text()){
            addToDirtyNodes(i, this)
        }
    });
  }

  var addToDirtyNodes = function(index, node){
    var node_id = "line"+index;
    $(node).attr("id", node_id );

    //call highlight function
    $("#" + node_id).everyTime(500, function(){
      if(window.getSelection){
        var selObj = window.getSelection();
        var selParent = (selObj.anchorNode && selObj.anchorNode.parentNode);
        var thisLine = $("#" + node_id);

        if(thisLine[0] == selParent || $.contains(thisLine[0], selParent)){
          return false
        }
        else {
          thisLine.html(prettyPrintOne(thisLine.text()));
          $(this).stopTime();
        }
      }
    });

    //calculate the diff
    diff_worker.postMessage([node_id, (dirty_nodes[index] ? dirty_nodes[index].content : ""), $(node).text()]);

    //add to array
    dirty_nodes[index] = {"id": node_id, "content": $(node).text()}
  }

  // set an interval to invoke taking diffs  (every 500ms)
  //window.setInterval(takeDiff, 500);

  var addUser = function(id){
    var new_user_li = $("<li id='user-" + id + "'></li>");
    assigned_colors[id] = predefined_colors.pop();

    new_user_li.append("<span class='user_color' style='background-color:" + assigned_colors[id] + "; color: " + assigned_colors[id] + "'>.</span>");
    new_user_li.append("<span class='user_name'>User-" + id + "</span>");
    $("#users_list").append(new_user_li); 
  };

  var removeUser = function(id){
    $("li#user-" + id).remove();
  };
  
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

    //turn on the playback mode
    playback_mode = true;

    //clear everything (pad, chat, users) 
    $("#editable_content div").html("");
    stored_lines = {};
    $("ul#chat_messages").html("");
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

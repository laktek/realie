var sys = require("sys");
var ws = require('./vendor/node-websocket-server/lib/ws');
var redis = require("./vendor/redis-node-client/lib/redis-client");

function log(data){
  sys.log("\033[0;32m"+data+"\033[0m");
}

var user_count = 0;
var main_store = redis.createClient();

var server = ws.createServer({ debug: true });

server.addListener("listening", function(){
  log("Listening for connections.");
});

server.addListener("request", function(req, res){
  res.writeHead(200, {"Content-Type": "text/plain"});
  res.write("Chat Server");
  res.end();
});

// Handle WebSocket Requests
server.addListener("connection", function(conn){
  log("opened connection: "+conn.id);
  
  //server.send(conn.id, "Connected as: "+conn.id);
  //conn.broadcast("<"+conn.id+"> connected");

  var self = conn;

  conn.redis_subscriber = redis.createClient(); 
  conn.redis_publisher = redis.createClient(); 

  conn.redis_subscriber.subscribeTo("*",
    function (channel, message, subscriptionPattern) {
      var output = '{"channel": "' + channel + '", "payload": ' + message + '}';
 
       //sys.puts(output);
       conn.write(output);
  });

  current_user_id = conn.user_id = ++user_count;

  //store the current user's id on global store
  main_store.rpush('pad-users', conn.user_id, function(err, reply){
    main_store.lrange('pad-users', 0, -1, function(err, values){
      conn.write('{"channel": "initial", "id":' + current_user_id + ', "users":[' + values + '] }');
         
         //send all the exisiting diff messages
         // main_store.lrange('pad-diff', 0, -1, function(err, messages){
         //   for(var msg_id in messages){
         //     conn.write('{"channel": "diff", "payload": ' + messages[msg_id] + '}');
         //   }
         // });
         //
 
         main_store.lrange('pad-chat', 0, -1, function(err, messages){
           for(var msg_id in messages){
             conn.write('{"channel": "chat", "payload": ' + messages[msg_id] + '}');
           }
         });
 
         //publish the message when joining
         conn.redis_publisher.publish("join", JSON.stringify({"user": conn.user_id}),
         function (err, reply) {
           sys.puts(err);
           sys.puts("Published message to " +
           (reply === 0 ? "no one" : (reply + " subscriber(s).")));
         });
    });  
  });
  
  conn.addListener("message", function(raw_message){
     log(conn.id + ": "+JSON.stringify(raw_message));
    
     message_obj = JSON.parse(raw_message);
     channel = message_obj["type"];
     message = message_obj["message"];
     timestamp = new Date().getTime();
     serialized_message = JSON.stringify({"user": this.user_id, "message": message, "timestamp": timestamp, "channel": channel });
 
     //store snapshot
    if(channel == "snapshot"){
       sys.puts(serialized_message);
       main_store.set('pad-snapshot', serialized_message, function(){});
     }
     //send all the exisiting diff messages
     else if(channel == "playback"){
       main_store.lrange('pad-1', 0, -1, function(err, messages){
         for(var msg_id in messages){
           log(messages[msg_id]);
           var parsed_msg = JSON.parse(messages[msg_id]); //this is a dirty hack REMOVE!
           conn.write('{"channel":"' + parsed_msg['channel'] + '", "payload": ' + messages[msg_id] + '}');
         }

         //once all messages sent, send a playback complete message
         conn.write('{"channel": "playback_done", "payload": "" }');
       });
     }
     else {
       conn.redis_publisher.publish(channel, serialized_message,
         function (err, reply) {
           sys.puts("Published message to " +
             (reply === 0 ? "no one" : (reply + " subscriber(s).")));
           //store the messages on main store
           main_store.rpush('pad-1', serialized_message, function(err, reply){});
       });
     }
  });

});

server.addListener("close", function(conn){
  log(conn.id + ": onClose");
   
   //publish a message before leaving 
   conn.redis_publisher.publish("leave", JSON.stringify({"user": conn.user_id}),
     function (err, reply) {
       sys.puts(err);
       sys.puts("Published message to " +
         (reply === 0 ? "no one" : (reply + " subscriber(s).")));
   });
     
   conn.redis_publisher.close();
   conn.redis_subscriber.close();
});

server.listen(8090);

// old web-socket listeners
// server.addListener("client", function(conn){
//   log(conn._id + ": new connection");
//   
// 
//   conn.addListener("readyStateChange", function(readyState){
//     log("stateChanged: "+readyState);
//   });
//   
//   conn.addListener("open", function(){
//     log(conn._id + ": onOpen");
//     o = this;
// 
//     o.redis_subscriber = redis.createClient(); 
//     o.redis_publisher = redis.createClient(); 
// 
//     o.redis_subscriber.subscribeTo("*",
//       function (channel, message, subscriptionPattern) {
//         var output = '{"channel": "' + channel + '", "payload": ' + message + '}';
// 
//         sys.puts(output);
//         conn.write(output);
//     });
// 
//     current_user_id = o.user_id = ++user_count;
// 
//     //store the current user's id on global store
//     main_store.rpush('pad-users', o.user_id, function(err, reply){
//       main_store.lrange('pad-users', 0, -1, function(err, values){
//         conn.write('{"channel": "initial", "id":' + current_user_id + ', "users":[' + values + '] }');
//         
//         //send all the exisiting diff messages
//         // main_store.lrange('pad-diff', 0, -1, function(err, messages){
//         //   for(var msg_id in messages){
//         //     conn.write('{"channel": "diff", "payload": ' + messages[msg_id] + '}');
//         //   }
//         // });
//         //
// 
//         // main_store.get('pad-snapshot', function(err, reply){
//         //   if(reply)
//         //     conn.write('{"channel": "snapshot", "payload": ' + reply + '}');
//         // });
// 
//         main_store.lrange('pad-chat', 0, -1, function(err, messages){
//           for(var msg_id in messages){
//             conn.write('{"channel": "chat", "payload": ' + messages[msg_id] + '}');
//           }
//         });
// 
//         //publish the message when joining
//         o.redis_publisher.publish("join", JSON.stringify({"user": o.user_id}),
//         function (err, reply) {
//           sys.puts("Published message to " +
//           (reply === 0 ? "no one" : (reply + " subscriber(s).")));
//         });
//       });  
//     });
//   });
//   
//   conn.addListener("close", function(){
//     var c = this;
//     log(c._id + ": onClose");
//   
//     //publish a message before leaving 
//     this.redis_publisher.publish("leave", JSON.stringify({"user": this.user_id}),
//       function (err, reply) {
//         sys.puts("Published message to " +
//           (reply === 0 ? "no one" : (reply + " subscriber(s).")));
//     });
//     
//     this.redis_publisher.close();
//     this.redis_subscriber.close();
//   });
//   
//   conn.addListener("message", function(raw_message){
//     log(conn._id + ": "+JSON.stringify(raw_message));
//    
//     message_obj = JSON.parse(raw_message);
//     channel = message_obj["type"];
//     message = message_obj["message"];
//     timestamp = new Date().getTime();
//     serialized_message = JSON.stringify({"user": this.user_id, "message": message, "timestamp": timestamp });
// 
//     //store snapshot
//     if(channel == "snapshot"){
//       sys.puts(serialized_message);
//       main_store.set('pad-snapshot', serialized_message, function(){});
//     }
//     //send all the exisiting diff messages
//     else if(channel == "playback"){
//       main_store.lrange('pad-diff', 0, -1, function(err, messages){
//         for(var msg_id in messages){
//           log(messages[msg_id]);
//           conn.write('{"channel": "diff", "payload": ' + messages[msg_id] + '}');
//         }
//       });
//     }
//     else {
//       this.redis_publisher.publish(channel, serialized_message,
//         function (err, reply) {
//           sys.puts("Published message to " +
//             (reply === 0 ? "no one" : (reply + " subscriber(s).")));
//           //store the messages on main store
//           main_store.rpush('pad-' + channel, serialized_message, function(err, reply){});
//       });
//     }
//   });
// });

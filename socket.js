var sys = require("sys");
var ws = require('./vendor/node-websocket-server/lib/ws');
var redis = require("./vendor/redis-node-client/lib/redis-client");

function log(data){
  sys.log("\033[0;32m"+data+"\033[0m");
}

var user_count = 0;
var gatekeeper = redis.createClient();

var server = ws.createServer();
server.listen(8080);

server.addListener("request", function(req, res){
  res.writeHead(200, {"Content-Type": "text/plain"});
  res.write("Chat Server");
  res.end();
});

server.addListener("client", function(conn){
  log(conn._id + ": new connection");
  

  conn.addListener("readyStateChange", function(readyState){
    log("stateChanged: "+readyState);
  });
  
  conn.addListener("open", function(){
    log(conn._id + ": onOpen");
    o = this;

    o.redis_subscriber = redis.createClient(); 
    o.redis_publisher = redis.createClient(); 

    o.redis_subscriber.subscribeTo("*",
      function (channel, message, subscriptionPattern) {
        var output = '{"channel": "' + channel + '", "payload": ' + message + '}';

        sys.puts(output);
        conn.write(output);
    });

    current_user_id = o.user_id = ++user_count;

    //store the current user's id on global store
    gatekeeper.rpush('pad-users', o.user_id, function(err, reply){
      gatekeeper.lrange('pad-users', 0, -1, function(err, values){
        conn.write('{"channel": "initial", "id":' + current_user_id + ', "users":[' + values + '] }');

        //publish the message when joining
        o.redis_publisher.publish("join", JSON.stringify({"user": o.user_id}),
        function (err, reply) {
          sys.puts("Published message to " +
          (reply === 0 ? "no one" : (reply + " subscriber(s).")));
        });
      });  
    });
  });
  
  conn.addListener("close", function(){
    var c = this;
    log(c._id + ": onClose");
  
    //publish a message before leaving 
    this.redis_publisher.publish("leave", JSON.stringify({"user": this.user_id}),
      function (err, reply) {
        sys.puts("Published message to " +
          (reply === 0 ? "no one" : (reply + " subscriber(s).")));
    });
    
    this.redis_publisher.close();
    this.redis_subscriber.close();
  });
  
  conn.addListener("message", function(raw_message){
    log(conn._id + ": "+JSON.stringify(raw_message));
   
    message_obj = JSON.parse(raw_message);
    channel = message_obj["type"];
    message = message_obj["message"];

    this.redis_publisher.publish(channel, JSON.stringify({"user": this.user_id, "message": message}),
      function (err, reply) {
        sys.puts("Published message to " +
          (reply === 0 ? "no one" : (reply + " subscriber(s).")));
    });
  });
});

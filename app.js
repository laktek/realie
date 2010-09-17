require.paths.unshift('./vendor/express/lib')
require.paths.unshift('./vendor/express/support')
var sys = require('sys')
//require('./vendor/express/lib/express')
//require('express/plugins')
var redis = require("./vendor/redis-node-client/lib/redis-client");
//var app = require('express').createServer();

var express = require('express');
var app = express.createServer();

//app.set('root', __dirname)
app.configure(function(){
  app.use(express.logger())
  app.use(express.methodOverride())


    app.use(express.methodOverride());
    app.use(express.bodyDecoder());
    app.use(app.router);
    app.use(express.staticProvider(__dirname + '/public'));
    //app.use(express.cookie)
  /*
  app.use(express.contentLength)

  app.use(Cache, { lifetime: (5).minutes, reapInterval: (1).minute })
  app.use(Session, { lifetime: (15).minutes, reapInterval: (1).minute })
  app.use(Static)

	*/
 
})

var main_store = redis.createClient();
//app.set('views', __dirname + '/views');


app.get('/', function(req, res){
  //self = this;
  main_store.get('pad-snapshot', function(err, reply){
      if(reply){
        sys.puts(JSON.parse(reply.toString('utf8'))["message"]);
        sys.puts("parsed");
        var reply_lines = JSON.parse(reply.toString('utf8'))["message"].split("\n"); 
        var html_lines = [];
        for(var line_no in reply_lines){
          html_lines.push("<div>" + reply_lines[line_no] + "</div>"); 
        }
        var snapshot_html = html_lines.join("");
      }
      else 
        var snapshot_html = "";



      res.render('pad.html.ejs', {
        encoding: 'utf8',
        locals: {
          snapshot: snapshot_html,
        }
      });
  });
});


app.listen(3000)


require.paths.unshift('./vendor/express/lib')
var sys = require('sys')
require('express')
require('express/plugins')
var redis = require("./vendor/redis-node-client/lib/redis-client");

configure(function(){
  use(Logger)
  use(MethodOverride)
  use(ContentLength)
  use(Cookie)
  use(Cache, { lifetime: (5).minutes, reapInterval: (1).minute })
  use(Session, { lifetime: (15).minutes, reapInterval: (1).minute })
  use(Static)
  set('root', __dirname)
})

var main_store = redis.createClient();

get('/pad', function(){
  self = this;
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


      self.render('pad.html.ejs', {
        encoding: 'utf8',
        locals: {
          snapshot: snapshot_html,
        }
      });
  });
});

run()


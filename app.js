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
      var snapshot_html = reply || "<li></li>";

      self.render('pad.html.ejs', {
        locals: {
          snapshot: snapshot_html,
        }
      });
  });
});

run()


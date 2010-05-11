require.paths.unshift('./vendor/express/lib')
var sys = require('sys')
require('express')
require('express/plugins')

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

get('/pad', function(){
  this.render('pad.html.ejs')
//  return '<h1>Welcome To Express</h1>'
})

run()


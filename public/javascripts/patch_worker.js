importScripts('diff_match_patch_uncompressed.js');

onmessage = function(ev){
  //parsed_data = JSON.parse(ev.data);
  var dmp = new diff_match_patch();
  
  var uuid = ev.data["uuid"];
  var uid = ev.data["user_id"]
  var patch = ev.data["patch"];
  var current_text = ev.data["current_text"];

  //apply the patch
  //var results = dmp.patch_apply_with_highlight(patch, current_text);
  var results = dmp.patch_apply(patch, current_text);

  // set passed data to local storage
  postMessage([uuid, uid, results[0]]);
}

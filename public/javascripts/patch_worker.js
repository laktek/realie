importScripts('diff_match_patch_uncompressed.js');

onmessage = function(ev){
  //parsed_data = JSON.parse(ev.data);
  var dmp = new diff_match_patch();
  
  uid = ev.data[0]
  patch = ev.data[1];
  current_text = ev.data[2];

  //apply the patch
  var results = dmp.patch_apply_with_highlight(patch, current_text);
  //var results = dmp.patch_apply(patch, ct);

  // set passed data to local storage
  postMessage([uid, results[0]]);
}

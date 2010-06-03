importScripts('diff_match_patch_uncompressed.js');

var sentDiffs = 0;
onmessage = function(ev){
  var dmp = new diff_match_patch();
  var previous_text = ev.data[0];
  var current_text = ev.data[1];
  var highlight_color = ev.data[2];

  //take the diff
  var diff = dmp.diff_main(previous_text, current_text);

  if (diff.length > 2) {
     dmp.diff_cleanupSemantic(diff);
   //  dmp.diff_cleanupEfficiency(diff);
  }

  var patch_list = dmp.patch_make(previous_text, current_text, diff);

  // pass the patch back to main thread 
  if(patch_list.length > 0){
    postMessage(patch_list);
    sentDiffs += 1;
  }
  else
    if(sentDiffs > 1){
      postMessage("send_snapshot");
      sentDiffs = 0;
    }
}

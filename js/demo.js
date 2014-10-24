//var CMS_URL = 'http://bemis.l/'; //socha dev
//var CMS_URL = 'http://192.168.0.246/bemis-cms/'; //zebradog dev
var CMS_URL = 'http://dev-bemis.gotpantheon.com/'; //dev server
//var CMS_URL = 'http://live-bemis.gotpantheon.com/'; //live server

var CONTENT_UPDATE_INTERVAL = 3*1000;

if (typeof zdol === 'undefined') {
  console.log('The zdol library is missing.');
  jQuery('body').html('The zdol library is missing.');
}

var bemis = {
  content_update_interval: CONTENT_UPDATE_INTERVAL, // default 5 minutes, can change in closure below

};

bemis.begin_content_update_heartbeat = function() {
   bemis.content_update_interval_handle = setInterval(bemis.refresh_local_content, bemis.content_update_interval);
};

bemis.refresh_local_content = function() {
  var timestamp = Math.round(new Date().getTime() / 1000);
  var last = timestamp - (bemis.content_update_interval / 1000);
  zdol.refresh_content(last);
  zdol_node_db.allDocs({include_docs:true}, function(err, result) {
     console.log(result);
  });

};

bemis.update_product_list_display = function() {
  zdol_node_db.allDocs({include_docs:true}, function(err, result) {
    var container = jQuery('.products');
    container.html('');
    _.each(result.rows, function(record, key) {
      var node = record.doc;
      if (node.type == 'product_type') {
        var newhtml = '<li>';
        newhtml += '<img src="' + zdolfs.LOCAL_FILE_BASEURL + node.image.filename + '" width="64" /> ';
        newhtml += node.title + '</li>';
        container.append(newhtml);
      }
    });
  });
};


(function(){
  
  zdol.content_urlbase = CMS_URL;
  
  bemis.begin_content_update_heartbeat();
  
  // try to update immediately upon load, since we have no reference for the 
  // last time we checked
  zdol.refresh_content(0);
  bemis.update_product_list_display();
  
})();


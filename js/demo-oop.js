

(function(){
  
  // Get a ZDOL instance and tell it to get to work
  var bemis_zdol = new ZDOL({
    api_url: 'http://live-bemis.gotpantheon.com/rest/products',
    collection: 'products',
    filesystem_reserve: 5000 * 1024 * 1024,
    update_immediately: true,
    auto_update: true,
    auto_update_interval: 10 * 1000,
    image_fields:['image','content-image']
  });
  
  // Load all products into the DOM
  bemis_zdol.db.allDocs({include_docs:true}, function(err, result) {
    var container = jQuery('.products');
    container.html('');
    _.each(result.rows, function(record, key) {
      var node = record.doc;
      container.append('<li><img src="' + node.image + '" width="64" />' + node.title + '</li>');
    });
  });
  
})();
(function(){

  // Get a Alone instance and tell it to get to work
  var myAlone = new Alone({
    api_url: 'http://live-bemis.gotpantheon.com/rest/products',
    collection: 'products',
    collection_reserve: 50,
    filesystem_reserve: 5000 * 1024 * 1024,
    update_immediately: true,
    auto_update: true,
    auto_update_interval: 10 * 1000,
    image_fields:['image','content-image']
  });

  //
  // Register some demo listeners.
  //

  // collection_initialized
  // Event fires after PouchDB sets up the local datastore.  Callback will
  // receive an object with a few properties of the collection, of which
  // doc_count is probably most useful (if zero, this is probably a new db).
  myAlone.on('collection_initialized', function(info) {
      console.log('Collection initialized.  Some info:');
      console.log(info);
  });

  // update_started
  // Fires when the heartbeat refresh_content method begins to do work.
  myAlone.on('update_started', function() {
      console.log('update_started event fired');
  });

  // update_complete
  // Fires after a full run of the "heartbeat" refresh_content method. Callback
  // will receive an array of all new/updated records fetched.
  myAlone.on('update_complete', function(data) {
    if (!_.isArray(data) || data.length < 1) {
      console.log('Update run complete. No new data since the previous run.');
    } else {
      console.log('Update run complete. ' + data.length + ' records fetched:');
      console.log(data);
    }
  });

  // download_initialized
  // Fires when a file download is about to be attempted
  myAlone.on('download_initialized', function(filename) {
      console.log('Download of ' + filename + ' requested.');
  });

  // download_complete
  // Fires when a file has been downloaded to browser Alone, but not yet stored
  // in local file system.
  myAlone.on('download_complete', function(filename) {
      console.log('Download of ' + filename + ' (to tmp) is complete.');
  });

  // download_stored
  // Fires when file has been successfully stored to the local file system.
  myAlone.on('download_stored', function(filename) {
      console.log(filename + ' has been stored locally.');
  });

  // Now, just to make the demo actually do something...
  // Load all products into the DOM
  myAlone.db.allDocs({include_docs:true}, function(err, result) {
    var container = jQuery('.products');
    container.html('');
    container.append('<li>All data loaded from local store.</li>');
    _.each(result.rows, function(record, key) {
      var node = record.doc;
      container.append('<li><img src="' + node.image + '" width="64" />' + node.title + '</li>');
    });

    if (result.total_rows == 0) {
      container.append('<li>Local cache rebuilding.  This page will refresh in 5 seconds.</li>');
      setTimeout(function() {
        location.reload();
      }, 5000);
    }
  });

})();

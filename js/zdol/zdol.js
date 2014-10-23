/**
 * ZD offline mgmt.  Provides functions for loading content into local 
 * storage so that it can be loaded offline.
 * 
 * Generally, this file should be the same for all sites implementing the 
 * offline strategy.  A separate js file should be used to implement these
 * methods.
 */

// setup pouchdb
var zdol_node_db = new PouchDB('node', {size: 50});
PouchDB.replicate(false);

// init the zdol obj with core properties
var zdol = {
  content_urlbase: ''
};


/**
 * Refresh all content from Drupal CMS
 * @param int since - timestamp (in seconds, not milliseconds) of last update
 * 
 * @todo This method currently has no way to detect nodes that have been deleted
 * from Drupal.  Nodes will remain in the PouchDB FOREVER.  Until removed in
 * console.
 */
zdol.refresh_content = function(since) 
{
  if (_.isUndefined(since)) {
    since = 0;
  }
  jQuery.getJSON(zdol.content_urlbase + 'zdhl/changednodes/' + since + "?callback=?")
    .done(function( data ) {
      var node_count = 0;

      // iterate over all nodes returned by Drupal
      jQuery.each(data, function(index, node) {
        node._id = node.nid;

        // query for nid. If exists, update; if not, insert.
        zdol_node_db.get(node.nid, function(err, doc) {
          if (err) {
            if (err.status == 404) {
              // node is new.  Insert it.
              zdol_node_db.put(node, function callback(err, result) {
                if (!err) {
                  node_count++;
                } else {
                  console.log(err);
                }
              });
            } else {
              console.log(err);
            }
          } else {
            // node exists.  Update it.
            node._rev = doc._rev;
            zdol_node_db.put(node, function callback(err, result) {
              if (!err) {
                node_count++;
              } else {
                console.log(err);
              }
            });
          }

        });
        
        // File is now added/updated in pouchdb.  Next, we want to update 
        // The image file, if there is one.
        // 
        // @todo Find a way to make this more generic so it can support 
        // different media types, Drupal field names, etc.  For this iteration,
        // we check for a field called "image" in a node and cache that to 
        // local filesystem.
        if (!_.isUndefined(node.image)) {
          var url = zdol.content_urlbase + 'zdhl/file/' + node.image.fid;
          zdolfs.loadImageToFileSystem(url, node.image.filename, function(){});
        }
      });
    })
    .fail(function(jqxhr, textStatus, error) {
      console.log('Could not contact CMS for content update. Either this browser is offline or the CMS site is unreachable.');
    });
}; // end zdol.refresh_content
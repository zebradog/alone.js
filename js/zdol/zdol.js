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
  content_urlbase: null,
  crcTable: null
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
  jQuery.getJSON(zdol.content_urlbase + '?updated=' + (new Date(since*1000)).toISOString() + "&callback=?")
    .done(function( data ) {
      var node_count = 0;

      // iterate over all nodes returned by Drupal
      jQuery.each(data, function(index, node) {
        if(!node.id) {
            var n = JSON.stringify(node);
            node.id = crc32(n).toString(36)+n.length.toString(36); //should be good enough to prevent most collisions, pass ID if you really care
        }
        node._id = node.id;

        //rewrite image URL (if any) to local filesystem version
        var imageURL = null;
        var imageFilename = null;
        if (!_.isUndefined(node.image)) {
          imageURL = node.image;
          imageFilename = guid(); 
          node.image =  zdolfs.LOCAL_FILE_BASEURL + imageFilename; 
        }

        // query for nid. If exists, update; if not, insert.
        zdol_node_db.get(node.id, function(err, doc) {
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
        if(imageURL) {
          zdolfs.loadImageToFileSystem(imageURL, imageFilename, function(){});
        }
      });
    })
    .fail(function(jqxhr, textStatus, error) {
      console.log('Could not contact CMS for content update. Either this browser is offline or the CMS site is unreachable.');
    });

    function guid() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
          return v.toString(16);
      }); 
    };

    function makeCRCTable(){
        var c;
        var crcTable = [];
        for(var n =0; n < 256; n++){
            c = n;
            for(var k =0; k < 8; k++){
                c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            crcTable[n] = c;
        }
        return crcTable;
    }

    function crc32(str) {
        var crcTable = zdol.crcTable || (zdol.crcTable = makeCRCTable());
        var crc = 0 ^ (-1);

        for (var i = 0; i < str.length; i++ ) {
            crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
        }

        return (crc ^ (-1)) >>> 0;
    };

}; // end zdol.refresh_content

/**
 * @fileOverview New OOP-ish versions of ZDOL and ZDOLFS
 */



/**
 * Defines a ZDOL "class" which can be instantiated unlimited times.
 * @type ZDOL|Function
 * @param object Config parameters for this instance.  Possible properties:
 * {
 *   api_url: '',               // URL to content API endpoint
 *   collection: 'node',        // Name of PouchDB collection to use
 *   collection_reserve: 50,    // PouchDB collection size, in MB
 *   filesystem_reserve: 3000 * 1024 * 1024, // Local filesystem request, in bytes
 *   update_immediately: true,  // Request fresh data on page load?
 *   auto_update: true,         // Request fresh data at intervals?
 *   auto_update_interval: 30 * 1000  // Time, in seconds, between requests for fresh data.
 *   image_fields: ['image']    // array of Drupal field names in which to find images.
 * }
 */
var ZDOL = (function() {
  
  /**
   * ZDOL constructor
   * @param obj config
   * @returns void
   */
  var ZDOL = function(config) {
    // Defaults
    this.config = {
      api_url: '',
      collection: 'node',
      collection_reserve: 50, // 50 MB
      filesystem_reserve: 3000 * 1024 * 1024, // 3 GB 
      update_immediately: true,
      auto_update: false,
      auto_update_interval: 30 * 1000,
      image_fields: []
    };
    
    // Merge provided properties into defaults
    this.config = _.extend(this.config, config);
    
    // Set up PouchDB instance
    PouchDB.replicate(false);
    this.db = new PouchDB(this.config.collection, {size: this.config.collection_reserve});

    // For all our local filestore needs
    this.fs = new ZDOLFS();

    // For detecting changes to nodes
    this.crcTable = this.makeCRCTable();
    
    // Refresh content right away, if requested in config
    if (this.config.update_immediately) {
      this.refresh_content(0);
    }
    
    // Set up the auto-refresh content, if applicable
    if (this.config.auto_update) {
      var instance = this;
      var interval_handle = setInterval(function() {
        var timestamp = Math.round(new Date().getTime() / 1000);
        var last = timestamp - (instance.config.auto_update_interval / 1000);
        instance.refresh_content(last);
      }, this.config.auto_update_interval);
    }
  };


  ZDOL.prototype.makeCRCTable = function() {
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
  };
  
  
  ZDOL.prototype.crc32 = function (str) {
    var crcTable = this.crcTable || (this.crcTable = this.makeCRCTable());
    var crc = 0 ^ (-1);
    for (var i = 0; i < str.length; i++ ) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  };
  
  
  ZDOL.prototype.refresh_content = function(since) {
    if (_.isUndefined(since)) {
      since = 0;
    }
    var instance = this;
    jQuery.getJSON(this.config.api_url + '?updated=' + (new Date(since*1000)).toISOString() + "&callback=?")
      .done(function( data ) {
        var node_count = 0;

        // iterate over all nodes returned by Drupal
        
        jQuery.each(data, function(index, node) {
          var n = JSON.stringify(node);
          node.checksum = instance.crc32(n);
          if(!node.id) {
              node.id = node.checksum.toString(36)+n.length.toString(36); //should be good enough to prevent most collisions, pass ID if you really care
          }
          node._id = node.id;

          var imageURL = {};
          var imageFilename = {};
          jQuery.each(instance.config.image_fields, function(i, f) {
            if (node[f]) {
              if (Object.prototype.toString.call(node[f]) === '[object Array]' && node[f].length == 0){
                node[f] = null;
              } else {
                imageURL[f] = node[f];
                imageFilename[f] = node.id + '-' + instance.crc32(node[f]).toString(36) + node[f].toString().length.toString(36); 
                node[f] =  instance.config.LOCAL_FILE_BASEURL + imageFilename[f]; 
              }
            }
          });

          // query for nid. If exists, update; if not, insert.
          instance.db.get(node.id, function(err, doc) {
            if (err) {
              if (err.status == 404) {
                // node is new.  Insert it.
                instance.db.put(node, function callback(err, result) {
                  if (!err) {
                    node_count++;
                  } else {
                    console.error(err);
                  }
                });
              } else {
                console.log(err);
              }
            } else if(node.checksum != doc.checksum){ //only update if there have been changes
              // node exists.  Update it.
              node._rev = doc._rev;
              instance.db.put(node, function callback(err, result) {
                if (!err) {
                  node_count++;
                } else {
                  console.error(err);
                }
              });
            } else { //checksum is the same, no changes
                //imageURL = {}; //don't write the image
            }

            // File is now added/updated in pouchdb.  Next, we want to update 
            // The image file, if there is one.
            // 
            // @todo Find a way to make this more generic so it can support 
            // different media types, Drupal field names, etc.  For this iteration,
            // we check for a field called "image" in a node and cache that to 
            // local filesystem.
            jQuery.each(instance.config.image_fields, function(i, f) {
                if(imageURL[f]){
                  instance.fs.loadImageToFileSystem(imageURL[f], imageFilename[f], function(){});
                }
            });
          });

        });
      })
      .fail(function(jqxhr, textStatus, error) {
        console.log('Could not contact CMS for content update. Either this browser is offline or the CMS site is unreachable.');
      });
  };
  

  return ZDOL;

})();



/**
 * Defines a ZDOLFS "class" which can be instantiated unlimited times.
 * @type ZDOLFS|Function
 * @param object Config parameters for this instance.  Possible properties:
 * {
 *   filesystem_reserve: 3000 * 1024 * 1024, // Local filesystem request, in bytes
 *   LOCAL_FILE_BASEURL: 'filesystem:' + window.location.origin + '/persistent/',
 *   type: window.PERSISTENT
 * }
 */
var ZDOLFS = (function() {
  
  var ZDOLFS = function(config) {
    // Defaults
    this.config = {
      filesystem_reserve: 3000 * 1024 * 1024, // 3 GB 
      LOCAL_FILE_BASEURL: 'filesystem:' + window.location.origin + '/persistent/',
      type: window.PERSISTENT
    };
    
    this.construct(config);
  };


  ZDOLFS.prototype.construct = function(config) {
    // Merge provided properties into defaults
    this.config = _.extend(this.config, config);
    
    this.init_filesystem(function(){
      console.log('Ok, local filesystem initiated.');
    });
    
  };
  
  
  ZDOLFS.prototype.init_filesystem = function(callback) {
    function onInitFs(fs) {
      console.log('Opened file system: ' + fs.name);
      LOCAL_FILE_BASEURL = fs.root.toURL();
      callback();
    }

    window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
    navigator.persistentStorage = navigator.persistentStorage || navigator.webkitPersistentStorage;

    // We have to clone the obj we're in so this closure doesn't have a this-sy fit.
    var instance = this;
    navigator.persistentStorage.requestQuota(this.config.filesystem_reserve, function(grantedBytes) {
      window.requestFileSystem(instance.config.type, grantedBytes, onInitFs, instance.error_handler);
    }, this.error_handler);
  };
  
  
  ZDOLFS.prototype.error_handler = function(e) {
    var msg = '';

    switch (e.code) {
      case FileError.QUOTA_EXCEEDED_ERR:
        msg = 'QUOTA_EXCEEDED_ERR';
      break;
      case FileError.NOT_FOUND_ERR:
        msg = 'NOT_FOUND_ERR';
      break;
      case FileError.SECURITY_ERR:
        msg = 'SECURITY_ERR';
      break;
      case FileError.INVALID_MODIFICATION_ERR:
        msg = 'INVALID_MODIFICATION_ERR';
      break;
      case FileError.INVALID_STATE_ERR:
        msg = 'INVALID_STATE_ERR';
      break;
      default:
        msg = 'Unknown Error';
      break;
    }

    console.log('Error: ' + msg);
  };
  
  
  ZDOLFS.prototype.loadImageToFileSystem = function(url, filename, callback) {
    var instance = this;
    this.xhrDownloadImage(url, filename, function (imageAsBlob, filename) {
      instance.saveImageToFileSystem(imageAsBlob, filename, function () {
        callback();
      });
    });
  };
  
  
  ZDOLFS.prototype.xhrDownloadImage = function (url, filename, callback) {
    var xhr = new XMLHttpRequest();

    xhr.open("GET", url, true);
    xhr.responseType = "blob";

    xhr.onerror = function(e){console.log("Error: " + e)};
    xhr.onabort = function(e){console.log("Abort: " + e)};

    xhr.onload = function () {

      //console.log("onload");

      var result;

      if (xhr.status === 200) {
        // image as blob
        result = xhr.response;
      } else {
        result = null;
      }

      if (result !== null) {
        callback(result, filename);
      }

    };

    //console.log(xhr.send());
    xhr.send();
  };
  
  
  ZDOLFS.prototype.saveImageToFileSystem = function(imageAsBlob, filename, callback) {
    var instance = this;
    window.requestFileSystem(this.config.type, this.config.filesystem_reserve, function (fs) {
      fs.root.getFile(filename, { create: true }, function (fileEntry) {
        //console.log(fileEntry);
        fileEntry.createWriter(function (fileWriter) {

          fileWriter.onwriteend = function (e) {
            console.log("file " + filename + " successfully written to filesystem.");
            callback();
          };
          var blob = new Blob([imageAsBlob], { type: imageAsBlob.type });
          fileWriter.write(blob);
        }, instance.error_handler);
      }, instance.error_handler);
    }, this.error_handler);
  };

  return ZDOLFS;

})();
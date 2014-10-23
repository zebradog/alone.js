


var zdolfs = {
  LOCAL_FILE_BASEURL: "filesystem:" + window.location.origin + "/persistent/",
  type: window.PERSISTENT
};


zdolfs.error_handler = function(e) 
{
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
}



zdolfs.init = function(callback) 
{
  function onInitFs(fs) {
    console.log('Opened file system: ' + fs.name);
    LOCAL_FILE_BASEURL = fs.root.toURL();
    callback();
  }
  
  window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
  navigator.persistentStorage = navigator.persistentStorage || navigator.webkitPersistentStorage;

  navigator.persistentStorage.requestQuota(3000 * 1024 * 1024 /*3GB*/, function(grantedBytes) {
    window.requestFileSystem(zdolfs.type, grantedBytes, onInitFs, zdolfs.error_handler);
  }, zdolfs.error_handler);

};




zdolfs.loadImageToFileSystem = function(url, filename, callback) {
  zdolfs.xhrDownloadImage(url, filename, function (imageAsBlob, filename) {
    zdolfs.saveImageToFileSystem(imageAsBlob, filename, function () {
      callback();
    });
  });
};


zdolfs.xhrDownloadImage = function (url, filename, callback) {
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



zdolfs.saveImageToFileSystem = function(imageAsBlob, filename, callback) {

  window.requestFileSystem(zdolfs.type, 3000 * 1024 * 1024 /*3GB*/, function (fs) {

    fs.root.getFile(filename, { create: true }, function (fileEntry) {

      //console.log(fileEntry);

      fileEntry.createWriter(function (fileWriter) {

        fileWriter.onwriteend = function (e) {
          console.log("file " + filename + " successfully written to filesystem.");
          callback();
        };
        var blob = new Blob([imageAsBlob], { type: imageAsBlob.type });
        fileWriter.write(blob);
      }, zdolfs.error_handler);
    }, zdolfs.error_handler);
  }, zdolfs.error_handler);

};




(function(){
  
  zdolfs.init(function(){
    console.log('Ok, local filesystem initiated.');
  });
  
})();
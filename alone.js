/*
 Copyright
  2014 Google Inc.
  2015 ZD Studios Inc.

 All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

//workaround to allow DOM library and ServiceWorker to live in same file
if(!this.document) {
  // While overkill for this specific sample in which there is only one cache,
  // this is one best practice that can be followed in general to keep track of
  // multiple caches used by a given service worker, and keep them all versioned.
  // It maps a shorthand identifier for a cache to a specific, versioned cache name.

  // Note that since global state is discarded in between service worker restarts, these
  // variables will be reinitialized each time the service worker handles an event, and you
  // should not attempt to change their values inside an event handler. (Treat them as constants.)

  // If at any point you want to force pages that use this service worker to start using a fresh
  // cache, then increment the CACHE_VERSION value. It will kick off the service worker update
  // flow and the old cache(s) will be purged as part of the activate event handler when the
  // updated service worker is activated.
  var CACHE_VERSION = 1;
  var CURRENT_CACHES = {
    prefetch: 'alone-cache-v' + CACHE_VERSION
  };

  self.addEventListener('install', function(event) {
    var urlsToPrefetch = [
      './',
      './index.html'
    ];
    event.waitUntil(
      caches.open(CURRENT_CACHES['prefetch']).then(function(cache) {
          // It's very important to use {mode: 'no-cors'} if there is any chance that
          // the resources being fetched are served off of a server that doesn't support
          // CORS (http://en.wikipedia.org/wiki/Cross-origin_resource_sharing).
          // In this example, www.chromium.org doesn't support CORS, and the fetch()
          // would fail if the default mode of 'cors' was used for the fetch() request.
          // The drawback of hardcoding {mode: 'no-cors'} is that the response from all
          // cross-origin hosts will always be opaque
          // (https://slightlyoff.github.io/ServiceWorker/spec/service_worker/index.html#cross-origin-resources)
          // and it is not possible to determine whether an opaque response represents a success or failure
          // (https://github.com/whatwg/fetch/issues/14).
          return Promise.all(
            urlsToPrefetch.map(function(url){
                return cache.add(new Request(url, {mode: 'no-cors'})).then(function(response){
              }).catch(function(e){
                console.error("failed pre-caching: ",e,url);
              });
            })
          );
      }).catch(function(error) {
        // This catch() will handle any exceptions from the caches.open()/cache.addAll() steps.
        console.error('Pre-fetching failed:', error);
      })
    );
  });

  self.addEventListener('activate', function(event) {
    // Delete all caches that aren't named in CURRENT_CACHES.
    // While there is only one cache in this example, the same logic will handle the case where
    // there are multiple versioned caches.
    var expectedCacheNames = Object.keys(CURRENT_CACHES).map(function(key) {
      return CURRENT_CACHES[key];
    });
    event.waitUntil(
      caches.keys().then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (expectedCacheNames.indexOf(cacheName) == -1) {
              // If this cache name isn't present in the array of "expected" cache names, then delete it.
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
  });

  function getContent(request){
    //don't actually request a range, always make sure we fetch the entire file
    //strip range headers from request to server
    //need to create a new Request since we can't modify the existing headers
    var rangeRequested = request.headers.has('Range');
    if(rangeRequested) request = new Request(request.url);
    return fetch(request).then(function(response) {
      return caches.open(CURRENT_CACHES['prefetch']).then(function(cache) {
        //add the range response headers if rangeRequested
        //always send the full file, regardless of requested range
        if(rangeRequested){
          return response.blob().then(function(content) {
            var headers = new Headers({
              "Accept-Ranges":"bytes",
              "Content-Range":"bytes 0-"+(content.size-1)+'/'+content.size,
              "Content-Type":content.type,
              "Server":"alonejs/1.0.0"
            });
            response = new Response(content,{
              "status":206,
              "statusText":"OK",
              "headers":headers
            });
            cache.put(request, response.clone());
            return response;
          });
        }else{
          cache.put(request, response.clone());
          return response;
        }
      });
    }).catch(function(e){
      console.error('error fetching: ',e,request.url);
    });
  }

  //modified from: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
  self.addEventListener('fetch', function(event) {
    event.respondWith(
      caches.match(event.request).then(function(response){
        if(response) {
          //get updated content from the server anyway
          getContent(event.request);
          return response;
        } else {
          return getContent(event.request)
        }
      }).catch(function(error) {
          console.error('Fetching failed:', error);
          throw error;
      })
    );
  });

  self.addEventListener('message', function(event) {
    console.log('Handling message event:', event);
  });
}else{
  //load library if not included as a ServiceWorker
  window.Alone = (function () {

      init();

      function init(){
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('alone.js')
            .then(waitUntilInstalled)
            .then(serviceWorkerInstallComplete)
            .catch(function(error) {
              // Something went wrong during registration. The service-worker.js file
              // might be unavailable or contain a syntax error.
              console.error(error);
            });
        } else {
          // The current browser doesn't support service workers.
          console.error('Service workers are not supported in the current browser.','http://www.chromium.org/blink/serviceworker/service-worker-faq')
        }
      }

      function serviceWorkerInstallComplete() {
        console.log('service worker done');
      }

      // Helper function which returns a promise which resolves once the service worker registration
      // is past the "installing" state.
      function waitUntilInstalled(registration) {
        return new Promise(function(resolve, reject) {
          if (registration.installing) {
            // If the current registration represents the "installing" service worker, then wait
            // until the installation step (during which the resources are pre-fetched) completes
            // to display the file list.
            registration.installing.addEventListener('statechange', function(e) {
              if (e.target.state == 'installed') {
                resolve();
              } else if(e.target.state == 'redundant') {
                reject();
              }
            });
          } else {
            // Otherwise, if this isn't the "installing" service worker, then installation must have been
            // completed during a previous visit to this page, and the resources are already pre-fetched.
            // So we can show the list of files right away.
            resolve();
          }
        });
      }

      var alone = {
          //public functions

          ////from: https://github.com/GoogleChrome/samples/blob/gh-pages/service-worker/post-message/index.html
          sendMessage: function (message) {
            // This wraps the message posting/response in a promise, which will resolve if the response doesn't
            // contain an error, and reject with the error if it does. If you'd prefer, it's possible to call
            // controller.postMessage() and set up the onmessage handler independently of a promise, but this is
            // a convenient wrapper.
            return new Promise(function(resolve, reject) {
              var messageChannel = new MessageChannel();
              messageChannel.port1.onmessage = function(event) {
                if (event.data.error) {
                  reject(event.data.error);
                } else {
                  resolve(event.data);
                }
              };

              // This sends the message data as well as transferring messageChannel.port2 to the service worker.
              // The service worker can then use the transferred port to reply via postMessage(), which
              // will in turn trigger the onmessage handler on messageChannel.port1.
              // See https://html.spec.whatwg.org/multipage/workers.html#dom-worker-postmessage
              navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
            });
          }
      };

      return alone;
  }());
}

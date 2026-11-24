/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "968973693e1fcac81d5bd1bf32357ced"
  }, {
    "url": "pwa-512x512.png",
    "revision": "29451b182262a3e6a3cda7a189224ebd"
  }, {
    "url": "pwa-192x192.png",
    "revision": "748f698b77abe638ff4317e914c9ee49"
  }, {
    "url": "index.html",
    "revision": "3695863d0430cf0d097cadf268fa3307"
  }, {
    "url": "icon.svg",
    "revision": "5798b61a701a0095423b6551613f70de"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "ed51e035132bbe8c03d4dfe1122d8fa9"
  }, {
    "url": "src/assets/images/idea_warm_majlis_1795473198186.jpg",
    "revision": "437bf2884161b4673df0a808ef8d73b8"
  }, {
    "url": "src/assets/images/idea_olive_living_1795473197526.jpg",
    "revision": "17431550751cd14e59ea94a2e3c1efff"
  }, {
    "url": "src/assets/images/idea_navy_modern_1795473198483.jpg",
    "revision": "29d14506120e5f2194784e3ead02dda4"
  }, {
    "url": "src/assets/images/idea_minimal_bedroom_1795473198552.jpg",
    "revision": "d6ec81a8f214be4974c7ecba5c63560d"
  }, {
    "url": "src/assets/images/hero_living_room_1795473198325.jpg",
    "revision": "6c03c888cbfc1b61aece28d50bedd033"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/index-CaPvgUYr.css",
    "revision": null
  }, {
    "url": "assets/index-C8HPp5ua.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "ed51e035132bbe8c03d4dfe1122d8fa9"
  }, {
    "url": "icon.svg",
    "revision": "5798b61a701a0095423b6551613f70de"
  }, {
    "url": "manifest.webmanifest",
    "revision": "fb8652302a68a73dff099eafb88e894a"
  }, {
    "url": "pwa-192x192.png",
    "revision": "748f698b77abe638ff4317e914c9ee49"
  }, {
    "url": "pwa-512x512.png",
    "revision": "29451b182262a3e6a3cda7a189224ebd"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "968973693e1fcac81d5bd1bf32357ced"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//]
  }));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));

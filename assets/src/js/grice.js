grice = (function () {
  "use strict";

  var grice = {};

  grice.changeHandler = function (attr, scope) {
    return function (value) {
      return scope[attr](value);
    };
  };

  grice.extractStatusCode = function (xhr) {
    /*
    extractStatusCode is to be used with the Mithril 'extract' attribute when using m.request. It takes an XHR object
    and injects the status code into the payload returned by the server. In the future we can just be better about
    always returning a status code with our responses, however we will still likely need a method like this to check
    for 500 status codes and handle them.

    Unfortunately parsing and re-stringifying is the only way to do this because Mithril is weird. We should consider
    submitting a patch to extract methods to return parsed JSON.
    */
    var jsonData = JSON.parse(xhr.responseText);
    jsonData.statusCode = xhr.status;
    return JSON.stringify(jsonData);
  };

  return grice;
})();

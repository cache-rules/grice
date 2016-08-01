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

  // TODO: make the parse functions below create model objects.

  var parseFilter = function (filter) {
    // Format: column_name,filter_type,value
    return filter;
  };

  var parseSort = function (sort) {
    // Format: column_name,direction
    return sort;
  };

  var parseJoin = function (join) {
    // Format: table_name,from_col:to_col;from_col:to_col
    return join;
  };

  var parseColumns = function (columnNames) {
    return columnNames.split(',');
  };

  var reduceParams = function (params, param) {
    var items = param.split('=');
    var type = items[0];
    var value = items[1];

    switch (type) {
      case "filter":
        params.filters.push(parseFilter(value));
        break;
      case "sort":
        params.sorts.push(parseSort(value));
        break;
      case "join":
        if (params.join === null || params.outerjoin === null) {
          params.join = parseJoin(value);
        }
        break;
      case "outerjoin":
        if (params.join === null || params.outerjoin === null) {
          params.outerjoin = parseJoin(value);
        }
        break;
      case "cols":
        if (params.columns === null) {
          params.columns = parseColumns(value);
        }
        break;
      case "page":
        break;
      case "perPage":
        break;
      default:
        console.warn('Unrecognized query string value', type, value);
    }

    return params;
  };

  var defaultParams = function () {
    return {
      filters: [],
      sorts: [],
      join: null,
      outerjoin: null,
      columns: null
    };
  };

  grice.parseQueryParams = function () {
    var queryString = window.location.search.substring(1);
    return queryString.split('&').reduce(reduceParams, defaultParams());
  };

  grice.generateTableUrl = function (tableName, page, perPage, queryParams) {
    var url = '/db/tables/' + tableName + '?page=' + page + '&perPage=' + perPage;

    if (queryParams.join) {
      url += '&join=' + queryParams.join;
    }

    if (queryParams.outerjoin) {
      url += '&outerjoin=' + queryParams.outerjoin;
    }

    if (queryParams.columns) {
      url += '&cols=' + queryParams.columns
    }

    if (queryParams.filters.length) {
      console.log(queryParams.filters);
      url += '&filter=' + queryParams.filters.join('&filter=');
    }

    if (queryParams.sorts.length) {
      url += '&sort=' + queryParams.sorts.join('&sort=');
    }

    return url;
  };

  return grice;
})();

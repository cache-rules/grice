grice = (function () {
  "use strict";

  var grice = {};

  grice.NUMERIC_COLUMNS = ['FLOAT', 'INTEGER' , 'REAL', 'NUMERIC', 'SMALLINT'];
  grice.DISCRETE_COLUMNS = ['CHAR', 'TEXT', 'BOOLEAN'];

  grice.isNumericColumn = function (column) {
    if (column) {
      return grice.NUMERIC_COLUMNS.indexOf(column.type) > -1;
    }

    return false;
  };

  grice.isDiscreteColumn = function (column) {
    if (column) {
      return grice.DISCRETE_COLUMNS.indexOf(column.type) > -1;
    }

    return false;
  };

  grice.makeGetter = function (name) {
    return function (d) {
      return d[name];
    };
  };

  grice.isValid = function (value) {
    return value !== undefined && value !== null;
  };

  grice.sortData = function (a, b) {
    if (a > b) {
      return 1;
    } else if (a < b) {
      return -1;
    }
    return 0;
  };

  var whiskerBottom = function (rows, boxBottom, iqr) {
    var i, value;

    for (i = 0; i < rows.length; i++) {
      value =  rows[i];

      if (value >= (boxBottom - iqr)) {
        return value;
      }
    }
  };

  var whiskerTop = function (rows, boxTop, iqr) {
    var i, value;

    for (i = rows.length - 1; i >= 0; i--) {
      value = rows[i];

      if (value <= (boxTop + iqr)) {
        return value;
      }
    }
  };

  grice.boxPlotStats = function(rows, name) {
    /**
     * Box:
     *  The bottom is the first quartile
     *  The middle is the median
     *  The top is the third quartile
     *
     * Whiskers:
     *  Bottom: the lowest datum still within 1.5 IQR of the first quartile
     *  Top: the highest datum still within 1.5 IQR of the second quartile
     */

    var boxBottom = d3.quantile(rows, .25);
    var boxMiddle = d3.quantile(rows, .5);
    var boxTop = d3.quantile(rows, .75);
    var iqr = 1.5 * (boxTop - boxBottom);

    return {
      name: name,
      box: {
        bottom: boxBottom,
        middle: boxMiddle,
        top: boxTop
      },
      whiskers: {
        bottom: whiskerBottom(rows, boxBottom, iqr),
        top: whiskerTop(rows, boxTop, iqr)
      }
    };
  };

  grice.groupData = function (rows, getGroup, getValue) {
    /**
     * Groups data based on the getGroup value of each row.
     */
    var groupedData = {};

    rows.forEach(function (row) {
      var group = getGroup(row);
      var value = getValue(row);

      if (!(group in groupedData)) {
        groupedData[group] = [];
      }

      groupedData[group].push(value);
    });

    return groupedData;
  };

  grice.convertBoxPlotData = function (rows, table, getGroup, getValue) {
    /**
     * Filters groups rows if needed, then converts each group to box plot stats. Assumes rows are sorted.
     */
    var groupedRows;

    if (getGroup) {
      groupedRows = grice.groupData(rows, getGroup, getValue);

      return Object.keys(groupedRows).map(function (group) {
        return grice.boxPlotStats(groupedRows[group], group);
      });
    }

    return [grice.boxPlotStats(rows.map(getValue), table.name)];
  };

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

  var parseColumn = function (columnName) {
    return columnName
  };

  var parseParam = function (param, params) {
    var items = param.split('=');
    var type = items[0];
    var value = items[1];

    // TODO: not a fan of this switch statement. Find a way to simplify this.

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
      case "x":
        params.x = parseColumn(value);
        break;
      case "y":
        params.y = parseColumn(value);
        break;
      case "page":
        break;
      case "perPage":
        break;
      default:
        console.warn('Unrecognized query string value', type, value);
    }
  };

  var reduceParams = function (params, param) {
    if (param) {
      parseParam(param, params);
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

  grice.generateTableQueryString = function (page, perPage, queryParams) {
    var url = '';
    var separator = '';

    if (page !== null) {
      url += separator + 'page=' + page;
      separator = '&';
    }

    if (perPage !== null) {
      url += separator + 'perPage=' + perPage;
      separator = '&';
    }

    if (queryParams.join) {
      url += separator + 'join=' + queryParams.join;
      separator = '&';
    }

    if (queryParams.outerjoin) {
      url += separator + 'outerjoin=' + queryParams.outerjoin;
      separator = '&';
    }

    if (queryParams.columns) {
      url += separator + 'cols=' + queryParams.columns
      separator = '&';
    }

    if (queryParams.filters.length) {
      console.log(queryParams.filters);
      url += separator + 'filter=' + queryParams.filters.join('&filter=');
      separator = '&';
    }

    if (queryParams.sorts.length) {
      url += separator + 'sort=' + queryParams.sorts.join('&sort=');
    }

    if (url.length) {
      url = '?' + url;
    }

    return url;
  };

  grice.generateTableUrl = function (tableName, page, perPage, queryParams) {
    return '/db/tables/' + tableName + grice.generateTableQueryString(page, perPage, queryParams);
  };

  grice.generateTableQueryUrl = function (tableName, page, perPage, queryParams) {
    var baseUrl = '/api/db/tables/' + tableName + '/query';
    var queryString = grice.generateTableQueryString(page, perPage, queryParams);
    return baseUrl + queryString;
  };

  grice.generateChartUrl = function (tableName, column, queryParams) {
    var baseUrl = '/db/tables/' + tableName + '/chart';
    var queryString = grice.generateTableQueryString(null, null, queryParams);
    var separator = '';

    if (queryString.length > 0) {
      separator = '&';
    }

    if (column !== null) {
      if (queryString.length == 0) {
        queryString += '?';
      }

      queryString += separator + 'y=' + column.table + '.' + column.name;
    }

    return baseUrl + queryString;
  };

  return grice;
})();

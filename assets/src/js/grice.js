grice = (function () {
  "use strict";

  var grice = {};

  grice.FILTER_TYPES = {
    'lt': 'less than',
    'lte': 'less than or equal to',
    'eq': 'equal to',
    'neq': 'not equal to',
    'gt': 'greater than',
    'gte': 'greater than or equal to',
    'in': 'in (example: a;b;c)',
    'not_in': 'not in (example: a;b;c)',
    'bt': 'between (example: 65;95)',
    'nbt': 'not between (example: 65;95)'
  };
  grice.NUMERIC_COLUMNS = ['DOUBLE_PRECISION', 'FLOAT', 'INTEGER' , 'REAL', 'NUMERIC', 'SMALLINT'];
  grice.DISCRETE_COLUMNS = ['CHAR', 'VARCHAR', 'TEXT', 'BOOLEAN'];

  grice.shallowCopy = function (arr) {
    return arr.map(function (i) {return i});
  };

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

  grice.convertScatterPlotData = function (data, xGetter, yGetter) {
    var xMin = null, xMax = null, yMin = null, yMax = null;

    data = data.filter(function(datum) {
      var x = xGetter(datum);
      var y = yGetter(datum);
      var xValid = grice.isValid(x);
      var yValid = grice.isValid(y);

      if (xValid) {
        if (xMin == null || x < xMin) {
          xMin = x;
        }

        if (xMax == null || x > xMax) {
          xMax = x;
        }
      }

      if (yValid) {
        if (yMin == null || y < yMin) {
          yMin = y;
        }

        if (yMax == null || y > yMax) {
          yMax = y;
        }
      }

      return xValid && yValid;
    });

    return {data: data, xDomain: [xMin, xMax], yDomain: [yMin, yMax]};
  };

  grice.findColumn = function (columns, columnName) {
    if (columnName) {
      return columns.find(function (column) {
        return column.table + '.' + column.name == columnName;
      });
    }

    return null;
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

  grice.convertBoxPlotData = function (table, rows, getGroup, getValue) {
    /**
     * Filters groups rows if needed, then converts each group to box plot stats. Assumes rows are sorted.
     */
    var groupedRows;
    var data = {
      rows: [],
      min: null,
      max: null
    };

    rows = rows.filter(function (row) {
      var value = getValue(row);
      var isValid = grice.isValid(value);

      if (isValid) {
        if (data.min == null || value < data.min) {
          data.min = value;
        }

        if (data.max == null || value > data.max) {
          data.max = value;
        }
      }

      return isValid;
    }).sort(function (a, b) {
      return grice.sortData(getValue(a), getValue(b));
    });

    if (getGroup) {
      groupedRows = grice.groupData(rows, getGroup, getValue);
      data.rows = Object.keys(groupedRows).map(function (group) {
        return grice.boxPlotStats(groupedRows[group], group);
      });
    } else {
      data.rows = [grice.boxPlotStats(rows.map(getValue), table.name)];
    }

    return data;
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

  // Mithril: To maintain the identities of DOM elements, you need to add a key property to the direct children of the
  // array that you're planning to modify.
  // I tried putting the key on the DOM elements, but that is not good enough apparently.
  // http://mithril.js.org/mithril.html#dealing-with-focus
  var columnKey = 0;

  grice.ColumnFilter = function (column, type, value) {
    this.column = m.prop(column);
    this.type = m.prop(type);
    this.value = m.prop(value);
    this.key = columnKey++;
    this.json = function () {
      return {
        column: this.column(),
        type: this.type(),
        value: this.value()
      }
    }.bind(this);
    this.queryParam = function () {
      return this.column() + ',' + this.type() + ',' + this.value();
    }.bind(this);
  };

  var parseFilter = function (params, type, value) {
    // Format: column_name,filter_type,value
    var parts = value.split(',');
    var column = parts[0], filterType = parts[1], filterValue = parts[2];

    if (!params.filters.hasOwnProperty(column)) {
      params.filters[column] = [];
    }

    params.filters[column].push(new grice.ColumnFilter(column, filterType, filterValue))
  };

  // TODO: make the parse functions below create model objects.

  var parseSort = function (params, type, value) {
    // Format: column_name,direction
    var parts = value.split(',');

    return params.sorts.push({
      column: parts[0],
      direction: parts[1]
    });
  };

  var parseJoin = function (params, type, value) {
    // Format: table_name,from_col:to_col;from_col:to_col
    if (params.join === null) {
      params.join = value;
    }
  };

  var parseOuterJoin = function (params, type, value) {
    // Format: table_name,from_col:to_col;from_col:to_col
    if (params.outerjoin === null) {
      params.outerjoin = value;
    }
  };

  var parseColumns = function (params, type, value) {
    params.columns = value.split(',');
  };

  var parseColumn = function (params, type, value) {
    params[type] = value;
  };

  var noop = function () {
    return null
  };

  var paramTypes = {
    filter: parseFilter,
    sort: parseSort,
    join: parseJoin,
    outerjoin: parseOuterJoin,
    cols: parseColumns,
    x: parseColumn,
    y: parseColumn,
    color: parseColumn,
    page: noop,
    perPage: noop
  };

  var parseParam = function (param, params) {
    var items = param.split('=');
    var type = items[0];
    var value = items[1];

    if (paramTypes.hasOwnProperty(type)) {
      paramTypes[type](params, type, value);
    } else {
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
      filters: {},
      sorts: [],
      join: null,
      outerjoin: null,
      columns: null,
      x: null,
      y: null,
      color: null
    };
  };

  grice.parseQueryParams = function () {
    var queryString = window.location.search.substring(1);
    return queryString.split('&').reduce(reduceParams, defaultParams());
  };

  grice.generateTableQueryString = function (page, perPage, queryParams) {
    var url = '';
    var separator = '';
    var sorts;

    if (page !== undefined && page !== null) {
      url += separator + 'page=' + page;
      separator = '&';
    }

    if (perPage !== undefined && perPage !== null) {
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
      url += separator + 'cols=' + queryParams.columns;
      separator = '&';
    }

    if (queryParams.filters) {
      Object.keys(queryParams.filters).forEach(function (col) {
        var filters = queryParams.filters[col].map(function (f) { return f.queryParam() });

        if (filters.length) {
          url += separator + 'filter=' + filters.join('&filter=');
          separator = '&';
        }
      });
    }

    if (queryParams.sorts.length) {
      sorts = queryParams.sorts.map(function (s) {
        return s.column + ',' + s.direction;
      });
      url += separator + 'sort=' + sorts.join('&sort=');
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

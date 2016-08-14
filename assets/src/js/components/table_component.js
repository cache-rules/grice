(function () {
  var queryTable = function (table, rowsProp, errorProp) {
    var requestData = {
      url: '/api/db/tables/' + table.name + '/data',
      method: 'GET',
      extract: grice.extractStatusCode
    };

    var success = function (data) {
      m.startComputation();
      rowsProp(data.rows);
      m.endComputation();
    };

    var failure = function (data) {
      rowsProp([]);
      errorProp(data.error);
    };

    return m.request(requestData).then(success, failure);
  };

  grice.PaginationComponent = {
    controller: function (table, rows, page, perPage, queryParams) {
      this.table = table;
      this.rows = rows;
      this.page = page;
      this.perPage = perPage;
      this.queryParams = queryParams;
    },
    view: function (c) {
      var nextUrl = grice.generateTableUrl(c.table.name, c.page + 1, c.perPage, c.queryParams);
      var prevUrl = grice.generateTableUrl(c.table.name, c.page - 1, c.perPage, c.queryParams);
      var prevEl;
      var nextEl;

      if (c.page <= 1) {
        prevEl = '<';
      } else {
        prevEl = m('a', {href: prevUrl}, '<');
      }

      if (c.rows.length < c.perPage) {
        nextEl = '>';
      } else {
        nextEl = m('a', {href: nextUrl}, '>');
      }

      return m('div.pagination', [
          m('div.previous', prevEl),
          m('div.page', 'Page ' + c.page),
          m('div.next', nextEl)
      ]);
    }
  };

  grice.ColumnHeader = {
    controller: function (tableName, column, queryParams, showChart) {
      this.tableName = tableName;
      this.column = column;
      this.queryParams = queryParams;
      this.showChart = showChart;
    },
    view: function (c) {
      var colType = c.column.type;
      var menuItems = [];
      var sortIdx = -1;
      var sort = c.queryParams.sorts.find(function (sort, idx) {
        var sortCol = sort.split(',')[0];
        var found = c.column.name == sortCol || (c.column.table + '.' + c.column.name) == sortCol;

        if (found) {
          sortIdx = idx;
        }

        return found;
      });

      var removeSort = function () {
        if (sortIdx > -1) {
          c.queryParams.sorts.splice(sortIdx, 1);
        }
      };

      var applySort = function (type) {
        removeSort();
        var sort = c.column.table + '.' + c.column.name + ',' + type;
        c.queryParams.sorts.push(sort);
        window.location = grice.generateTableUrl(c.tableName, c.queryParams.page, c.queryParams.perPage, c.queryParams);
      };

      var sortAscending = function () {
        applySort('asc');
      };

      var sortDescending = function () {
        applySort('desc');
      };

      var clearSort = function () {
        removeSort();
        window.location = grice.generateTableUrl(c.tableName, c.queryParams.page, c.queryParams.perPage, c.queryParams);
      };

      if (sort) {
        menuItems.push(m('div.menu-item', {onclick: clearSort}, 'Clear sort'));
      }

      menuItems.push(m('div.menu-item', {onclick: sortAscending}, 'Sort ascending'));
      menuItems.push(m('div.menu-item', {onclick: sortDescending}, 'Sort descending'));
      //menuItems.push(m('div.menu-item', {onclick: showFilterDialog}, 'Filter'));

      if (grice.NUMERIC_COLUMNS.indexOf(colType) > -1) {
        var showChart = function () {
          c.showChart(c.column);
        };

        menuItems.push(m('div.menu-item', {onclick: showChart}, 'Chart'));
      }

      var menu = m('div.column-menu', menuItems);
      var columnHeaderItems = [m('div.column-name', c.column.name), menu];

      return m('th', m('div.column-header.u-full-width', [columnHeaderItems]));
    }
  };

  grice.TableDataComponent = {
    controller: function (table, columns, rows, queryParams, showChart) {
      this.table = table;
      this.columns = columns;
      this.rows = m.prop(rows);
      this.queryError = m.prop(null);
      this.queryParams = queryParams;
      this.showChart = showChart;

      if (rows == null) {
        queryTable(this.table, this.rows, this.queryError);
      }
    },
    view: function (c) {
      var headerCols = c.columns.map(function (col) {
        return m(grice.ColumnHeader, c.table.name, col, c.queryParams, c.showChart);
      });
      var tableHeader = m('tr', headerCols);
      var tableBody;
      var queryError = c.queryError();
      var rows = c.rows();

      rows = rows ? rows : [];

      if (queryError !== null) {
        tableBody = m('tr', m('td.error', queryError));
      } else {
        tableBody = rows.map(function (row) {
          var cols = c.columns.map(function (col) {
            return m('td', row[col.table + '.' + col.name]);
          });

          return m('tr', cols);
        });
      }

      return m('table.table', [
          m('thead', tableHeader),
          m('tbody', tableBody)
      ]);
    }
  };

  grice.TableComponent = {
    controller: function () {
      this.table = grice._table;
      this.columns = grice._columns;
      this.rows = grice._rows;
      this.page = grice._page;
      this.perPage = grice._perPage;
      this.queryParams = grice.parseQueryParams();
      this.showChart = function (column) {
        window.location = grice.generateChartUrl(this.table.name, column, this.queryParams);
      }.bind(this);
    },
    view: function (c) {
      return m('div.db-table', [
        m('h3.table-name', c.table.name),
        m(grice.PaginationComponent, c.table, c.rows, c.page, c.perPage, c.queryParams),
        m(grice.TableDataComponent, c.table, c.columns, c.rows, c.queryParams, c.showChart),
        m(grice.PaginationComponent, c.table, c.rows, c.page, c.perPage, c.queryParams)
      ]);
    }
  };
})();

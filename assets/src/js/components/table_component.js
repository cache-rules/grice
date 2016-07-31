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
    controller: function (table, rows, page, perPage) {
      this.table = table;
      this.rows = m.prop(rows);
      this.page = m.prop(page);
      this.perPage = m.prop(perPage);
    },
    view: function (c) {
      var nextUrl = '/db/tables/' + c.table.name + '?page=' + (c.page() + 1) + '&perPage=' + c.perPage();
      var prevUrl = '/db/tables/' + c.table.name + '?page=' + (c.page() - 1) + '&perPage=' + c.perPage();
      var prevEl;
      var nextEl;

      if (c.page() <= 1) {
        prevEl = '<';
      } else {
        prevEl = m('a', {href: prevUrl}, '<');
      }

      if (c.rows().length < c.perPage()) {
        nextEl = '>';
      } else {
        nextEl = m('a', {href: nextUrl}, '>');
      }

      return m('div.pagination', [
          m('div.previous', prevEl),
          m('div.page', 'Page ' + c.page()),
          m('div.next', nextEl)
      ]);
    }
  };

  grice.TableDataComponent = {
    controller: function (table, columns, rows) {
      this.table = table;
      this.columns = columns;
      this.rows = m.prop(rows);
      this.queryError = m.prop(null);

      if (rows == null) {
        queryTable(this.table, this.rows, this.queryError);
      }
    },
    view: function (c) {
      var headerCols = c.columns.map(function (col) {
        return m('th', col.name);
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
    },
    view: function (c) {
      return m('div.db-table', [
        m('h3.table-name', c.table.name),
        m(grice.PaginationComponent, c.table, c.rows, c.page, c.perPage),
        m(grice.TableDataComponent, c.table, c.columns, c.rows),
        m(grice.PaginationComponent, c.table, c.rows, c.page, c.perPage)
      ]);
    }
  };


})();

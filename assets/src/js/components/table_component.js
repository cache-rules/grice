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

  grice.TableDataComponent = {
    controller: function (table, rows) {
      this.table = table;
      this.rows = m.prop(rows);
      this.queryError = m.prop(null);

      if (rows == null) {
        queryTable(this.table, this.rows, this.queryError);
      }
    },
    view: function (c) {
      var headerCols = c.table.columns.map(function (col) {
        return m('th', col.name);
      });
      var tableHeader = m('tr', headerCols);
      var tableBody;
      var queryError = c.queryError();
      var rows = c.rows();

      rows = rows ? rows : [];

      if (queryError !== null) {
        tableBody = m('tr', m('td.error', m('p', queryError)));
      } else {
        tableBody = rows.map(function (row) {
          var cols = c.table.columns.map(function (col) {
            return m('td', m('p', row[col.name]));
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
      this.rows = grice._rows;
    },
    view: function (c) {
      return m('div.db-table', [
          m('h3.table-name', c.table.name),
          m(grice.TableDataComponent, c.table, c.rows)
      ]);
    }
  };


})();

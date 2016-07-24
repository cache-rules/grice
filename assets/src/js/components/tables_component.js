(function () {
  grice.TablesComponent = {
    controller: function () {
      this.tables = grice._tables;
    },
    view: function (c) {
      var schemas = Object.keys(c.tables).map(function (schema) {
        var tables = c.tables[schema];

        if (schema == 'null') {
          schema = 'public';
        }

        var tableElements = Object.keys(tables).map(function (tableName) {
          var table = tables[tableName];
          var tableAnchor = m('a', {href: '/db/tables/' + tableName}, tableName);
          var columnsSpan = ' - ' + table.columns.map(function (col) {
            return col.name;
          }).join(', ');

          return m('li.table-info', [tableAnchor, columnsSpan]);
        });

        return m('div.schema', [
          m('h3.schema-title', schema),
          m('ul.schema-tables', tableElements)
        ]);
      });

      return m('div.schemas', schemas);
    }
  }
})();

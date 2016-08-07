(function () {
  var blankPlot = function (el, c) {
    var svg = d3.select(el);

    if (c.loading()) {
      // TODO: handle loading state
      return;
    }

    // TODO: handle blank chart state (i.e. no columns chosen).
    // TODO: handle invalid chart state
  };

  grice.ColumnPicker = {
    controller: function (columns, selected, name) {
      this.columns = columns;
      this.selected = selected;
      this.name = name;
      this.onChange = function (value) {
        var items = value.split('.');
        var tableName = items[0];
        var columnName = items[1];
        var column = this.columns.find(function (col) {
          return col.table == tableName && col.name == columnName;
        });

        if (column) {
          this.selected(column);
        } else {
          this.selected(null);
        }

        return value;
      }.bind(this);
    },
    view: function (c) {
      var selected = c.selected();
      var value = null;

      if (selected) {
        value = selected.table + '.' + selected.name;
      }

      var options = c.columns.map(function (column) {
        return m('option', {value: column.table + '.' + column.name}, column.name);
      });

      options = [m('option', {value: null}, 'None')].concat(options);

      return m('div.column-picker', [
          m('label', c.name),
          m('select', {value: value, onchange: m.withAttr('value', c.onChange)}, options)
      ]);
    }
  };

  grice.ChartControlsComponent = {
    controller: function (table, columns, x, y) {
      this.table = table;
      this.columns = columns;
      this.x = x;
      this.y = y;
    },
    view: function (c) {
      var yColumns = c.columns.filter(function (column) {
        return grice.NUMERIC_COLUMNS.indexOf(column.type) > -1;
      });
      return m('div.chart-controls', [
        m(grice.ColumnPicker, c.columns, c.x, 'x-axis'),
        m(grice.ColumnPicker, yColumns, c.y, 'y-axis')
      ]);
    }
  };

  grice.ChartComponent = {
    controller: function (table, x, y, rows, loading) {
      this.table = table;
      this.x = x;
      this.y = y;
      this.rows = rows;
      this.loading = loading;
    },
    config: function (c) {
      // TODO: re-trigger rendering of chart when screen size changes.
      return function(element) {
        var x = c.x();
        var y = c.y();

        // TODO: probably just make it isNumeric return a boolean, assume isDiscrete if false.
        var xNumeric = grice.isNumericColumn(x);
        var yNumeric = grice.isNumericColumn(y);
        var xDiscrete = grice.isDiscreteColumn(x);
        var yDiscrete = grice.isDiscreteColumn(y);

        if (c.loading()) {
          blankPlot(element, c);
        } else if (x && y && xNumeric && yNumeric) {
          grice.scatterPlot(element, c);
        } else if (x && y && xDiscrete && yNumeric) {
          grice.boxPlot(element, c);
        } else if (!x && y && yNumeric) {
          grice.boxPlot(element, c);
        } else if (x && xNumeric && (!y || yDiscrete)) {
          // TODO: Either invalid plot, so render error, or handle horizontal box plot.
          blankPlot(element, c);
        } else {
          // TODO: Invalid plot, render error.
          blankPlot(element, c);
        }
      };
    },
    view: function (c) {
      var config = grice.ChartComponent.config(c);
      return m('div.svg-container.u-full-width', {config: config});
    }
  };

  grice.TableChartComponent = {
    controller: function () {
      var me = this;
      this.table = grice._table;
      this.columns = grice._columns;
      this.queryParams = grice.parseQueryParams();
      var x = grice.findColumn(this.columns, this.queryParams.x);
      var y = grice.findColumn(this.columns, this.queryParams.y);
      this.x = m.prop(x);
      this.y = m.prop(y);
      this.rows = m.prop(null);
      this.loading = m.prop(true);

      var loadData = function () {
        m.request({
          // TODO: make perPage -1 so we get all rows.
          url: grice.generateTableQueryUrl(me.table.name, null, 50, me.queryParams)
        }).then(function (data) {
          me.loading(false);
          me.rows(data.rows);
        });
      };

      // TODO: I don't like this hack.
      // Have to do this setTimeout hack so mithril doesn't prevent the component from rendering without completing the
      // request.
      setTimeout(loadData, 0);
    },
    view: function (c) {
      // TODO: allow user to switch to data view without navigating back to table page.
      return m('div.chart', [
          m('h4', 'Chart: ' + c.table.name),
          m(grice.ChartControlsComponent, c.table, c.columns, c.x, c.y, c.rows),
          m(grice.ChartComponent, c.table, c.x, c.y, c.rows, c.loading)
      ]);
    }
  };
})();

(function () {
  "use strict";

  grice.CHART_TYPES = {
    SCATTER: 'SCATTER',
    BOX: 'BOX',
    NONE: 'NONE'
  };

  grice.ChartModel = function (table, columns, queryParams) {
    this.table = table;
    this.columns = columns;
    this.columnMap = columns.reduce(function (columnMap, column) {
      columnMap[column.table + '.' + column.name] = column;
      return columnMap;
    }, {});
    this.queryParams = queryParams;
    this._x = m.prop(null);
    this.xGetter = null;
    this._y = m.prop(null);
    this.yGetter = null;
    this._color = m.prop(null);
    this.colorGetter = null;
    this.rows = m.prop([]);

    this.x = function (column) {
      if (arguments.length == 0) {
        return this._x();
      }

      this.xGetter = function (value) {
        return value[column.table + '.' + column.name];
      };
      return this._x(column);
    }.bind(this);

    this.x(this.columnMap[queryParams.x]);

    this.y = function (column) {
      if (arguments.length == 0) {
        return this._y();
      }

      this.yGetter = function (value) {
        return value[column.table + '.' + column.name];
      };
      return this._y(column);
    }.bind(this);

    this.y(this.columnMap[queryParams.y]);

    this.color = function (column) {
      if (arguments.length == 0) {
        return this._color();
      }

      this.colorGetter = function (value) {
        return value[column.table + '.' + column.name];
      };
      return this._color(column);
    }.bind(this);

    this.color(this.columnMap[queryParams.color]);

    this.type = function () {
      var x = this.x();
      var y = this.y();

      // TODO: probably just make it isNumeric return a boolean, assume isDiscrete if false.
      var xNumeric = grice.isNumericColumn(x);
      var yNumeric = grice.isNumericColumn(y);
      var xDiscrete = grice.isDiscreteColumn(x);
      var yDiscrete = grice.isDiscreteColumn(y);

      if (x && y && xNumeric && yNumeric) {
        return grice.CHART_TYPES.SCATTER;
      } else if (x && y && xDiscrete && yNumeric) {
        return grice.CHART_TYPES.BOX;
      } else if (!x && y && yNumeric) {
        return grice.CHART_TYPES.BOX;
      } else if (x && xNumeric && (!y || yDiscrete)) {
        // TODO: we could (should?) return BOX here and render a horizontal box plot.
        return grice.CHART_TYPES.NONE;
      } else {
        // TODO: Invalid plot, render error.
        return grice.CHART_TYPES.NONE;
      }
    }.bind(this);

    this.data = function () {
      var type = this.type();
      var rows = this.rows();

      if (type == grice.CHART_TYPES.BOX) {
        return grice.convertBoxPlotData(this.table, rows, this.xGetter, this.yGetter);
      }

      if (type == grice.CHART_TYPES.SCATTER) {
        return grice.convertScatterPlotData(rows, this.xGetter, this.yGetter)
      }

      return rows;
    }.bind(this);
  };
})();

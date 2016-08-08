(function () {
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
    controller: function (model) {
      this.model = model;
    },
    view: function (c) {
      var yColumns = c.model.columns.filter(function (column) {
        return grice.NUMERIC_COLUMNS.indexOf(column.type) > -1;
      });

      var colorColumns = c.model.columns.filter(function (column) {
        return grice.DISCRETE_COLUMNS.indexOf(column.type) > -1;
      });

      return m('div.chart-controls', [
        m(grice.ColumnPicker, c.model.columns, c.model.x, 'x-axis'),
        m(grice.ColumnPicker, yColumns, c.model.y, 'y-axis'),
        m(grice.ColumnPicker, colorColumns, c.model.color, 'color')
      ]);
    }
  };

  grice.ChartAreaComponent = {
    controller: function (model) {
      this.model = model;
      this.boxRenderer = new grice.BoxRenderer(model);
      this.scatterRenderer = new grice.ScatterRenderer(model);

      this.renderChart = function (el) {
        var type = this.model.type();

        if (type == grice.CHART_TYPES.SCATTER) {
          this.scatterRenderer.render(el);
        }else if (type == grice.CHART_TYPES.BOX) {
          this.boxRenderer.render(el);
        } else {
          console.log('render blank plot.');
        }
      }.bind(this);

      this.config = function (el, initialized) {
        if (initialized) {
          grice.ChartAreaComponent.cleanCharts(el, this.model.type());
        }

        this.renderChart(el);
      }.bind(this);
    },
    cleanCharts: function (el, type) {
      var container = d3.select(el);

      if (type !== grice.CHART_TYPES.SCATTER) {
        container.selectAll('svg.scatter').data([]).exit().remove();
      }

      if (type !== grice.CHART_TYPES.BOX) {
        container.selectAll('svg.box').data([]).exit().remove();
      }
    },
    view: function (c) {
      var type = c.model.type();
      return m('div.chart-container.u-full-width', {key: type, config: c.config});
    }
  };

  grice.createChartComponent = function (model) {
    return {
      controller: function () {
        var me = this;
        this.loading = m.prop(true);
        this.model = model;

        var loadData = function () {
          m.request({
            url: grice.generateTableQueryUrl(model.table.name, null, -1, model.queryParams)
          }).then(function (data) {
            me.loading(false);
            model.rows(data.rows);
          });
        };

        // TODO: I don't like this hack.
        // Have to do this setTimeout hack so mithril doesn't prevent the component from rendering without completing the
        // request.
        setTimeout(loadData, 0);
      },
      view: function (c) {
        // TODO: handle loading state.
        return m('div.chart', [
          m('h4', 'Chart: ' + c.model.table.name),
          m(grice.ChartControlsComponent, c.model),
          m(grice.ChartAreaComponent, c.model)
        ]);
      }
    };
  };
})();

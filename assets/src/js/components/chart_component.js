(function () {
  var loadingPlot = function (el, c) {};

  var handleVerticalLines = function (el, scale, width) {
    el.attr('x1', width / 2)
        .attr('y1', function(d) { return scale(d.bottom); })
        .attr('x2', width / 2)
        .attr('y2', function(d) { return scale(d.top); })
  };

  var handleRects = function (el, scale, width) {
    el.attr('x', 0)
        .attr('y', function(d) { return scale(d.top); })
        .attr('width', width)
        .attr('height', function (d) { return Math.abs(scale(d.bottom) - scale(d.top)); })
        .attr('height', function(d) { return scale(d.bottom) - scale(d.top); });
  };

  var handleMedianLines = function (el, scale, width) {
    el.attr('x1', 0)
        .attr('x2', width)
        .attr('y1', function(d) { return scale(d); })
        .attr('y2', function(d) { return scale(d); })
  };

  var handleWhiskers = function (el, scale, width) {
    el.attr('x1', (width / 2) - (width / 4))
        .attr('x2', (width / 2) + (width / 4))
        .attr('y1', scale)
        .attr('y2', scale);
  };

  var boxRenderer = function () {
    var width = 100;
    var height = 200;
    var domain = [];
    var scale = d3.scaleLinear();
    scale.range([height, 0]);

    var renderer = function (g) {
      g.each(function (d) {
        var boxGroup = d3.select(this);
        var verticalLines = boxGroup.selectAll('line.center').data([d.whiskers]);
        var newVerticalLines = verticalLines.enter().insert('line', 'rect')
            .attr('class', 'center')
            .attr('stroke', '#000')
            .attr('stroke-width', 1);

        handleVerticalLines(newVerticalLines, scale, width);
        handleVerticalLines(verticalLines, scale, width);

        var rects = boxGroup.selectAll('rect.box').data([d.box]);
        var newRects = rects.enter().append('rect').attr('class', 'box')
            .attr('fill', '#fff')
            .attr('stroke', '#000')
            .attr('stroke-width', 1);

        handleRects(newRects, scale, width);
        handleRects(rects, scale, width);

        var medianLines = boxGroup.selectAll('line.median').data([d.box.middle]);
        var newMedianLines = medianLines.enter().append('line')
            .attr('class', 'median')
            .attr('stroke', '#000')
            .attr('stroke-width', 1);

        handleMedianLines(newMedianLines, scale, width);
        handleMedianLines(medianLines, scale, width);

        var whiskers = boxGroup.selectAll('line.whisker').data([d.whiskers.top, d.whiskers.bottom]);
        var newWhiskers = whiskers.enter().append('line')
            .attr('class', 'whisker')
            .attr('stroke', '#000')
            .attr('stroke-width', 1);

        handleWhiskers(newWhiskers, scale, width);
        handleWhiskers(whiskers, scale, width);
      });
    };

    renderer.domain = function (d) {
      if (!arguments.length) {
        return domain
      }
      domain = d;
      scale.domain(d);
      return renderer;
    };

    renderer.width = function (w) {
      if (!arguments.length) {
        return width;
      }
      width = w;
      return renderer;
    };

    renderer.height = function (h) {
      if (!arguments.length) {
        return height;
      }
      height = h;
      return renderer;
    };

    renderer.scale = function () {
      return scale;
    };

    return renderer;
  };

  var boxPlot = function (el, c) {
    // TODO: add outliers (points above or below whiskers).
    // TODO: support grouping by a discrete column, then we can have an x-axis.
    var svgContainer = d3.select(el);
    var x = c.x();
    var y = c.y();
    var xGetter;
    var yGetter = grice.makeGetter(y.table + '.' + y.name);
    var rows = c.rows().filter(function (row) {
      return grice.isValid(yGetter(row));
    }).sort(function (a, b) {
      return grice.sortData(yGetter(a), yGetter(b));
    });

    if (x) {
      xGetter = grice.makeGetter(x.table + '.' + x.name);
    }

    var data = grice.convertBoxPlotData(rows, c.table, xGetter, yGetter);
    var renderer = boxRenderer().domain([yGetter(rows[0]), yGetter(rows[rows.length -1])]);
    var width = 100;
    var height = 200;
    var svg = svgContainer.selectAll('svg.box-plot').data(data);
    svg.enter().append("svg")
        .attr("class", "box-plot")
        .attr("width", width)
        .attr("height", height)
        .call(renderer);
    svg.call(renderer);
    svg.exit().remove();
  };

  var scatterPlot = function (el, c) {
    var xGetter = grice.makeGetter(c.x().table + '.' + c.x().name);
    var yGetter = grice.makeGetter(c.y().table + '.' + c.y().name);
    var svg = d3.select(el);
    var xMin, xMax, yMin, yMax;

    var data = c.rows().filter(function (row) {
      var x = xGetter(row);
      var y = yGetter((row));
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

      return xValid && yValid
    });

    console.log([xMin, xMax], [yMin, yMax]);

    console.log('scatter plot!');
  };

  var blankPlot = function (el, c) {
    var svg = d3.select(el);
    console.log('blank plot!');
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
    controller: function (table, x, y) {
      this.table = table;
      this.x = x;
      this.y = y;
    },
    view: function (c) {
      var yColumns = c.table.columns.filter(function (column) {
        return grice.NUMERIC_COLUMNS.indexOf(column.type) > -1;
      });
      return m('div.chart-controls', [
        m(grice.ColumnPicker, c.table.columns, c.x, 'x-axis'),
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
      return function(element) {
        var x = c.x();
        var y = c.y();
        var xNumeric = grice.isNumericColumn(x);
        var yNumeric = grice.isNumericColumn(y);
        var xDiscrete = grice.isDiscreteColumn(x);
        var yDiscrete = grice.isDiscreteColumn(y);

        if (c.loading()) {
          loadingPlot(element, c);
        } else {
          if (x && y && xNumeric && yNumeric) {
            scatterPlot(element, c);
          } else if (x && y && xDiscrete && yNumeric) {
            boxPlot(element, c);
          } else if (!x && y && yNumeric) {
            boxPlot(element, c);
          } else if (x && xNumeric && !y) {
            // TODO: Either invalid plot, so render error, or handle horizontal box plot.
            blankPlot(element, c);
          } else {
            // TODO: Invalid plot, render error.
            blankPlot(element, c);
          }
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
      this.queryParams = grice.parseQueryParams();
      var x = null;
      var y = null;
      var xName = this.queryParams.x;
      var yName = this.queryParams.y;

      if (this.queryParams.x) {
        x = this.table.columns.find(function (c) {
          if (c.table + '.' + c.name == xName) {
            return c;
          }
        });
      }

      if (this.queryParams.y) {
        y = this.table.columns.find(function (c) {
          if (c.table + '.' + c.name == yName) {
            return c;
          }
        });
      }

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
          m(grice.ChartControlsComponent, c.table, c.x, c.y, c.rows),
          m(grice.ChartComponent, c.table, c.x, c.y, c.rows, c.loading)
      ]);
    }
  };
})();

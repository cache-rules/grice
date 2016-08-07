(function () {
  var handleVerticalLines = function (el, scale, width, margin) {
    var x = (width / 2) + margin.left;

    el.attr('x1', x)
        .attr('y1', function(d) { return scale(d.bottom); })
        .attr('x2', x)
        .attr('y2', function(d) { return scale(d.top); });
  };

  var handleRects = function (el, scale, width, margin) {
    el.attr('x', margin.left)
        .attr('y', function(d) { return scale(d.top); })
        .attr('width', width)
        .attr('height', function (d) { return Math.abs(scale(d.bottom) - scale(d.top)); })
        .attr('height', function(d) { return scale(d.bottom) - scale(d.top); });
  };

  var handleMedianLines = function (el, scale, width, margin) {
    el.attr('x1', margin.left)
        .attr('x2', width + margin.left)
        .attr('y1', scale)
        .attr('y2', scale);
  };

  var handleWhiskers = function (el, scale, width, margin) {
    var x1 = (width / 2) - (width / 4) + margin.left;
    var x2 = (width / 2) + (width / 4) + margin.left;

    el.attr('x1', x1)
        .attr('x2', x2)
        .attr('y1', scale)
        .attr('y2', scale);
  };

  var handleLabels = function (el, scale, width, margin) {
    var x = margin.left;
    var y = scale(0) + (margin.bottom - 12);

    el.attr('x', x)
        .attr('y', y)
        .attr('text-anchor', 'start')
        .text(function (d) {return d});
  };

  var boxRenderer = function () {
    var width = 100;
    var height = 200;
    var domain = [];
    var scale = d3.scaleLinear();
    var margin = {
      top: 25,
      right: 25,
      bottom: 50,
      left: 35
    };

    var renderer = function (g) {
      var boxWidth = width - margin.left - margin.right;
      scale.range([height - margin.bottom, margin.top]);

      g.each(function (d) {
        var boxGroup = d3.select(this);
        var verticalLines = boxGroup.selectAll('line.center').data([d.whiskers]);
        var newVerticalLines = verticalLines.enter().insert('line', 'rect')
            .attr('class', 'center')
            .attr('stroke', '#000')
            .attr('stroke-width', 1);

        handleVerticalLines(newVerticalLines, scale, boxWidth, margin);
        handleVerticalLines(verticalLines, scale, boxWidth, margin);

        var rects = boxGroup.selectAll('rect.box').data([d.box]);
        var newRects = rects.enter().append('rect').attr('class', 'box')
            .attr('fill', '#fff')
            .attr('stroke', '#000')
            .attr('stroke-width', 1);

        handleRects(newRects, scale, boxWidth, margin);
        handleRects(rects, scale, boxWidth, margin);

        var medianLines = boxGroup.selectAll('line.median').data([d.box.middle]);
        var newMedianLines = medianLines.enter().append('line')
            .attr('class', 'median')
            .attr('stroke', '#000')
            .attr('stroke-width', 1);

        handleMedianLines(newMedianLines, scale, boxWidth, margin);
        handleMedianLines(medianLines, scale, boxWidth, margin);

        var whiskers = boxGroup.selectAll('line.whisker').data([d.whiskers.top, d.whiskers.bottom]);
        var newWhiskers = whiskers.enter().append('line')
            .attr('class', 'whisker')
            .attr('stroke', '#000')
            .attr('stroke-width', 1);

        handleWhiskers(newWhiskers, scale, boxWidth, margin);
        handleWhiskers(whiskers, scale, boxWidth, margin);

        var labels = boxGroup.selectAll('text.label').data([d.name]);
        var newLabels = labels.enter().append('text')
            .attr('class', 'label');

        handleLabels(newLabels, scale, boxWidth, margin);
        handleLabels(labels, scale, boxWidth, margin);

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

  grice.boxPlot = function (el, c) {
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

    var data = grice.convertBoxPlotData(c.table, rows, xGetter, yGetter);
    var width = 150;
    var height = 250;
    var renderer = boxRenderer()
        .width(width)
        .height(height)
        .domain([yGetter(rows[0]), yGetter(rows[rows.length -1])]);
    var svg = svgContainer.selectAll('svg').data(data);
    svg.enter().append("svg")
        .attr("class", "box-plot")
        .attr("width", width)
        .attr("height", height)
        .call(renderer);
    svg.call(renderer);
    svg.exit().remove();
  };

  grice.BoxPlotComponent = {
    controller: function () {

    },
    view: function () {

    }
  };
})();

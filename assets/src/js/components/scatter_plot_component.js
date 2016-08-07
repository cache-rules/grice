(function () {
  var cleanData = function () {};

  var handleDots = function (el, x, y) {
    el.attr('cx', x).attr('cy', y);
  };

  grice.scatterPlot = function (el, c) {
    var margin = {
      top: 25,
      right: 25,
      bottom: 50,
      left: 60
    };
    var width = el.offsetWidth;
    var height = width * (10/16);
    var xMin, xMax, yMin, yMax;
    var xScale = d3.scaleLinear().range([margin.left, width - margin.right]);
    var yScale = d3.scaleLinear().range([height - margin.bottom, margin.top]);
    var xGetter = grice.makeGetter(c.x().table + '.' + c.x().name);
    var yGetter = grice.makeGetter(c.y().table + '.' + c.y().name);
    var xMap = function (d) { return xScale(xGetter(d)); };
    var yMap = function (d) { return yScale(yGetter(d)); };
    var xAxis = d3.axisBottom(xScale);
    var yAxis = d3.axisLeft(yScale);
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

    // Don't want dots overlapping axis, so add buffer to data domain.
    // TODO: buffer should probably change in size based on range of values.
    xScale.domain([xMin - 1, xMax + 1]);
    yScale.domain([yMin - 1, yMax + 1]);

    var renderScatter = function (svg) {
      svg.each(function (d) {
        var svgEl = d3.select(this);
        var dots = svgEl.selectAll('.dot').data(d);
        var newDots = dots.enter().append('circle').attr('class', 'dot').style('fill', '#000').attr('r', 3.5);
        handleDots(newDots, xMap, yMap);
        handleDots(dots, xMap, yMap);
        dots.exit().remove();

        var xAxisEl = svg.selectAll('g.x-axis').data([1]);
        xAxisEl.enter().append('g').attr('class', 'x-axis').call(xAxis)
            .attr("transform", "translate(0," + (height - margin.bottom) + ")");
        xAxisEl.call(xAxis);

        var yAxisEl = svg.selectAll('g.y-axis').data([1]);
        yAxisEl.enter().append('g').attr('class', 'y-axis').call(yAxis)
            .attr("transform", "translate(" + margin.left + ",0)");
        yAxisEl.call(yAxis);
      });
    };

    var svgContainer = d3.select(el);
    var svg = svgContainer.selectAll('svg').data([data]);

    svg.exit().remove();

    svg.enter().append('svg')
        .attr('class', 'scatter-plot')
        .attr('width', width)
        .attr('height', height)
        .call(renderScatter);

    svg.attr('class', 'scatter-plot')
        .attr('width', width)
        .attr('height', height)
        .call(renderScatter);
  };

  grice.ScatterPlotComponent = {
    controller: function () {

    },
    config: function () {

    },
    view: function (c) {

    }
  };
})();

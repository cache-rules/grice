(function () {
  var handleVerticalLines = function (el, scale, width, margin, padding) {
    var x = (width / 2) + margin.left + padding;

    el.attr('x1', x)
        .attr('y1', function(d) { return scale(d.bottom); })
        .attr('x2', x)
        .attr('y2', function(d) { return scale(d.top); })
        .attr('stroke', '#000')
        .attr('stroke-width', 1);
  };

  var handleRects = function (el, scale, width, margin, padding) {
    el.attr('x', margin.left + padding)
        .attr('y', function(d) { return scale(d.top); })
        .attr('width', width)
        .attr('height', function (d) { return Math.abs(scale(d.bottom) - scale(d.top)); })
        .attr('height', function(d) { return scale(d.bottom) - scale(d.top); })
        .attr('fill', '#fff')
        .attr('stroke', '#000')
        .attr('stroke-width', 1);
  };

  var handleMedianLines = function (el, scale, width, margin, padding) {
    el.attr('x1', margin.left + padding)
        .attr('x2', width + margin.left + padding)
        .attr('y1', scale)
        .attr('y2', scale)
        .attr('stroke', '#000')
        .attr('stroke-width', 1);
  };

  var handleWhiskers = function (el, scale, width, margin, padding) {
    var x1 = (width / 2) - (width / 4) + margin.left;
    var x2 = (width / 2) + (width / 4) + margin.left;

    el.attr('x1', x1 + padding)
        .attr('x2', x2 + padding)
        .attr('y1', scale)
        .attr('y2', scale)
        .attr('stroke', '#000')
        .attr('stroke-width', 1);
  };

  var handleLabels = function (el, scale, width, margin) {
    var x = margin.left;
    var y = scale(0) + (margin.bottom - 12);

    el.attr('x', x)
        .attr('y', y)
        .attr('text-anchor', 'start')
        .text(function (d) {return d});
  };

  grice.BoxRenderer = function (model) {
    var width = 150;
    var height = 300;
    var margin = {
      top: 15,
      right: 15,
      bottom: 50,
      left: 15
    };
    var boxPadding = 0;
    var yScale = d3.scaleLinear();
    var yAxis = d3.axisLeft(yScale);

    this.width = function (value) {
      return width;
    }.bind(this);

    this.height = function (value) {
      return height;
    }.bind(this);

    this.marginTop = function (value) {
      if (arguments.length > 0) {
        this.margin.top = value;
        return this;
      }

      return margin.top;
    }.bind(this);

    this.marginRight = function (value) {
      if (arguments.length > 0) {
        this.margin.right = value;
        return this;
      }

      return margin.right;
    }.bind(this);

    this.marginBottom = function (value) {
      if (arguments.length > 0) {
        this.margin.bottom = value;
        return this;
      }

      return margin.bottom;
    }.bind(this);

    this.marginLeft = function (value) {
      if (arguments.length > 0) {
        this.margin.left = value;
        return this;
      }

      return margin.left;
    }.bind(this);

    this.margin = {
      top: this.marginTop,
      right: this.marginRight,
      bottom: this.marginBottom,
      left: this.marginLeft
    };

    var renderPlot = function (d) {
      var boxWidth = width - margin.left - margin.right - boxPadding;
      var svgEl = d3.select(this).attr('width', width).attr('height', height);
      var centerLine = svgEl.selectAll('line.center').data([d.whiskers]);
      var newCenterLine = centerLine.enter().append('line').attr('class', 'center');

      handleVerticalLines(centerLine, yScale, boxWidth, margin, boxPadding);
      handleVerticalLines(newCenterLine, yScale, boxWidth, margin, boxPadding);

      var rects = svgEl.selectAll('rect.box').data([d.box]);
      var newRects = rects.enter().append('rect').attr('class', 'box');

      handleRects(newRects, yScale, boxWidth, margin, boxPadding);
      handleRects(rects, yScale, boxWidth, margin, boxPadding);

      var medianLines = svgEl.selectAll('line.median').data([d.box.middle]);
      var newMedianLines = medianLines.enter().append('line').attr('class', 'median');

      handleMedianLines(newMedianLines, yScale, boxWidth, margin, boxPadding);
      handleMedianLines(medianLines, yScale, boxWidth, margin, boxPadding);

      var whiskers = svgEl.selectAll('line.whisker').data([d.whiskers.top, d.whiskers.bottom]);
      var newWhiskers = whiskers.enter().append('line').attr('class', 'whisker');

      handleWhiskers(newWhiskers, yScale, boxWidth, margin, boxPadding);
      handleWhiskers(whiskers, yScale, boxWidth, margin, boxPadding);

      var labels = svgEl.selectAll('text.label').data([d.name]);
      var newLabels = labels.enter().append('text').attr('class', 'label');

      handleLabels(newLabels, yScale, boxWidth, margin, boxPadding);
      handleLabels(labels, yScale, boxWidth, margin, boxPadding);

      // TODO: find a way to render the axis scale.

      //var axis = svgEl.selectAll('g.y-axis').data([1]);
      //var newAxis = axis.enter().append('g').attr('class', 'y-axis');

      //axis.attr("transform", "translate(" + margin.left + ",0)").call(yAxis);
      //newAxis.attr("transform", "translate(" + margin.left + ",0)").call(yAxis);
    };

    this.render = function (el) {
      var data = model.data();
      yScale.domain([data.min, data.max]);
      yScale.range([height - margin.bottom, margin.top]);

      var svg = d3.select(el).selectAll('svg.box').data(data.rows);
      svg.exit().remove();
      svg.enter().append('svg').attr('class', 'box').each(renderPlot);
      svg.each(renderPlot);
    };
  };
})();

(function () {
  grice.ScatterRenderer = function (model) {
    var width = 1000;
    var height = 625;
    var margin = {
      top: 25,
      right: 25,
      bottom: 50,
      left: 80
    };
    var xScale = d3.scaleLinear();
    var yScale = d3.scaleLinear();
    var xAxis = d3.axisBottom(xScale);
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

    this.render = function (el) {
      width = el.offsetWidth;
      height = Math.min(580, width * (10/16));
      var chartContainer = d3.select(el);
      var scatterData = model.data();
      var data = scatterData.data;
      // Reset the color scale on every render in order to get a fresh domain for the legend.
      var colorScale = d3.scaleOrdinal().range(d3.schemeCategory10);
      var xMap = function (d) { return xScale(model.xGetter(d)); };
      var yMap = function (d) { return yScale(model.yGetter(d)); };
      var colorMap = function (d) { return colorScale(model.colorGetter(d)); };

      xScale.domain(scatterData.xDomain).range([margin.left, width - margin.right]);
      yScale.domain(scatterData.yDomain).range([height - margin.bottom, margin.top]);

      var svg = chartContainer.selectAll('svg.scatter').data([data]);
      var newSvg = svg.enter().append('svg').attr('class', 'scatter');
      svg.exit().remove();

      newSvg.attr('width', width).attr('height', height);
      svg.attr('width', width).attr('height', height);

      var renderPlot = function (data) {
        var svgSel = d3.select(this);
        var xAxisEl = svgSel.selectAll('g.x-axis').data([1]);
        var newXAxisEl = xAxisEl.enter().append('g').attr('class', 'x-axis');

        xAxisEl.attr("transform", "translate(0," + (height - margin.bottom) + ")").call(xAxis);
        newXAxisEl.attr("transform", "translate(0," + (height - margin.bottom) + ")").call(xAxis);

        var yAxisEl = svgSel.selectAll('g.y-axis').data([1]);
        var newYAxisEl = yAxisEl.enter().append('g').attr('class', 'y-axis');

        yAxisEl.attr("transform", "translate(" + margin.left + ",0)").call(yAxis);
        newYAxisEl.attr("transform", "translate(" + margin.left + ",0)").call(yAxis);

        var dots = svgSel.selectAll('circle.dot').data(data);
        var newDots = dots.enter().append('circle').attr('class', 'dot').attr('r', 3.5);

        dots.attr('cx', xMap).attr('cy', yMap);
        newDots.attr('cx', xMap).attr('cy', yMap);

        if (model.color()) {
          dots.attr('fill', colorMap);
          newDots.attr('fill', colorMap);
          // TODO: render legend.
        } else {
          dots.attr('fill', '#000');
          newDots.attr('fill', '#000');
        }

        dots.exit().remove();
      };

      newSvg.each(renderPlot);
      svg.each(renderPlot);
    };
  };
})();

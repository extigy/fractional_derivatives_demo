var w = 750;
var h = 500;
var m = 50;

var datax;
var dataRe;
var dataIm;
var datadRe;
var datadIm;

var updateData = function(formula,dAlpha){
  var fOfxNode = math.parse(formula);
  var dfdxNode = math.fderivative(math.parse(formula).toString(),'x',dAlpha);

  N = 10000
  datax = Array.from(Array.apply(null, {length: N}).map(Function.call, Number),x => ((x-5000) / 50)+1e-8);
  dataRe = datax.map(function(e, i) {
    fxval = fOfxNode.eval({x: e})
    if (typeof(fxval) == "number"){
      return [e, fxval];
    } else {
      return [e, fxval.re];
    }
  });
  dataIm = datax.map(function(e, i) {
    fxval = fOfxNode.eval({x: e})
    if (typeof(fxval) == "number"){
      return [e, 0.0];
    } else {
      return [e, fxval.im];
    }
  });

  datadRe = datax.map(function(e, i) {
    fxval = dfdxNode.eval({x: e})
    if (typeof(fxval) == "number"){
      return [e, fxval];
    } else {
      return [e, fxval.re];
    }
  });
  datadIm = datax.map(function(e, i) {
    fxval = dfdxNode.eval({x: e})
    if (typeof(fxval) == "number"){
      return [e, 0.0];
    } else {
      return [e, fxval.im];
    }
  });
}
updateData('x^3','1');

var x = d3.scaleLinear().domain([-0.47,10.2]).range([0, w]);
var y = d3.scaleLinear().domain([-0.54,10.2]).range([h, 0]);

var line = d3.line().x(function(d) {return x(d[0]);}).y(function(d) {return y(d[1]);});

var graph = d3.select("#FDgraph").attr("width", w).attr("height", h);

var xAxis = d3.axisBottom(x);
gX = graph.append("svg:g").attr("class", "x axis").attr("transform", "translate(0," + (h - 25) + ")").call(xAxis);
var xGrid = d3.axisBottom(x).tickSize(h);
gXgrid = graph.append("svg:g").attr("class", "x grid").call(xGrid);

var yAxis = d3.axisLeft(y);
gY = graph.append("svg:g").attr("class", "y axis").attr("transform", "translate(" + 33 + ",0)").call(yAxis);
var yGrid = d3.axisLeft(y).tickSize(-w);
gYgrid = graph.append("svg:g").attr("class", "y grid").call(yGrid);

var zoom = d3.zoom().scaleExtent([0.04, 80]).translateExtent([[-15000, -10000], [w + 15000, h + 10000]]).on("zoom", zoomed);
graph.call(zoom);

dataLineRe = graph.append("svg:path").attr("class","dataLineRe").attr("d", line(dataRe));
dataLineIm = graph.append("svg:path").attr("class","dataLineIm").attr("d", line(dataIm));
dataLinedRe = graph.append("svg:path").attr("class","dataLinedRe").attr("d", line(datadRe));
dataLinedIm = graph.append("svg:path").attr("class","dataLinedIm").attr("d", line(datadIm));

var ordinal = d3.scaleOrdinal()
  .domain(["Re(f(x))", "Im(f(x))", "Re(d\u1D45f/dx\u1D45)", "Im(d\u1D45f/dx\u1D45)"])
  .range([ "steelblue", "rgb(255, 127, 14)","rgb(127, 200, 14)","rgb(250, 14, 14)"]);

graph.append("g")
  .attr("class", "legendOrdinal")
  .attr("transform", "translate("+(w-120)+",20)");

var legendOrdinal = d3.legendColor()
  .shape("path", d3.symbol().type(d3.symbolCircle).size(50)())
  .shapePadding(10)
  .cellFilter(function(d){ return d.text !== "e" })
  .scale(ordinal);

graph.select(".legendOrdinal").call(legendOrdinal);

function zoomed() {
  dataLineRe.attr("transform", d3.event.transform);
  dataLineIm.attr("transform", d3.event.transform);
  dataLinedRe.attr("transform", d3.event.transform);
  dataLinedIm.attr("transform", d3.event.transform);
  gX.call(xAxis.scale(d3.event.transform.rescaleX(x)));
  gXgrid.call(xGrid.scale(d3.event.transform.rescaleX(x)));
  gY.call(yAxis.scale(d3.event.transform.rescaleY(y)));
  gYgrid.call(yGrid.scale(d3.event.transform.rescaleY(y)));
}

$("#fOfx").change(function(e){
  updateData($("#fOfx").val(),$("#dAlpha").val());
  dataLineRe.attr("d", line(dataRe));
  dataLineIm.attr("d", line(dataIm));
  dataLinedRe.attr("d", line(datadRe));
  dataLinedIm.attr("d", line(datadIm));
});
$("#dAlpha").change(function(e){
  updateData($("#fOfx").val(),$("#dAlpha").val());
  dataLineRe.attr("d", line(dataRe));
  dataLineIm.attr("d", line(dataIm));
  dataLinedRe.attr("d", line(datadRe));
  dataLinedIm.attr("d", line(datadIm));
});


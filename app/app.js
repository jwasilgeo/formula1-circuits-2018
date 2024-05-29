if (window.Promise && window.fetch) {
  main();
} else {
  // polyfills for Promise and fetch for non-modern browsers
  // https://philipwalton.com/articles/loading-polyfills-only-when-needed/
  loadScript('https://cdn.polyfill.io/v2/polyfill.min.js?features=Promise,fetch', main);
}

function main() {
  var littleCityRadius = 2,
    bigCityRadius = 10,
    transitionDuration = 1250,
    transitionDelay = 1000;

  // load Formula 1 Circuits 2018 topojson
  d3.json('./F1_Circuits_2018_topojson.json')
    .then(function(f1CircuitsTopoJson) {
      // topojson to geojson conversion
      var f1CircuitsGeoJson = topojson.feature(f1CircuitsTopoJson, f1CircuitsTopoJson.objects.F1_Circuits_2018);

      var svg = d3.select('svg.circuits-map');
      var dimensions = svg.attr('viewBox').split(' ');
      var width = dimensions[2];
      var height = dimensions[3];

      // create a collection of information that contains
      // the svg path and feature name for each F1 circuit geojson
      var allCircuitsInformation = f1CircuitsGeoJson.features.map(function(geoJsonFeature) {
        // each geojson feature is converted to a svg pathString (the "d" attribute)
        // with a uniquely centered D3 projection at that feature's centroid
        var featureCentroid = d3.geoCentroid(geoJsonFeature);
        var featureCentroidRotation = [-featureCentroid[0], -featureCentroid[1]];

        var projection = d3.geoMercator()
          .translate([width / 2, height / 2])
          // for a width of 500px, 1200000 is a good scale value (assuming also that height === width)
          // the calcuation for any width then becomes 2400 * width
          .scale(2400 * width)
          .rotate(featureCentroidRotation);

        var geoPathGenerator = d3.geoPath(projection);

        return {
          pathString: geoPathGenerator(geoJsonFeature),
          name: geoJsonFeature.properties.Name
        };
      });

      // select the single svg <path> element
      // and set its "d" attribute value as the shape of the first F1 circuit

      // do the same for the other <path> element that is used
      // to help accomplish the neon glow effect
      svg.selectAll('path.circuit-path-main, path.circuit-path-glow')
        .attr('d', allCircuitsInformation[0].pathString);

      // set the displayed circuit name to the first F1 circuit
      d3.select('.circuit-info-text')
        .text(allCircuitsInformation[0].name);

      // using the main <path> element and the neon glow <path> element,
      // cycle endlessly over each F1 circuit svg path info
      // and change/transition the "d" attribute value along with the display text
      animateTheCircuits(allCircuitsInformation);

      generateWorldMap(f1CircuitsGeoJson);
    });

  function generateWorldMap(f1CircuitsGeoJson) {
    d3.json('./node_modules/world-atlas/world/110m.json')
      .then(function(world) {
        var svg = d3.select('svg.world-map');
        var dimensions = svg.attr('viewBox').split(' ');
        var width = dimensions[2];
        var height = dimensions[3];

        var projection = d3.geoRobinson()
          .translate([width / 2, height / 2])
          .scale((width) / (2 * Math.PI));

        var geoPathGenerator = d3.geoPath()
          .projection(projection);

        svg.select('path.land')
          .attr('d', geoPathGenerator(topojson.feature(world, world.objects.land)));

        svg.selectAll('circle.cities')
          .data(f1CircuitsGeoJson.features)
          .enter().append('circle')
          .attr('r', littleCityRadius)
          .attr('cx', function(geoJsonFeature) {
            return geoPathGenerator.centroid(geoJsonFeature)[0];
          })
          .attr('cy', function(geoJsonFeature) {
            return geoPathGenerator.centroid(geoJsonFeature)[1];
          })
          .classed('cities', true)
          .attr('filter', 'url(#glowFilter)')
          .style('fill', 'url(#radialGradient)')
          // make the first circle bigger right away
          .filter(function(d, idx) {
            return idx === 0;
          })
          .raise()
          .attr('r', bigCityRadius);
      });
  }

  function animateTheCircuits(allCircuitsInformation) {
    // modify the info array in-place to achieve continuous cycling
    var start = allCircuitsInformation.shift();
    var end = allCircuitsInformation[0];
    allCircuitsInformation.push(start);

    var interpolator = flubber.interpolate(start.pathString, end.pathString);

    d3.selectAll('path.circuit-path-main, path.circuit-path-glow')
      .transition()
      .duration(transitionDuration)
      .delay(transitionDelay)
      .attrTween('d', function() {
        return interpolator;
      })
      .on('start', function(d, idx) {
        if (idx === 0) {
          // update the displayed circuit name halfway during the shape animation
          d3.timeout(function() {
            d3.select('.circuit-info-text')
              .text(end.name);
          }, (d3.active(this).duration() * 0.5));

          // shrink start circle and then grow end circle
          d3.selectAll('circle.cities')
            .filter(function(d) {
              return d.properties.Name === start.name;
            })
            .transition()
            .duration(transitionDuration)
            .attr('r', littleCityRadius);

          d3.selectAll('circle.cities')
            .filter(function(d) {
              return d.properties.Name === end.name;
            })
            .raise()
            .transition()
            .duration(transitionDuration)
            .attr('r', bigCityRadius);
        }
      })
      .on('end', function(d, idx) {
        if (idx === 0) {
          // rinse and repeat
          animateTheCircuits(allCircuitsInformation);
        }
      });
  }
}

function loadScript(src, done) {
  var script = document.createElement('script');
  script.src = src;
  script.onload = function() {
    done();
  };
  script.onerror = function() {
    var error = new Error('Failed to load script ' + src);
    // Initiate all other code paths.
    // If there's an error loading the polyfills, handle that
    // case gracefully and track that the error occurred.
    console.error(error);
  };
  document.body.appendChild(script);
}


var originShift = 2 * Math.PI * 6378137 / 2.0;
var initialResolution = 2 * Math.PI * 6378137 / 256.0;
function meterToPixels(mx, my, zoom) {
    var res = initialResolution / (1 << zoom);
    var px = (mx + originShift) / res;
    var py = (my + originShift) / res;
    return [px, py];
}


var StreetLayer = L.CanvasLayer.extend({

  options: {
    user: "pulsemaps",
    table: "txtor",
    column: "mm",
    countby: "sqrt(avg(ac))",
    resolution: 1,
    step: 1,
    steps: 720,
    start_date: 445, //'2013-03-22 00:00:00+00:00',
    end_date: 1419 //'2013-03-22 23:59:57+00:00'
  },

  initialize: function() {
    L.CanvasLayer.prototype.initialize.call(this);
    this.on('tileAdded', function(t) {
      this.getProbsData(t, t.zoom);
    }, this);
    this.MAX_UNITS = this.options.steps + 2;
    this.force_map = {};
    this.time = 0;
    this.sprites = []
    this.render_options = {
      part_min_size: 5,
      part_inc: 10
    }
    this.precache_sprites = this.precache_sprites.bind(this)

    this.precache_sprites();
  },

  precache_sprites: function() {
    this.sprites = []
    var sprite_size = function(size, alpha) {
     size = size >> 0;
     return Sprites.render_to_canvas(function(ctx, w, h) {
        Sprites.draw_circle_glow(ctx, size, [255, 255, 255, alpha*255])
        //Sprites.circle(ctx, size, 'rgba(255, 255, 255, 0.4)')
      }, size, size);
    }
    var ro = this.render_options;
    for(var i = 0; i < 7; ++i) {
      this.sprites.push(sprite_size(ro.part_min_size + i*ro.part_inc, 0.01 + i/5));
    }
  },

  set_time: function(t) {
    this.time = t;
  },


  onAdd: function (map) {
    L.CanvasLayer.prototype.onAdd.call(this, map);
    var origin = this._map._getNewTopLeftPoint(this._map.getCenter(), this._map.getZoom());
    this._ctx.translate(-origin.x, -origin.y);
    this._backCtx.translate(-origin.x, -origin.y);
  },

  _render: function(delta) {
    this._canvas.width = this._canvas.width;
    var origin = this._map._getNewTopLeftPoint(this._map.getCenter(), this._map.getZoom());
    this._ctx.translate(-origin.x, -origin.y);
    this._ctx.globalCompositeOperation = 'lighter';

    var ctx = this._ctx;
    var time = this.time;
    var s = 2
    for(var tile in this._tiles) {
      var tt = this._tiles[tile]
      var x = tt.x
      var y = tt.y;
      var count = tt.count;
      var len = tt.len
      for(var i = 0; i < len; ++i) {
        var base_time = this.MAX_UNITS * i + time
        var c = count[base_time];
        if(c) {
          var sp = this.sprites[c]
          ctx.drawImage(
            sp,
            x[i] - (sp.width>> 1),
            y[i] - (sp.height>>1))
        }
        /*
        c = count[base_time - 1];
        if(c){
          ctx.drawImage(
            this.entities.sprites[0][0],
            (x[i] - s*2)>>0,
            (y[i] - s*2)>>0);
        }
        */
      }
    }


  },

  tile: function(sql, callback) {
    var base_url = 'http://pulsemaps.cartodb.com/'
    $.getJSON(base_url + "api/v2/sql?q=" + encodeURIComponent(sql), function (data) {
      callback(data);
    });
  },

  pre_cache_data: function(rows, coord, zoom) {
    var row;
    var count;
    var xcoords;
    var ycoords;
    var values;
    var key;

    x = new Int32Array(rows.length);
    y = new Int32Array(rows.length);
    speeds = new Uint8Array(rows.length * this.MAX_UNITS);// 256 months
    count = new Uint8Array(rows.length * this.MAX_UNITS);// 256 monthsrr

    // base tile x, y
    var total_pixels = 256 << zoom;
    var max_val = 0;

    for (var i in rows) {
      row = rows[i];
      pixels = meterToPixels(row.x, row.y, zoom); 
      key = '' + (pixels[0] >> 0) + "_" + ((total_pixels - pixels[1])>>0)
      x[i] = pixels[0] >> 0;
      y[i] = (total_pixels - pixels[1])>>0;
      var base_idx = i * this.MAX_UNITS;
      //def[row.sd[0]] = row.se[0];
      for (var j = 0; j < row.dates.length; ++j) {
        //var dir = row.heads[j] + 90;
        //var s = row.speeds[j]
        //dx[base_idx + row.dates[j]] = Math.cos(dir*Math.PI/180);
        //dy[base_idx + row.dates[j]] = Math.sin(dir*Math.PI/180);
        //speeds[base_idx + row.dates[j]] = row.speeds[j];
        count[base_idx + row.dates[j]] = Math.min(6, Math.ceil(row.vals[j]/10)) >> 0 ;
      }
      /*
      for (var j = 1; j < this.MAX_UNITS; ++j) {
        count[base_idx + j] += count[base_idx + j - 1]/2.0
      }
      */
    }

    //this.force_keys = Object.keys(this.force_map);

    return {
      count: count,
      x: x,
      y: y,
      len: rows.length
      /*length: rows.length,
      xcoords: xcoords,
      ycoords: ycoords,
      speeds: speeds,
      heads: heads,
      size: 1 << (this.resolution * 2)
      */
    };
  },

  getProbsData: function(coord, zoom) {
    var self = this;
    sql = "WITH hgrid AS ( " +
    "    SELECT CDB_RectangleGrid( " +
    "       CDB_XYZ_Extent({0}, {1}, {2}), ".format(coord.x, coord.y, zoom) +
    "       CDB_XYZ_Resolution({0}) * {1}, ".format(zoom, this.options.resolution) +
    "       CDB_XYZ_Resolution({0}) * {1} ".format(zoom, this.options.resolution) +
    "    ) as cell " +
    " ) " +
    " SELECT  " +
    "    x, y, array_agg(c) vals, array_agg(d) dates " +
    " FROM ( " +
    "    SELECT " +
    "      round(CAST (st_xmax(hgrid.cell) AS numeric),4) x, round(CAST (st_ymax(hgrid.cell) AS numeric),4) y, " +
    "      {0} c, floor(({1}- {2})/{3}) d ".format(this.options.countby, this.options.column, this.options.start_date, this.options.step) +
    "    FROM " +
    "        hgrid, {0} i ".format(this.options.table) +
    "    WHERE " +
    "        i.the_geom_webmercator && CDB_XYZ_Extent({0}, {1}, {2}) ".format(coord.x, coord.y, zoom) +
    "        AND ac > 6 AND ST_Intersects(i.the_geom_webmercator, hgrid.cell) " +
    "    GROUP BY " +
    "        hgrid.cell, floor(({0} - {1})/{2})".format(this.options.column, this.options.start_date, this.options.step) +
    " ) f GROUP BY x, y";

    this.tile(sql, function (data) {
      var time_data = self.pre_cache_data(data.rows, coord, zoom);
      self._tileLoaded(coord, time_data);
    });
  }

});


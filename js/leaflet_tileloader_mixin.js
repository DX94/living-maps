
L.Mixin.TileLoader = {

  _initTileLoader: function() {
    this._tiles = {}
    this._tilesToLoad = 0;
    this._pendingQueue = {};
    this._map.on({
        'moveend': this._updateTiles
    }, this);
    this._updateTiles();
  },

  _removeTileLoader: function() {
    map.off({
        'moveend': this._updateTiles
    }, this);
    //TODO: remove tiles
  },

  _updateTiles: function () {

      if (!this._map) { return; }

      var bounds = this._map.getPixelBounds(),
          zoom = this._map.getZoom(),
          tileSize = this.options.tileSize;

      if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
          return;
      }

      var nwTilePoint = new L.Point(
              Math.floor(bounds.min.x / tileSize),
              Math.floor(bounds.min.y / tileSize)),

          seTilePoint = new L.Point(
              Math.floor(bounds.max.x / tileSize),
              Math.floor(bounds.max.y / tileSize)),

          tileBounds = new L.Bounds(nwTilePoint, seTilePoint);

      this._addTilesFromCenterOut(tileBounds);
      this._removeOtherTiles(tileBounds);
  },

  _removeOtherTiles: function (bounds) {
      var kArr, x, y, key;

      for (key in this._tiles) {
          if (this._tiles.hasOwnProperty(key)) {
              kArr = key.split(':');
              x = parseInt(kArr[0], 10);
              y = parseInt(kArr[1], 10);

              // remove tile if it's out of bounds
              if (x < bounds.min.x || x > bounds.max.x || y < bounds.min.y || y > bounds.max.y) {
                  this._removeTile(key);
              }
          }
      }
  },

  _removeTile: function (key) {
    this.fire('tileRemoved', this._tiles[key]);
    delete this._tiles[key];
    delete this._pendingQueue[key];
  },

  _tileShouldBeLoaded: function (tilePoint) {
    var key = (tilePoint.x + ':' + tilePoint.y + ':' + tilePoint.zoom) 
    return !(key in this._tiles) && !(key in this._pendingQueue)
  },

  _tileLoaded: function(tilePoint, tileData) {
    this._tilesToLoad--;
    var key = tilePoint.x + ':' + tilePoint.y + ':' + tilePoint.zoom
    this._tiles[key] = tileData;
    delete this._pendingQueue[key];
    if(this._tilesToLoad === 0) {
      this.fire("tilesLoaded");
      this._onTilesFinishLoading && this._onTilesFinishLoading();
    }
  },

  _addTilesFromCenterOut: function (bounds) {
      var queue = [],
          center = bounds.getCenter(),
          zoom = this._map.getZoom();

      var j, i, point;

      for (j = bounds.min.y; j <= bounds.max.y; j++) {
          for (i = bounds.min.x; i <= bounds.max.x; i++) {
              point = new L.Point(i, j);
              point.zoom =  zoom;

              if (this._tileShouldBeLoaded(point)) {
                  queue.push(point);
              }
          }
      }

      var tilesToLoad = queue.length;

      if (tilesToLoad === 0) { return; }

      this._onTilesStartLoading && this._onTilesStartLoading();

      // load tiles in order of their distance to center
      queue.sort(function (a, b) {
          return a.distanceTo(center) - b.distanceTo(center);
      });

      this._tilesToLoad += tilesToLoad;

      for (i = 0; i < tilesToLoad; i++) {
        var point = queue[i];
        var key = (point.x + ':' + point.y + ':' + point.zoom) 
        this._pendingQueue[key] = true;
        this.fire('tileAdded', point);
      }

  },

  /**
   * given x, y, z returns the top-left corner of the tile in pixels,
   * useful for rendering tiles with canvas
   */
  _getTilePos: function (tilePoint) {
    var ts = this.options.tileSize;
    return new L.Point(ts*tilePoint.x, ts*tilePoint.y);
  }

}

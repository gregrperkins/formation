/**
 * Create a slice of middleware that returns the cached value of
 *  the str, unless it's dirty, in which case, it waits for the update
 *  event and sends the response then.
 *
 * @param {StringElement} str
 * @return {function(http.ServerRequest, http.ServerResponse)}
 */
var ConnectSink = function (strEl) {
  return function (req, res, next) {
    // Probably 404 if it's gone, unless another handles it
    if (strEl.isDisposed) return next();

    // Don't care if it's closed prematurely, noop then.
    req.on('end', function () {
      // If it's not being rebuilt, send away!
      if (!strEl.isDirty) {
        return res.end(strEl.cached);
      }

      // Otherwise hold the horses for an update
      strEl.once('update', function () {
        res.end(strEl.cached);
      });
    });
  };
};

module.exports = ConnectSink;

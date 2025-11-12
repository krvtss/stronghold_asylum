(function($) {

  $.fn.sequencer = function(options, cb) {

    var self = this,
        paths = [],
        cache = {},
        currentIndex = -1,
        sectionHeight,
        windowHeight,
        currentScroll,
        percentageScroll,
        index,
        firstLoaded = false,
        backgroundLoadingActive = true,
        backgroundLoadIndex = 0;

// default settings - optimized for faster loading
options = $.extend({
  count: 0,
  path: ".",
  ext: "jpg",
  start: 1,
  padding: 4,
  preloadNext: 5,
  batchSize: 15,
  batchDelay: 50,
  initialBatch: 30,
  scrollOffset: 0  // ADD THIS LINE
}, options || {});

    // remove trailing slash if present
    if (options.path.substr(-1) === "/") {
      options.path = options.path.substr(0, options.path.length - 1);
    }

    // zero-pad helper
    function pad(num, size) {
      var s = String(num);
      while (s.length < size) s = "0" + s;
      return s;
    }

    // build all possible paths
    for (var i = options.start; i < options.start + options.count; i++) {
      var frame = pad(i, options.padding);
      paths.push(options.path + "/" + frame + "." + options.ext);
    }

    // Load an image
    function loadFrame(idx, isFirst) {
      if (cache[idx]) return Promise.resolve(); // already cached
      if (idx < 0 || idx >= paths.length) return Promise.resolve();

      return new Promise(function(resolve) {
        var img = new Image();
        
        img.onload = function() {
          cache[idx] = img;
          
          // First frame callback
          if (isFirst && !firstLoaded) {
            firstLoaded = true;
            if (typeof cb === "function") cb();
          }
          
          resolve();
        };
        
        img.onerror = function() {
          resolve(); // continue even if one image fails
        };
        
        img.src = paths[idx];
      });
    }

    // Progressive background loading
    function loadNextBatch() {
      if (!backgroundLoadingActive || backgroundLoadIndex >= paths.length) {
        return;
      }

      var loadPromises = [];
      var endIndex = Math.min(backgroundLoadIndex + options.batchSize, paths.length);
      
      // Load batch
      for (var i = backgroundLoadIndex; i < endIndex; i++) {
        if (!cache[i]) {
          loadPromises.push(loadFrame(i));
        }
      }
      
      backgroundLoadIndex = endIndex;

      // Schedule next batch - continues until all frames are loaded
      Promise.all(loadPromises).then(function() {
        if (backgroundLoadIndex < paths.length) {
          setTimeout(loadNextBatch, options.batchDelay);
        }
      });
    }

    // Show a frame
    function showFrame(idx) {
      if (idx < 0 || idx >= paths.length) return;

      // Prioritize loading current frame if not cached
      if (!cache[idx]) {
        loadFrame(idx);
      }

      // Set current visible image
      $("img.sequencer").attr("src", paths[idx]);

      // Preload nearby frames (priority loading)
      for (var i = 1; i <= options.preloadNext; i++) {
        if (idx + i < paths.length && !cache[idx + i]) loadFrame(idx + i);
        if (idx - i >= 0 && !cache[idx - i]) loadFrame(idx - i);
      }
    }

// Listen for scroll events
    $(window).on("scroll resize", function() {
      // Only calculate target index if smoothPlayback is disabled
      if (!options.smoothPlayback) {
        sectionHeight = $(self).height();
        windowHeight = $(this).height();
        currentScroll = Math.max(0, $(this).scrollTop() - options.scrollOffset); 
        percentageScroll = 100 * currentScroll / (sectionHeight - windowHeight);
        index = Math.round(percentageScroll / 100 * (paths.length - 1));
        if (index < 0) index = 0;
        if (index >= paths.length) index = paths.length - 1;

        if (index !== currentIndex) {
          currentIndex = index;
          showFrame(index);
        }
      }
      // If smoothPlayback is enabled, the main script handles frame updates
    });

    // Initialize: aggressive loading strategy
    loadFrame(0, true).then(function() {
      showFrame(0);
      
      // Load initial batch aggressively for smooth initial scrolling
      var quickLoadPromises = [];
      var initialCount = Math.min(options.initialBatch, paths.length);
      
      for (var i = 1; i < initialCount; i++) {
        quickLoadPromises.push(loadFrame(i));
      }
      
      // Start continuous background loading immediately (don't wait for initial batch)
      backgroundLoadIndex = initialCount;
      setTimeout(loadNextBatch, 100); // start after 100ms
      
      // Also continue loading remaining frames after initial batch completes
      Promise.all(quickLoadPromises).then(function() {
        // Background loading already started, just ensure it continues
        if (backgroundLoadIndex < paths.length) {
          loadNextBatch();
        }
      });
    });
// Expose showFrame method for external control
    this.showFrame = showFrame;
    window.sequencerInstance = this;
    return this;
  };

}(jQuery));
/* Engagement time for Umami, which only knows "visit duration" between two pageviews (so a single-page visit reads 0).
   Counts seconds the tab is visible and sends one event as each threshold passes: engaged-10s, 30s, 60s, 120s, 300s.
   Event names carry the time, no properties (Umami bills each stored property as an event). The page comes with the event,
   so Umami > Events, filtered by page, shows how many visitors reached each mark on each lab. Cookie-free, nothing stored. */
(function () {
  var MARKS = [10, 30, 60, 120, 300], next = 0, secs = 0;
  setInterval(function () {
    if (document.visibilityState !== 'visible') return;
    secs++;
    if (next < MARKS.length && secs >= MARKS[next]) {
      if (window.umami && typeof window.umami.track === 'function') window.umami.track('engaged-' + MARKS[next] + 's');
      next++;                                     /* a mark is spent even if Umami was blocked or still loading */
    }
  }, 1000);
})();

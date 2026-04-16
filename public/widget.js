/*!
 * CoachHub Booking Widget — embeddable loader
 * ---------------------------------------------------------------
 * Drop-in script that turns any <div data-coachhub-widget="booking">
 * into an inline booking iframe pointing at /embed/booking.
 *
 * Usage (paste in Squarespace/WordPress/Linktree custom HTML block):
 *
 *   <div data-coachhub-widget="booking"
 *        data-coach="john-smith"
 *        data-session=""            <!-- optional: preselect session type id -->
 *        data-theme="light"         <!-- light | dark -->
 *        data-primary="#6B1F2A"     <!-- optional accent color (hex) -->
 *        style="max-width:640px;margin:0 auto;"></div>
 *   <script async src="https://<your-domain>/widget.js"></script>
 *
 * Loader contract with the embedded page (postMessage):
 *   from iframe  → { source:'coachhub', type:'resize', height: number }
 *   from iframe  → { source:'coachhub', type:'redirect', url: string, target:'_top'|'_blank' }
 *   from iframe  → { source:'coachhub', type:'ready' }
 *   to iframe    → { source:'coachhub-host', type:'hello', origin: string }
 *
 * No deps, no build step. Target size < 5 KB uncompressed.
 * ---------------------------------------------------------------
 */
(function () {
  'use strict';

  // ── Resolve the origin of *this* script so the iframe URL matches ──────────
  // This lets the same widget.js work across environments (localhost, staging,
  // production) without hardcoding a domain.
  var currentScript =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        var s = scripts[i];
        if (s.src && /widget\.js(\?|$)/.test(s.src)) return s;
      }
      return null;
    })();

  var WIDGET_ORIGIN = (function () {
    if (currentScript && currentScript.src) {
      try {
        return new URL(currentScript.src).origin;
      } catch (_) {
        /* fall through */
      }
    }
    return window.location.origin;
  })();

  var SELECTOR = '[data-coachhub-widget="booking"]';
  var EMBED_PATH = '/embed/booking';
  var MOUNTED_ATTR = 'data-coachhub-mounted';

  // ── Helpers ────────────────────────────────────────────────────────────────
  function buildIframeUrl(host) {
    var coach = host.getAttribute('data-coach') || '';
    var session = host.getAttribute('data-session') || '';
    var theme = host.getAttribute('data-theme') || 'light';
    var primary = host.getAttribute('data-primary') || '';
    var locale = host.getAttribute('data-locale') || '';

    var params = new URLSearchParams();
    if (coach) params.set('coach', coach);
    if (session) params.set('session', session);
    if (theme) params.set('theme', theme);
    if (primary) params.set('primary', primary);
    if (locale) params.set('locale', locale);
    // Parent origin so the embed page can validate postMessages if desired.
    params.set('parent', window.location.origin);

    return WIDGET_ORIGIN + EMBED_PATH + '?' + params.toString();
  }

  function mount(host) {
    if (!host || host.getAttribute(MOUNTED_ATTR) === '1') return;

    var coach = host.getAttribute('data-coach');
    if (!coach) {
      // eslint-disable-next-line no-console
      console.warn('[coachhub-widget] missing data-coach attribute', host);
      return;
    }

    host.setAttribute(MOUNTED_ATTR, '1');

    // Wrapper guarantees width: 100% fluid + a minimum height so the iframe
    // has something to paint while the embed page boots up.
    host.style.position = host.style.position || 'relative';
    host.style.width = host.style.width || '100%';
    if (!host.style.minHeight) host.style.minHeight = '600px';

    var iframe = document.createElement('iframe');
    iframe.src = buildIframeUrl(host);
    iframe.title = 'Book a coaching session';
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute(
      'allow',
      'payment *; clipboard-write; accelerometer; autoplay; encrypted-media'
    );
    iframe.style.border = '0';
    iframe.style.width = '100%';
    iframe.style.minHeight = '600px';
    iframe.style.display = 'block';
    iframe.style.background = 'transparent';
    iframe.style.colorScheme = 'normal';

    host.appendChild(iframe);

    // ── postMessage wiring ───────────────────────────────────────────────────
    // Only accept messages from our own origin + our own iframe.
    function onMessage(event) {
      if (event.source !== iframe.contentWindow) return;
      if (event.origin !== WIDGET_ORIGIN) return;

      var data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.source !== 'coachhub') return;

      if (data.type === 'ready') {
        // Handshake so the iframe knows the parent is listening.
        try {
          iframe.contentWindow.postMessage(
            { source: 'coachhub-host', type: 'hello', origin: window.location.origin },
            WIDGET_ORIGIN
          );
        } catch (_) {}
        return;
      }

      if (data.type === 'resize' && typeof data.height === 'number') {
        // Clamp to a sane range so a misbehaving embed can't blow the page.
        var h = Math.max(200, Math.min(4000, Math.round(data.height)));
        iframe.style.height = h + 'px';
        host.style.minHeight = h + 'px';
        return;
      }

      if (data.type === 'redirect' && typeof data.url === 'string') {
        // Stripe (and similar) block iframed checkout. Break out to _top.
        if (data.target === '_blank') {
          window.open(data.url, '_blank', 'noopener,noreferrer');
        } else {
          try {
            window.top.location.href = data.url;
          } catch (_) {
            // In cross-origin scenarios where window.top is inaccessible,
            // fall back to self.
            window.location.href = data.url;
          }
        }
      }
    }

    window.addEventListener('message', onMessage, false);
  }

  function mountAll(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var nodes = scope.querySelectorAll(SELECTOR);
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  // Initial pass (may run before DOMContentLoaded if script isn't async).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      mountAll(document);
    });
  } else {
    mountAll(document);
  }

  // Re-scan when authors inject the embed div dynamically (common in SPAs
  // and in Linktree's appended blocks).
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        for (var j = 0; j < m.addedNodes.length; j++) {
          var node = m.addedNodes[j];
          if (node.nodeType !== 1) continue;
          if (node.matches && node.matches(SELECTOR)) mount(node);
          else if (node.querySelectorAll) mountAll(node);
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Expose a tiny API for authors who want to mount manually.
  window.CoachHub = window.CoachHub || {};
  window.CoachHub.booking = {
    mount: mount,
    mountAll: function () {
      mountAll(document);
    },
    origin: WIDGET_ORIGIN,
  };
})();

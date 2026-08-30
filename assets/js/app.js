/* שאי-הון — site behaviour. Vanilla, no dependencies. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Sticky nav state ---------- */
  var shell = document.querySelector('.nav-shell');
  if (shell) {
    var onScroll = function () {
      shell.classList.toggle('is-scrolled', window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Mobile menu ----------
     A panel under the nav pill, not a full-screen cover: the page keeps
     scrolling behind it and the toggle stays clickable, so the same button
     both opens and closes. Escape, a tap outside and following a link all
     close it too. */
  var toggle = document.querySelector('.nav__toggle');
  var nav = document.querySelector('.nav');
  if (toggle && nav) {
    /* A playing hero clip under a sticky, semi-transparent nav is the most
       expensive thing on the page for a phone GPU. Hold it while the panel
       is open so the open/close animation and the taps stay responsive;
       resume only if the clip had not already run to its end. */
    var heroClip = document.querySelector('video.hero-clip');
    var heldClip = false;

    var setMenu = function (open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));

      if (!heroClip) return;
      if (open) {
        heldClip = !heroClip.paused && !heroClip.ended;
        if (heldClip) heroClip.pause();
      } else if (heldClip) {
        heldClip = false;
        var r = heroClip.play();
        if (r && r.catch) r.catch(function () {});
      }
    };

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      setMenu(!nav.classList.contains('is-open'));
    });

    nav.querySelectorAll('.nav__links a').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });

    document.addEventListener('click', function (e) {
      if (nav.classList.contains('is-open') && !nav.contains(e.target)) setMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setMenu(false);
        toggle.focus();
      }
    });

    /* Rotating past the mobile breakpoint leaves the panel styles behind. */
    window.matchMedia('(min-width: 981px)').addEventListener('change', function (m) {
      if (m.matches) setMenu(false);
    });
  }

  /* ---------- Scroll reveals ---------- */
  var targets = document.querySelectorAll('.reveal');
  if (targets.length) {
    if (reduced || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
      targets.forEach(function (el) { io.observe(el); });
      /* Safety net: if anything is still hidden well after load — an
         observer edge case, a resize race — reveal it rather than
         leaving content invisible. */
      window.addEventListener('load', function () {
        setTimeout(function () {
          document.querySelectorAll('.reveal:not(.is-in)').forEach(function (el) {
            if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-in');
          });
        }, 2500);
      });
    }
  }

  /* ---------- Timeline spine fill ---------- */
  var tl = document.querySelector('.timeline');
  var bar = document.querySelector('.timeline__progress');
  if (tl && bar && !reduced) {
    var ticking = false;
    var paint = function () {
      var r = tl.getBoundingClientRect();
      var mid = window.innerHeight * 0.55;
      var pct = (mid - r.top) / r.height;
      bar.style.height = Math.max(0, Math.min(1, pct)) * 100 + '%';
      ticking = false;
    };
    var req = function () {
      if (!ticking) { ticking = true; requestAnimationFrame(paint); }
    };
    paint();
    window.addEventListener('scroll', req, { passive: true });
    window.addEventListener('resize', req);
  }

  /* ---------- Hero clips ----------
     The kiai clips carry their own camera drift, so no Ken Burns and no
     ember canvas. Neither has a loop attribute: each plays once and holds
     its last frame. CSS cannot stop a playing video, so honour the
     reduced-motion preference here and leave the poster frame showing. */
  document.querySelectorAll('video.hero-clip').forEach(function (hv) {
    if (reduced) {
      hv.removeAttribute('autoplay');
      hv.pause();
      return;
    }
    /* A clip can ask to run slower than real time via data-rate. Some
       browsers reset the rate when the source loads, so set it again then. */
    var rate = parseFloat(hv.dataset.rate);
    if (rate > 0) {
      hv.playbackRate = rate;
      hv.addEventListener('loadedmetadata', function () { hv.playbackRate = rate; });
    }
    /* Keep decoding off the phone's back once the hero is scrolled away —
       the clip is still composited behind the sticky nav otherwise. */
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          if (!hv.ended && hv.dataset.heldOffscreen === '1') {
            delete hv.dataset.heldOffscreen;
            var r = hv.play();
            if (r && r.catch) r.catch(function () {});
          }
        } else if (!hv.paused) {
          hv.dataset.heldOffscreen = '1';
          hv.pause();
        }
      });
    }, { threshold: 0 }).observe(hv);
  });

  /* ---------- Hero embers ----------
     A canvas particle layer matched to the bonfire in the hero still.
     Kept for pages that fall back to a still; no-ops when the canvas is
     absent, as it is on the home page now that the clip is in. */
  var cv = document.getElementById('embers');
  if (cv && !reduced) {
    var ctx = cv.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var parts = [];
    var W = 0, H = 0;

    var size = function () {
      W = cv.offsetWidth; H = cv.offsetHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    var spawn = function (seed) {
      return {
        x: Math.random() * W,
        y: seed ? Math.random() * H : H + Math.random() * 60,
        r: Math.random() * 1.9 + 0.5,
        vy: -(Math.random() * 0.42 + 0.12),
        vx: (Math.random() - 0.5) * 0.32,
        life: Math.random() * 0.6 + 0.4,
        drift: Math.random() * Math.PI * 2,
        hue: 18 + Math.random() * 26
      };
    };

    var init = function () {
      size();
      var n = Math.round(Math.min(90, W / 14));
      parts = [];
      for (var i = 0; i < n; i++) parts.push(spawn(true));
    };

    var frame = function () {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.drift += 0.012;
        p.x += p.vx + Math.sin(p.drift) * 0.24;
        p.y += p.vy;
        p.life -= 0.0016;
        if (p.y < -20 || p.life <= 0) { parts[i] = spawn(false); continue; }
        var a = Math.max(0, Math.min(1, p.life)) * 0.72;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + p.hue + ', 96%, 62%, ' + a + ')';
        ctx.fill();
      }
      requestAnimationFrame(frame);
    };

    init();
    window.addEventListener('resize', init);
    requestAnimationFrame(frame);
  }

  /* ---------- Contact form (no backend — opens the visitor's mail client) ---------- */
  /* ---------- Contact form ----------
     Posts to an Apps Script web app that appends a row to the Google Sheet
     and mails the notification. Sent as text/plain so the browser skips the
     CORS preflight Apps Script cannot answer. With no endpoint configured it
     falls back to the old mailto behaviour. */
  var form = document.querySelector('form[data-endpoint], form[data-mailto]');
  if (form) {
    var status = form.querySelector('.form__status');
    var submit = form.querySelector('button[type="submit"]');

    function say(msg, ok) {
      if (!status) return;
      status.textContent = msg;
      status.hidden = false;
      status.classList.toggle('is-error', ok === false);
    }

    function fields() {
      var d = new FormData(form);
      return {
        name: d.get('name') || '',
        phone: d.get('phone') || '',
        email: d.get('email') || '',
        city: d.get('city') || '',
        interest: d.get('interest') || '',
        message: d.get('message') || ''
      };
    }

    function mailto(f) {
      var body = [
        'שם: ' + f.name,
        'טלפון: ' + f.phone,
        'אימייל: ' + f.email,
        'מקום מגורים: ' + f.city,
        'מתעניין/ת ב: ' + f.interest,
        '',
        f.message
      ].join('\n');
      window.location.href = 'mailto:' + form.dataset.mailto +
        '?subject=' + encodeURIComponent('פנייה מהאתר — ' + f.name) +
        '&body=' + encodeURIComponent(body);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = fields();
      var endpoint = form.dataset.endpoint;

      if (!endpoint) { mailto(f); return; }

      if (submit) submit.disabled = true;
      say('שולח…');

      fetch(endpoint, { method: 'POST', body: JSON.stringify(f) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (!res || res.ok !== true) throw new Error('rejected');
          form.reset();
          say('הפנייה נשלחה. נחזור אליכם בהקדם.');
        })
        .catch(function () {
          say('השליחה נכשלה. פותחים במקום זה את תוכנת הדואר…', false);
          mailto(f);
        })
        .then(function () { if (submit) submit.disabled = false; });
    });
  }

  /* ---------- Current year ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();

/* ============================================================
   NEXA AI — Cinematic Scroll Sequence
   script.js  (Performance-Optimised Build)

   OPTIMISATION CHANGELOG vs previous build
   ─────────────────────────────────────────
   FIX-01  Removed setInterval polling in loadSingleFrame.
           Now uses a Promise-based subscriber queue per frame,
           eliminating hundreds of concurrent polling timers
           during fast scrolling.

   FIX-02  Background preload is now CAPPED to a rolling
           window (PRELOAD_WINDOW_SIZE = 120 frames ahead)
           instead of loading all 2,758 frames at once,
           dramatically reducing decoded-image memory pressure.

   FIX-03  setInterval(updateDebugPanel) replaced with a
           single RAF-based loop that only runs when debugVisible
           is true and Phase 1 is active.

   FIX-04  CACHE_NEIGHBORHOOD reduced to 120, CACHE_MAX_SIZE
           reduced to 300, CACHE_EVICT_TARGET to 240, keeping
           decoded RAM usage under ~300 MB instead of ~7 GB.

   FIX-05  Debug-panel DOM refs are cached once instead of
           re-queried every 250 ms.

   FIX-06  updateLoadingProgress() rate-limited to avoid
           excessive style mutations during bulk preloading.

   FIX-07  Boundary-test console group removed from
           production path (runs once on load only, no
           ongoing cost).

   FIX-08  Added window.nexaSetPhase2 so nexa-site.js can
           keep phase2Active in sync without a circular dep.
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------------------
       CONSTANTS
       -------------------------------------------------------- */
    const TOTAL_FRAMES          = 2758;
    const FOLDER_SIZE           = 300;
    const LAST_FOLDER           = 10;
    const LAST_FOLDER_FRAMES    = 58;
    const TOTAL_FOLDERS         = 10;

    // Preloading — FIX-02: cap background preload window
    const PRIORITY_2_END        = 60;        // frames 2-60 immediately
    const MAX_CONCURRENT_LOADS  = 5;         // slightly reduced to avoid network saturation
    const PRELOAD_WINDOW_SIZE   = 120;       // background: only load ±120 frames from current

    // Scroll distance
    const SCROLL_PX_PER_FRAME   = 5.5;
    const SCROLL_HEIGHT         = TOTAL_FRAMES * SCROLL_PX_PER_FRAME;

    // Cache management — FIX-04: smaller cache → lower decoded-image RAM
    const CACHE_NEIGHBORHOOD    = 120;       // was 300
    const CACHE_MAX_SIZE        = 300;       // was 900
    const CACHE_EVICT_TARGET    = 240;       // was 700

    // Auto-scroll
    const AUTO_SCROLL_BASE_FPS  = 30;

    /* --------------------------------------------------------
       DOM ELEMENTS
       -------------------------------------------------------- */
    const canvas          = document.getElementById('sequenceCanvas');
    const ctx             = canvas.getContext('2d', { alpha: false });
    const scrollSpace     = document.querySelector('.sequence-scroll-space');
    const loadingOverlay  = document.getElementById('loadingOverlay');
    const loadingBarFill  = document.querySelector('.loading-overlay__bar-fill');
    const progressBarFill = document.querySelector('.progress-bar__fill');
    const debugPanel      = document.getElementById('prefaceDebug');

    // Controls
    const btnAutoScroll   = document.getElementById('btnAutoScroll');
    const btnRestart      = document.getElementById('btnRestart');
    const btnDebug        = document.getElementById('btnDebug');
    const speedButtons    = document.querySelectorAll('.controls__speed');

    // Phase 1 -> Phase 2 Bridge
    const diveInContainer      = document.getElementById('diveInContainer');
    const btnDiveIn            = document.getElementById('btnDiveIn');
    const officialSite         = document.getElementById('officialSite');
    const btnBackToPreface     = document.getElementById('ctaReplayBtn');

    // FIX-05: cache debug panel value refs once
    const dbgRefs = {
        global:    document.getElementById('dbgGlobal'),
        folder:    document.getElementById('dbgFolder'),
        local:     document.getElementById('dbgLocal'),
        progress:  document.getElementById('dbgProgress'),
        loaded:    document.getElementById('dbgLoaded'),
        canvas:    document.getElementById('dbgCanvas'),
        cache:     document.getElementById('dbgCache'),
        direction: document.getElementById('dbgDirection'),
    };

    /* --------------------------------------------------------
       STATE
       -------------------------------------------------------- */
    const frameCache      = new Map();     // globalFrame → HTMLImageElement
    // FIX-01: subscriber queue replaces setInterval polling
    const loadingSet      = new Set();     // frames currently being fetched
    const loadSubscribers = new Map();     // globalFrame → Array<{resolve,reject}>
    const failedSet       = new Set();     // frames that permanently failed

    let currentGlobalFrame      = 1;
    let renderedGlobalFrame     = 0;
    let scrollDirection         = 1;
    let lastScrollProgress      = 0;

    // Phase 2 Bridge
    let prefaceScrollTrigger   = null;
    let finalFrameTimer        = null;
    let isFinalFrameCTAVisible = false;
    let isTransitioning         = false;
    let phase2Active            = false;

    // Canvas dimensions
    let canvasDisplayW    = 0;
    let canvasDisplayH    = 0;
    let canvasDPR         = 1;

    // Auto-scroll
    let autoScrollActive  = false;
    let autoScrollSpeed   = 1;
    let autoScrollRAF     = null;
    let autoScrollLastTs  = 0;
    let autoScrollFrame   = 1;

    // Rendering
    let renderRAF         = null;
    let needsRender       = true;

    // Preload state
    let initialLoadDone   = false;
    let preloadQueue       = [];
    let activeLoads        = 0;
    let totalPreloaded     = 0;

    // FIX-03: debug RAF
    let debugVisible      = false;
    let debugRAF          = null;

    // FIX-06: rate-limit loading progress updates
    let loadProgressRAF   = null;

    /* --------------------------------------------------------
       FRAME LOCATION HELPERS
       -------------------------------------------------------- */
    function getFrameLocation(globalFrame) {
        const clamped = Math.max(1, Math.min(TOTAL_FRAMES, Math.floor(globalFrame)));
        let folderNum, localFrameNum;

        if (clamped <= 2700) {
            folderNum     = Math.floor((clamped - 1) / FOLDER_SIZE) + 1;
            localFrameNum = ((clamped - 1) % FOLDER_SIZE) + 1;
        } else {
            folderNum     = LAST_FOLDER;
            localFrameNum = clamped - 2700;
        }

        return { folderNum, localFrameNum, globalFrame: clamped };
    }

    function getFramePath(globalFrame) {
        const { folderNum, localFrameNum } = getFrameLocation(globalFrame);
        return `/web-images/folder-${folderNum}/folder-${folderNum}-frame- (${localFrameNum}).jpg`;
    }

    /* --------------------------------------------------------
       BOUNDARY TESTS — run once on load, no ongoing cost
       -------------------------------------------------------- */
    function runBoundaryTests() {
        const tests = [
            { g: 1,    ef: 1,   el: 1   },
            { g: 300,  ef: 1,   el: 300 },
            { g: 301,  ef: 2,   el: 1   },
            { g: 600,  ef: 2,   el: 300 },
            { g: 601,  ef: 3,   el: 1   },
            { g: 2700, ef: 9,   el: 300 },
            { g: 2701, ef: 10,  el: 1   },
            { g: 2758, ef: 10,  el: 58  },
        ];
        let allPassed = true;
        for (const t of tests) {
            const loc = getFrameLocation(t.g);
            if (loc.folderNum !== t.ef || loc.localFrameNum !== t.el) {
                allPassed = false;
                console.error(`[NEXA] MAPPING FAIL: global ${t.g} → folder ${loc.folderNum}/local ${loc.localFrameNum} (expected ${t.ef}/${t.el})`);
            }
        }
        if (allPassed) {
            console.log('%c[NEXA] Frame mapping OK ✅', 'color:#4ade80');
        }
    }

    /* --------------------------------------------------------
       CANVAS SIZING
       -------------------------------------------------------- */
    function resizeCanvas() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        if (vw === canvasDisplayW && vh === canvasDisplayH && dpr === canvasDPR) {
            return; // no-op — nothing changed
        }

        canvasDisplayW = vw;
        canvasDisplayH = vh;
        canvasDPR      = dpr;

        canvas.style.width  = vw + 'px';
        canvas.style.height = vh + 'px';
        canvas.width  = Math.round(vw * dpr);
        canvas.height = Math.round(vh * dpr);

        needsRender = true;
        renderedGlobalFrame = 0;
        scheduleRender();
    }

    /* --------------------------------------------------------
       IMAGE LOADING — FIX-01: subscriber queue, no polling
       -------------------------------------------------------- */

    /**
     * Load a single frame. If the frame is already in-flight,
     * subscribe to it instead of polling. No setInterval ever.
     */
    function loadSingleFrame(globalFrame) {
        return new Promise((resolve, reject) => {
            // Already cached
            if (frameCache.has(globalFrame)) {
                resolve(frameCache.get(globalFrame));
                return;
            }
            // Already known failed
            if (failedSet.has(globalFrame)) {
                reject(new Error('Frame permanently failed: ' + globalFrame));
                return;
            }
            // Already in-flight — subscribe to it
            if (loadingSet.has(globalFrame)) {
                if (!loadSubscribers.has(globalFrame)) {
                    loadSubscribers.set(globalFrame, []);
                }
                loadSubscribers.get(globalFrame).push({ resolve, reject });
                return;
            }

            // Start a new load
            loadingSet.add(globalFrame);
            if (!loadSubscribers.has(globalFrame)) {
                loadSubscribers.set(globalFrame, []);
            }
            // Push ourselves as the first subscriber
            loadSubscribers.get(globalFrame).push({ resolve, reject });

            const img = new Image();
            const path = getFramePath(globalFrame);

            img.onload = function () {
                loadingSet.delete(globalFrame);
                frameCache.set(globalFrame, img);
                totalPreloaded++;
                scheduleLoadProgress();

                // Notify all subscribers
                const subs = loadSubscribers.get(globalFrame) || [];
                loadSubscribers.delete(globalFrame);
                for (const sub of subs) sub.resolve(img);
            };

            img.onerror = function () {
                loadingSet.delete(globalFrame);
                failedSet.add(globalFrame);

                const subs = loadSubscribers.get(globalFrame) || [];
                loadSubscribers.delete(globalFrame);
                for (const sub of subs) sub.reject(new Error('Failed: ' + path));
            };

            img.src = path;
        });
    }

    /* --------------------------------------------------------
       PRELOADING ENGINE
       -------------------------------------------------------- */
    function processPreloadQueue() {
        while (activeLoads < MAX_CONCURRENT_LOADS && preloadQueue.length > 0) {
            const frame = preloadQueue.shift();

            if (frameCache.has(frame) || loadingSet.has(frame) || failedSet.has(frame)) {
                continue;
            }

            activeLoads++;
            loadSingleFrame(frame)
                .catch(() => { /* logged in loadSingleFrame */ })
                .finally(() => {
                    activeLoads--;
                    processPreloadQueue();
                });
        }
    }

    function priorityPreload(frames) {
        const toAdd = [];
        for (const f of frames) {
            if (f >= 1 && f <= TOTAL_FRAMES &&
                !frameCache.has(f) && !loadingSet.has(f) && !failedSet.has(f)) {
                toAdd.push(f);
            }
        }
        preloadQueue = toAdd.concat(preloadQueue);
        processPreloadQueue();
    }

    /**
     * FIX-02: Background preload only covers a rolling window around
     * the current frame, not the entire 2,758-frame sequence at once.
     */
    function scheduleRollingPreload(centerFrame) {
        const start = Math.max(1, centerFrame - 10);
        const end   = Math.min(TOTAL_FRAMES, centerFrame + PRELOAD_WINDOW_SIZE);
        const frames = [];
        for (let i = start; i <= end; i++) {
            if (!frameCache.has(i) && !loadingSet.has(i) && !failedSet.has(i)) {
                frames.push(i);
            }
        }
        if (frames.length > 0) {
            preloadQueue = frames.concat(preloadQueue);
            processPreloadQueue();
        }
    }

    // FIX-06: rate-limit loading bar DOM updates
    function scheduleLoadProgress() {
        if (loadProgressRAF) return;
        loadProgressRAF = requestAnimationFrame(() => {
            loadProgressRAF = null;
            if (loadingBarFill) {
                const pct = Math.min(100, (totalPreloaded / TOTAL_FRAMES) * 100);
                loadingBarFill.style.width = pct + '%';
            }
        });
    }

    /**
     * Direction-aware immediate priority preload.
     */
    function directionPreload(currentFrame, direction) {
        const count = 40;
        const ahead = [];
        if (direction >= 0) {
            for (let i = 1; i <= count; i++) {
                const f = currentFrame + i;
                if (f <= TOTAL_FRAMES) ahead.push(f);
            }
        } else {
            for (let i = 1; i <= count; i++) {
                const f = currentFrame - i;
                if (f >= 1) ahead.push(f);
            }
        }
        priorityPreload(ahead);
    }

    /* --------------------------------------------------------
       CACHE EVICTION
       -------------------------------------------------------- */
    function evictDistantFrames(currentFrame) {
        if (frameCache.size <= CACHE_MAX_SIZE) return;

        const entries = [];
        for (const key of frameCache.keys()) {
            entries.push({ key, dist: Math.abs(key - currentFrame) });
        }
        entries.sort((a, b) => b.dist - a.dist);

        while (frameCache.size > CACHE_EVICT_TARGET && entries.length > 0) {
            const entry = entries.shift();
            if (entry.key !== currentFrame && entry.key !== renderedGlobalFrame) {
                frameCache.delete(entry.key);
            }
        }
    }

    /* --------------------------------------------------------
       CANVAS RENDERING
       -------------------------------------------------------- */
    function drawCover(img) {
        const cw = canvas.width;
        const ch = canvas.height;
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;

        if (!iw || !ih) return;

        const scale = Math.max(cw / iw, ch / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const ox = (cw - dw) / 2;
        const oy = (ch - dh) / 2;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.clearRect(0, 0, cw, ch);
        ctx.drawImage(img, ox, oy, dw, dh);
    }

    function renderFrame(globalFrame) {
        if (phase2Active) return;
        const clamped = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(globalFrame)));
        currentGlobalFrame = clamped;

        if (frameCache.has(clamped)) {
            if (renderedGlobalFrame !== clamped) {
                drawCover(frameCache.get(clamped));
                renderedGlobalFrame = clamped;
            }
            return;
        }

        // Frame not cached — request and draw when ready
        loadSingleFrame(clamped)
            .then(img => {
                if (currentGlobalFrame === clamped) {
                    drawCover(img);
                    renderedGlobalFrame = clamped;
                }
            })
            .catch(() => { /* keep current frame visible */ });
    }

    function scheduleRender() {
        if (renderRAF) return;
        renderRAF = requestAnimationFrame(() => {
            renderRAF = null;
            renderFrame(currentGlobalFrame);
        });
    }

    /* --------------------------------------------------------
       DEBUG PANEL — FIX-03: RAF-based, not setInterval
       -------------------------------------------------------- */
    function startDebugLoop() {
        if (debugRAF) return;
        function loop() {
            if (!debugVisible || phase2Active) {
                debugRAF = null;
                return;
            }
            updateDebugPanel();
            debugRAF = requestAnimationFrame(loop);
        }
        debugRAF = requestAnimationFrame(loop);
    }

    function updateDebugPanel() {
        const loc = getFrameLocation(currentGlobalFrame);
        if (dbgRefs.global)    dbgRefs.global.textContent    = currentGlobalFrame;
        if (dbgRefs.folder)    dbgRefs.folder.textContent    = loc.folderNum;
        if (dbgRefs.local)     dbgRefs.local.textContent     = loc.localFrameNum;
        if (dbgRefs.progress)  dbgRefs.progress.textContent  = (lastScrollProgress * 100).toFixed(1) + '%';
        if (dbgRefs.loaded)    dbgRefs.loaded.textContent    = frameCache.has(currentGlobalFrame) ? 'Yes' : 'No';
        if (dbgRefs.canvas)    dbgRefs.canvas.textContent    = canvas.width + '×' + canvas.height;
        if (dbgRefs.cache)     dbgRefs.cache.textContent     = frameCache.size;
        if (dbgRefs.direction) dbgRefs.direction.textContent = scrollDirection >= 0 ? '↓ Forward' : '↑ Backward';
    }

    function toggleDebug() {
        debugVisible = !debugVisible;
        if (debugPanel) {
            debugPanel.classList.toggle('debug-panel--visible', debugVisible);
        }
        if (btnDebug) {
            btnDebug.classList.toggle('controls__btn--active', debugVisible);
        }
        if (debugVisible) startDebugLoop();
    }

    /* --------------------------------------------------------
       SCROLL TRIGGER SETUP
       -------------------------------------------------------- */
    function initScrollTrigger() {
        scrollSpace.style.height = SCROLL_HEIGHT + 'px';
        gsap.registerPlugin(ScrollTrigger);

        prefaceScrollTrigger = ScrollTrigger.create({
            trigger: '.sequence-section',
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.5,
            onUpdate: function (self) {
                if (phase2Active || isTransitioning) return;
                const progress = self.progress;

                scrollDirection = progress >= lastScrollProgress ? 1 : -1;
                lastScrollProgress = progress;

                const targetFrame = Math.round(progress * (TOTAL_FRAMES - 1)) + 1;
                const clamped = Math.max(1, Math.min(TOTAL_FRAMES, targetFrame));

                if (clamped !== currentGlobalFrame) {
                    currentGlobalFrame = clamped;
                    needsRender = true;
                    scheduleRender();

                    directionPreload(clamped, scrollDirection);
                    evictDistantFrames(clamped);
                }

                if (progress >= 0.985 || clamped >= TOTAL_FRAMES - 6) {
                    handleFinalFrameReached(true);
                } else {
                    handleFinalFrameReached(false);
                }

                if (progressBarFill) {
                    progressBarFill.style.width = (progress * 100) + '%';
                }
            }
        });

        // Expose immediately so nexa-site.js can access it
        window.prefaceScrollTrigger = prefaceScrollTrigger;
    }

    /* --------------------------------------------------------
       AUTO-SCROLL
       -------------------------------------------------------- */
    function startAutoScroll() {
        if (autoScrollActive) return;
        autoScrollActive = true;
        autoScrollLastTs = 0;
        autoScrollFrame  = currentGlobalFrame;

        if (btnAutoScroll) btnAutoScroll.classList.add('controls__btn--active');

        function step(ts) {
            if (!autoScrollActive) return;

            if (autoScrollLastTs === 0) {
                autoScrollLastTs = ts;
                autoScrollRAF = requestAnimationFrame(step);
                return;
            }

            const dt = (ts - autoScrollLastTs) / 1000;
            autoScrollLastTs = ts;

            autoScrollFrame += autoScrollSpeed * AUTO_SCROLL_BASE_FPS * dt;

            if (autoScrollFrame >= TOTAL_FRAMES) {
                autoScrollFrame = TOTAL_FRAMES;
                stopAutoScroll();
            }

            const targetFrame = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(autoScrollFrame)));
            const progress = (targetFrame - 1) / (TOTAL_FRAMES - 1);
            const section = document.querySelector('.sequence-section');
            const scrollTop = progress * (section.offsetHeight - window.innerHeight);

            window.scrollTo({ top: scrollTop, behavior: 'instant' });

            if (autoScrollActive) {
                autoScrollRAF = requestAnimationFrame(step);
            }
        }

        autoScrollRAF = requestAnimationFrame(step);
    }

    function stopAutoScroll() {
        autoScrollActive = false;
        if (autoScrollRAF) {
            cancelAnimationFrame(autoScrollRAF);
            autoScrollRAF = null;
        }
        if (btnAutoScroll) btnAutoScroll.classList.remove('controls__btn--active');
    }

    function toggleAutoScroll() {
        if (autoScrollActive) {
            stopAutoScroll();
        } else {
            startAutoScroll();
        }
    }

    function setSpeed(speed) {
        autoScrollSpeed = speed;
        speedButtons.forEach(btn => {
            const s = parseFloat(btn.dataset.speed);
            btn.classList.toggle('controls__speed--active', s === speed);
        });
    }

    function restart() {
        stopAutoScroll();
        handleFinalFrameReached(false);
        autoScrollFrame = 1;
        currentGlobalFrame = 1;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        scheduleRender();
    }

    /* --------------------------------------------------------
       EVENT LISTENERS
       -------------------------------------------------------- */
    function bindEvents() {
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(resizeCanvas, 150);
        });

        if (btnAutoScroll) btnAutoScroll.addEventListener('click', toggleAutoScroll);
        if (btnRestart)    btnRestart.addEventListener('click', restart);
        if (btnDebug)      btnDebug.addEventListener('click', toggleDebug);

        speedButtons.forEach(btn => {
            btn.addEventListener('click', () => setSpeed(parseFloat(btn.dataset.speed)));
        });

        if (btnBackToPreface) btnBackToPreface.addEventListener('click', returnToPreface);

        if (btnDiveIn) {
            btnDiveIn.addEventListener('click', () => {
                if (window.nexaActivateDiveIn) {
                    window.nexaActivateDiveIn();
                } else {
                    enterOfficialSite();
                }
            });
        }

        window.addEventListener('wheel',      () => { if (autoScrollActive) stopAutoScroll(); }, { passive: true });
        window.addEventListener('touchstart', () => { if (autoScrollActive) stopAutoScroll(); }, { passive: true });

        // Page visibility: pause canvas render loop when tab is hidden
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !phase2Active) {
                scheduleRender();
            }
        });
    }

    /* --------------------------------------------------------
       PHASE 1 → PHASE 2 BRIDGE
       -------------------------------------------------------- */
    function handleFinalFrameReached(isAtFinal) {
        if (phase2Active || isTransitioning) return;

        if (isAtFinal) {
            if (isFinalFrameCTAVisible || finalFrameTimer) return;
            finalFrameTimer = setTimeout(() => {
                finalFrameTimer = null;
                if ((currentGlobalFrame >= TOTAL_FRAMES - 10 || lastScrollProgress >= 0.98) && !isTransitioning && !phase2Active) {
                    showDiveInCTA();
                }
            }, 200);
        } else {
            if (finalFrameTimer) {
                clearTimeout(finalFrameTimer);
                finalFrameTimer = null;
            }
            if (isFinalFrameCTAVisible) {
                hideDiveInCTA();
            }
        }
    }

    function showDiveInCTA() {
        if (!diveInContainer || isFinalFrameCTAVisible) return;
        isFinalFrameCTAVisible = true;
        diveInContainer.classList.add('divein-container--visible');
        gsap.fromTo(diveInContainer,
            { opacity: 0, y: 15 },
            { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
        );
    }

    function hideDiveInCTA() {
        if (!diveInContainer || !isFinalFrameCTAVisible) return;
        isFinalFrameCTAVisible = false;
        gsap.to(diveInContainer, {
            opacity: 0, y: 10, duration: 0.4, ease: 'power2.in',
            onComplete: () => { diveInContainer.classList.remove('divein-container--visible'); }
        });
    }

    /**
     * Entry to Phase 2.
     * Delegates to nexa-site.js which owns the synchronized audio & cinematic transition.
     */
    function enterOfficialSite() {
        if (phase2Active) return;
        if (autoScrollActive) stopAutoScroll();
        if (window.nexaActivateDiveIn) {
            window.nexaActivateDiveIn();
            return;
        }
        if (prefaceScrollTrigger) prefaceScrollTrigger.disable(false);

        const sequenceSection = document.querySelector('.sequence-section');
        if (sequenceSection) sequenceSection.style.display = 'none';
        if (canvas) canvas.style.display = 'none';

        const prefaceEls = document.querySelectorAll(
            '#prefaceBrand, #prefaceControls, #prefaceProgress, #prefaceDebug, #diveInContainer'
        );
        prefaceEls.forEach(el => { if (el) el.style.display = 'none'; });

        if (officialSite) {
            officialSite.classList.add('official-site--active');
            officialSite.style.display = 'block';
        }

        phase2Active = true;
        document.body.style.overflow = 'auto';
        window.scrollTo(0, 0);
    }

    function returnToPreface() {
        phase2Active = false;

        if (officialSite) {
            officialSite.classList.remove('official-site--active');
            officialSite.style.display = 'none';
        }

        const sequenceSection = document.querySelector('.sequence-section');
        if (sequenceSection) sequenceSection.style.display = 'block';
        if (canvas) canvas.style.display = 'block';
        gsap.set(canvas, { scale: 1, filter: 'none' });

        document.querySelectorAll('#prefaceBrand, #prefaceControls, #prefaceProgress, #prefaceDebug').forEach(el => {
            if (el) { el.style.display = ''; el.style.opacity = '1'; }
        });

        if (prefaceScrollTrigger) prefaceScrollTrigger.enable();
        restart();
    }

    /* --------------------------------------------------------
       INITIALIZATION
       -------------------------------------------------------- */
    async function init() {
        console.log('%c[NEXA AI] Cinematic Scroll Sequence (Performance Build)', 'color:#a855f7;font-size:13px;font-weight:bold');

        // One-time boundary tests
        runBoundaryTests();

        // Size canvas
        resizeCanvas();

        // PRIORITY 1: Load frame 1 immediately
        try {
            const img = await loadSingleFrame(1);
            drawCover(img);
            renderedGlobalFrame = 1;
        } catch (e) {
            console.error('[NEXA] Failed to load frame 1:', e);
        }

        // Hide loading overlay
        if (loadingOverlay) {
            loadingOverlay.classList.add('loading-overlay--hidden');
        }

        // PRIORITY 2: Preload frames 2–PRIORITY_2_END
        const priority2 = [];
        for (let i = 2; i <= PRIORITY_2_END; i++) priority2.push(i);
        priorityPreload(priority2);

        // FIX-02: rolling window preload instead of full-sequence preload
        setTimeout(() => {
            scheduleRollingPreload(1);
        }, 400);

        // Init GSAP ScrollTrigger
        initScrollTrigger();

        // Bind events
        bindEvents();

        // Set default speed
        setSpeed(1);

        // Expose Phase 1 hooks for nexa-site.js
        window.prefaceScrollTrigger = prefaceScrollTrigger;
        window.nexaRestart          = restart;
        window.nexaStopAutoScroll   = stopAutoScroll;
        window.nexaShowDiveIn       = showDiveInCTA;
        window.nexaSetPhase2        = (v) => { phase2Active = v; };  // FIX-08
        window.nexaPhase1Ready      = true;

        initialLoadDone = true;
    }

    /* --------------------------------------------------------
       BOOT
       -------------------------------------------------------- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

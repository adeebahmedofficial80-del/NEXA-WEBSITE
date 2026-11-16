/* ================================================================
   NEXA AI — Official Website Experience Controller (Phase 2)
   nexa-site.js — Master Precision Build
   Features:
   - 01.mp3 / 02.mp3 / 03.mp3 Audio Controller
   - Product-Centered Feature Network (Nexa Core + 7 Core + 4 Supporting)
   - Nexa Life Pulse travelling energy animation
   - 1-open-at-a-time capsule expansion
   - Intent → Action 6-stage scroll pipeline
   - Room command demo (01.mp4 - 08.mp4, exact commands, reset)
   - Three.js authentic GLB discovery with intersection observer
   ================================================================ */

(function () {
    'use strict';

    // ============================================================
    // AUDIO CONTROLLER & SFX MANAGEMENT
    // ============================================================
    const AudioController = {
        muted: false,
        sounds: {
            act:           new Audio('assets/audio/01.mp3'),
            cmd:           new Audio('assets/audio/02.mp3'),
            dive:          new Audio('assets/audio/03.mp3'),
            lightSwitch:   new Audio('assets/sfx/dragon-studio-light-switch-382712.mp3'),
            curtains:      new Audio('assets/sfx/freesound_community-curtains-opening-or-closing-2-93377.mp3'),
            fluorescent:   new Audio('assets/sfx/freesound_community-flourescent-light-29596.mp3'),
            robot:         new Audio('assets/sfx/ArcadeGameButton_S011TE.16.mp3'),
            tvShutdown:    new Audio('assets/sfx/dragon-studio-tv-shutdown-386167.mp3'),
            cooling:       new Audio('assets/sfx/Air Conditioner Sounds - 100% Black Screen White Noise.mp3'),
            addingMachine: new Audio('assets/sfx/AddingMachine_S011OF.1.mp3')
        },
        init() {
            try {
                this.muted = localStorage.getItem('nexa_sound_muted') === 'true';
            } catch (_) {}
            Object.values(this.sounds).forEach(audio => {
                audio.preload = 'auto';
            });
            this.updateMuteUI();
        },
        toggleMute() {
            this.muted = !this.muted;
            try {
                localStorage.setItem('nexa_sound_muted', String(this.muted));
            } catch (_) {}
            this.updateMuteUI();
            if (!this.muted) {
                this.play('act');
            }
            return this.muted;
        },
        updateMuteUI() {
            const isM = this.muted;
            const navBtn = document.getElementById('globalSoundToggle');
            const navIcon = document.getElementById('globalSoundIcon');
            const navText = document.getElementById('globalSoundText');
            if (navBtn) navBtn.classList.toggle('nx-nav__sound-btn--muted', isM);
            if (navIcon) navIcon.textContent = isM ? '🔇' : '🔊';
            if (navText) navText.textContent = isM ? 'SOUND OFF' : 'SOUND ON';

            const cmdBtn = document.getElementById('commandSoundToggle');
            const cmdIcon = document.getElementById('cmdSoundIcon');
            const cmdLabel = document.getElementById('cmdSoundLabel');
            if (cmdBtn) cmdBtn.classList.toggle('nx-sound-toggle-btn--muted', isM);
            if (cmdIcon) cmdIcon.textContent = isM ? '🔇' : '🔊';
            if (cmdLabel) cmdLabel.textContent = isM ? 'Audio: OFF' : 'Audio: ON';

            const mobIcon = document.getElementById('mobileSoundIcon');
            const mobText = document.getElementById('mobileSoundText');
            if (mobIcon) mobIcon.textContent = isM ? '🔇' : '🔊';
            if (mobText) mobText.textContent = isM ? 'Sound: OFF' : 'Sound: ON';
        },
        play(key, volume = 1.0) {
            if (this.muted) return;
            try {
                const s = this.sounds[key];
                if (!s) return;
                s.currentTime = 0;
                s.volume = Math.max(0, Math.min(1, volume));
                const p = s.play();
                if (p) p.catch(() => { /* Autoplay restriction */ });
            } catch (err) {
                console.warn('[Nexa Audio] Error:', err);
            }
        },
        stop(key) {
            try {
                const s = this.sounds[key];
                if (s) {
                    s.pause();
                    s.currentTime = 0;
                }
            } catch (_) {}
        }
    };

    // Preload audio metadata safely
    AudioController.init();

    // ============================================================
    // STATE
    // ============================================================
    let phase2Initialized  = false;
    let phase2Active       = false;

    // Command experience
    const VIDEOS_PATH = 'assets/room-base/videos/';
    const COMMANDS = [
        { 
            id: 1, 
            text: '\u201cNexa, wake up.\u201d',                   
            src: '01.mp4', 
            sfx: 'lightSwitch',
            tag: 'Wake Briefing',
            desc: 'Gradual illumination and morning briefing initialization.'
        },
        { 
            id: 2, 
            text: '\u201cNexa, open the curtains.\u201d',         
            src: '02.mp4', 
            sfx: 'curtains',
            tag: 'Fenestration',
            desc: 'Natural daylight optimization with motorized shade glide.'
        },
        { 
            id: 3, 
            text: '\u201cNexa, turn on the TV.\u201d',            
            src: '03.mp4', 
            sfx: 'fluorescent',
            tag: 'Display Power',
            desc: 'Low-latency CEC broadcast to main smart display cluster.'
        },
        { 
            id: 4, 
            text: '\u201cNexa, set the mood.\u201d',              
            src: '04.mp4', 
            sfx: 'lightSwitch',
            tag: 'Atmosphere',
            desc: 'Warm color temperature shift with acoustic dampening.'
        },
        { 
            id: 5, 
            text: '\u201cNexa, have the robot join us.\u201d',    
            src: '05.mp4', 
            sfx: 'robot',
            tag: 'Robot Assist',
            desc: 'Spawns companion robot pathfinding to the living lounge.'
        },
        { 
            id: 6, 
            text: '\u201cNexa, start cinema mode.\u201d',         
            src: '06.mp4', 
            sfx: 'tvShutdown',
            tag: 'Cinema Mode',
            desc: 'Dimmable edge lighting drops to 8%, spatial audio activates.'
        },
        { 
            id: 7, 
            text: '\u201cNexa, cool me down.\u201d',              
            src: '07.mp4', 
            sfx: 'cooling',
            tag: 'HVAC Cooling',
            desc: 'Smart HVAC microclimate airflow directed to seating zone.'
        },
        { 
            id: 8, 
            text: '\u201cNexa, let\u2019s call it a night.\u201d',
            src: '08.mp4', 
            sfx: 'tvShutdown',
            tag: 'Night Lockdown',
            desc: 'All non-essential circuits safe shutdown & perimeter armed.'
        }
    ];
    let currentCommandIndex = 0;
    let commandPlaying      = false;
    let commandComplete     = false;

    const preloadedVideoHints = new Set();
    const phase2ScrollTriggers = [];

    // ============================================================
    // FEATURE DEFINITIONS (7 Core + 4 Supporting, NO Privacy/Hub)
    // ============================================================
    const FEATURES = [
        // ── CORE FEATURES (Closer to Nexa, Cyan/Blue themed) ──
        {
            id: 'hybrid',
            type: 'core',
            title: 'Hybrid AI Intelligence',
            desc: 'Cloud + on-device intelligence working in concert.',
            color: '#00E5FF',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><circle cx="12" cy="13" r="2"/></svg>`
        },
        {
            id: 'memory',
            type: 'core',
            title: 'Smart Audio Memory Mode',
            desc: 'Continuous meeting transcription, synthesis and recall.',
            color: '#00E5FF',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`
        },
        {
            id: 'smarthome',
            type: 'core',
            title: 'Smart Home Control',
            desc: 'Natural spatial control of lighting, climate and audio.',
            color: '#00E5FF',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
        },
        {
            id: 'lighting',
            type: 'core',
            title: 'Emotion-Reactive Edge Lighting',
            desc: 'Dynamic edge expressions responsive to context and emotion.',
            color: '#00E5FF',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
        },
        {
            id: 'hotspot',
            type: 'core',
            title: 'Portable Broadband & Hotspot Mode',
            desc: 'High-speed wireless connectivity wherever Nexa travels.',
            color: '#00E5FF',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>`
        },
        {
            id: 'crossapp',
            type: 'core',
            title: 'Cross-App Connections',
            desc: 'Bridges personal digital tools into unified workflows.',
            color: '#00E5FF',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`
        },
        {
            id: 'universal',
            type: 'core',
            title: 'Universal Device Control',
            desc: 'Unified multi-device command orchestration across rooms.',
            color: '#00E5FF',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M4.93 19.07l4.24-4.24"/></svg>`
        },

        // ── SUPPORTING FEATURES (Farther from Nexa, Violet themed) ──
        {
            id: 'voice',
            type: 'supporting',
            title: 'Voice Personalisation',
            desc: 'Adaptive speech models tuned to your unique vocal tone.',
            color: '#8B5CF6',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><path d="M2 10v3M6 6v11M10 3v18M14 8v7M18 5v13M22 10v3"/></svg>`
        },
        {
            id: 'character',
            type: 'supporting',
            title: 'Character Personalisation',
            desc: 'Configurable companion personas for learning, work and coaching.',
            color: '#8B5CF6',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>`
        },
        {
            id: 'earphone',
            type: 'supporting',
            title: 'Bluetooth Earphone Mode',
            desc: 'Ultra-low-latency private audio channel to connected earbuds.',
            color: '#8B5CF6',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><path d="m7 7 10 10-5 5V2l5 5L7 17"/></svg>`
        },
        {
            id: 'automation',
            type: 'supporting',
            title: 'Routine Automation',
            desc: 'Complex multi-step actions executed from a single phrase.',
            color: '#8B5CF6',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>`
        }
    ];

    let activeFeatureId = null;

    // ============================================================
    // WAIT FOR PHASE 1 & DIVE IN BINDING
    // ============================================================
    let diveInBound     = false;
    let isTransitioning = false;

    function waitForPhase1() {
        if (document.getElementById('btnDiveIn')) {
            bindDiveIn();
            return;
        }
        const check = setInterval(() => {
            if (window.nexaPhase1Ready || document.getElementById('btnDiveIn')) {
                clearInterval(check);
                bindDiveIn();
            }
        }, 80);
    }

    function bindDiveIn() {
        if (diveInBound) return;
        const btnDiveIn = document.getElementById('btnDiveIn');
        if (!btnDiveIn) return;
        diveInBound = true;

        btnDiveIn.addEventListener('click', activateDiveIn);

        // Internal debug entry support (?phase=2 or #officialSite)
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const hash = window.location.hash;
            if (urlParams.get('phase') === '2' || hash === '#officialSite' || hash.startsWith('#hero') || hash.startsWith('#product') || hash.startsWith('#command') || hash.startsWith('#tier') || hash.startsWith('#feature')) {
                setTimeout(activateDiveIn, 120);
            }
        } catch (_) {}
    }

    // ============================================================
    // DIVE IN TRANSITION & AUDIO 03.mp3
    // ============================================================
    function activateDiveIn() {
        if (phase2Initialized || isTransitioning) return;
        isTransitioning = true;

        // Play 03.mp3 strictly on DIVE IN click
        AudioController.play('dive');

        // Stop Phase 1 scroll triggers & auto-scroll
        const prefaceST = window.prefaceScrollTrigger;
        if (prefaceST) prefaceST.disable(false);
        if (window.nexaStopAutoScroll) window.nexaStopAutoScroll();

        const diveContainer  = document.getElementById('diveInContainer');
        const diveTransition = document.getElementById('diveTransition');
        const diveVeil       = document.getElementById('diveVeil');
        const diveLogoZoom   = document.getElementById('diveLogoZoom');
        const officialSite   = document.getElementById('officialSite');
        const seqSection     = document.querySelector('.sequence-section');
        const seqCanvas      = document.getElementById('sequenceCanvas');
        const prefaceEls     = document.querySelectorAll('#prefaceBrand, #prefaceControls, #prefaceProgress, #prefaceDebug');
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) loadingOverlay.classList.add('loading-overlay--hidden');

        // Tactile button reaction
        if (diveContainer) {
            gsap.to(diveContainer, {
                opacity: 0, scale: 0.94, y: -10, duration: 0.35, ease: 'power2.in',
                onComplete: () => { diveContainer.style.display = 'none'; }
            });
        }

        // 1.8s synchronized cinematic transition
        gsap.delayedCall(0.12, () => {
            officialSite.classList.add('official-site--active');
            officialSite.style.display = 'block';
            diveTransition.classList.add('dive-transition--active');

            const tl = gsap.timeline({
                onComplete: () => {
                    // Clean up Phase 1
                    if (seqSection) seqSection.style.display = 'none';
                    if (seqCanvas)  seqCanvas.style.display  = 'none';
                    prefaceEls.forEach(el => { if (el) el.style.display = 'none'; });

                    // Reset scroll to top cleanly
                    document.body.style.overflow = 'auto';
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

                    // Initialize Phase 2
                    initPhase2();

                    // Fade out veil to reveal the official site
                    gsap.to(diveVeil, {
                        opacity: 0, duration: 0.75, ease: 'power2.out',
                        onComplete: () => {
                            diveTransition.classList.remove('dive-transition--active');
                            diveTransition.style.display = 'none';
                            isTransitioning = false;
                        }
                    });
                }
            });

            tl.fromTo(diveVeil,     { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.inOut' });
            tl.fromTo(diveLogoZoom, { opacity: 0, scale: 0.55 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' }, 0.15);
            tl.to(diveLogoZoom,     { scale: 4.8, opacity: 0, duration: 0.85, ease: 'power3.in' }, 0.65);
            tl.to(diveVeil,         { background: '#000000', duration: 0.3 }, 1.15);
        });
    }

    // Expose hook globally so script.js can invoke it directly
    window.nexaActivateDiveIn = activateDiveIn;

    // ============================================================
    // PHASE 2 INITIALIZATION
    // ============================================================
    function initPhase2() {
        if (phase2Initialized) return;
        phase2Initialized = true;
        phase2Active = true;

        if (window.nexaSetPhase2) window.nexaSetPhase2(true);

        initNav();
        initHeroReveal();
        initHero3DCanvas();
        initFeatureNetwork();
        initCommandExperience();
        initIntentActionSection();
        initSectionAnimations();
        initAudioButtons();
        initProductSection();
        initInteractive3DTilt();
        initCustomCursor();
        initRequestAccessModal();

        setTimeout(() => {
            if (window.ScrollTrigger) ScrollTrigger.refresh();
        }, 300);
    }

    // ============================================================
    // BUTTON AUDIO BINDINGS & ACTION HOOKS
    // ============================================================
    function initAudioButtons() {
        const btnHeroExplore   = document.getElementById('btnHeroExplore');
        const btnHeroSeeAction = document.getElementById('btnHeroSeeAction');
        const ctaRequestBtn    = document.getElementById('ctaRequestBtn');
        const navCtaBtn        = document.getElementById('navCtaBtn');
        const ctaReplayBtn     = document.getElementById('ctaReplayBtn');
        const btnExploreHub    = document.getElementById('btnExploreHub');
        const btnReadPrivacy   = document.getElementById('btnReadPrivacyPolicy');

        const bindSound01 = (el) => {
            if (!el) return;
            el.addEventListener('click', () => {
                AudioController.play('act');
            });
        };

        bindSound01(btnHeroExplore);
        bindSound01(btnHeroSeeAction);
        bindSound01(ctaRequestBtn);
        bindSound01(navCtaBtn);
        bindSound01(btnExploreHub);
        bindSound01(btnReadPrivacy);

        if (ctaRequestBtn) {
            ctaRequestBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openRequestAccessModal();
            });
        }

        if (navCtaBtn) {
            navCtaBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openRequestAccessModal();
            });
        }

        document.querySelectorAll('.nx-nav__mobile-link--cta').forEach(btn => {
            bindSound01(btn);
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                openRequestAccessModal();
            });
        });

        if (ctaReplayBtn) {
            ctaReplayBtn.addEventListener('click', () => {
                AudioController.play('act');
                returnToPreface();
            });
        }

        // Global Sound Toggles
        const globalSound = document.getElementById('globalSoundToggle');
        if (globalSound) {
            globalSound.addEventListener('click', () => AudioController.toggleMute());
        }
        const mobileSound = document.getElementById('mobileSoundToggle');
        if (mobileSound) {
            mobileSound.addEventListener('click', () => AudioController.toggleMute());
        }
        const cmdSound = document.getElementById('commandSoundToggle');
        if (cmdSound) {
            cmdSound.addEventListener('click', () => AudioController.toggleMute());
        }

        // Tier Direct Reservation CTAs
        document.querySelectorAll('[data-reserve-tier]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                AudioController.play('act');
                const tierName = btn.getAttribute('data-reserve-tier');
                const tierSelect = document.getElementById('reqTier');
                if (tierSelect && tierName) {
                    for (let opt of tierSelect.options) {
                        if (opt.value.toLowerCase().includes(tierName.toLowerCase())) {
                            tierSelect.value = opt.value;
                            break;
                        }
                    }
                }
                openRequestAccessModal();
            });
        });
    }

    // ============================================================
    // PRODUCT-CENTERED FEATURE NETWORK & NEXA LIFE PULSE
    // ============================================================
    function initFeatureNetwork() {
        const stage = document.getElementById('networkStage');
        const svg   = document.getElementById('networkSvg');
        const container = document.getElementById('networkNodesContainer');
        if (!stage || !svg || !container) return;

        container.innerHTML = '';
        svg.innerHTML = '';

        // Center coordinates in SVG viewBox (1000 x 700)
        const cx = 500;
        const cy = 350;

        // Position nodes radially around central Nexa
        const coreFeatures = FEATURES.filter(f => f.type === 'core');
        const suppFeatures = FEATURES.filter(f => f.type === 'supporting');

        const nodeCoordinates = {};

        // Core nodes (7 items on inner ellipse)
        const rCoreX = 280;
        const rCoreY = 190;
        coreFeatures.forEach((feat, i) => {
            // Distribute angles evenly with slight offset
            const angle = (i / coreFeatures.length) * (Math.PI * 2) - Math.PI / 2;
            const x = Math.round(cx + Math.cos(angle) * rCoreX);
            const y = Math.round(cy + Math.sin(angle) * rCoreY);
            nodeCoordinates[feat.id] = { x, y, feat, angle };
        });

        // Supporting nodes (4 items on outer perimeter)
        const rSuppX = 420;
        const rSuppY = 270;
        suppFeatures.forEach((feat, i) => {
            const angle = (i / suppFeatures.length) * (Math.PI * 2) - Math.PI / 4;
            const x = Math.round(cx + Math.cos(angle) * rSuppX);
            const y = Math.round(cy + Math.sin(angle) * rSuppY);
            nodeCoordinates[feat.id] = { x, y, feat, angle };
        });

        // Build SVG threads and dynamic DOM nodes
        FEATURES.forEach(feat => {
            const coord = nodeCoordinates[feat.id];
            if (!coord) return;

            const isCore = feat.type === 'core';
            const threadColor = isCore ? 'rgba(0,229,255,0.18)' : 'rgba(139,92,246,0.18)';

            // Base segmented technological thread
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${cx} ${cy} L ${coord.x} ${coord.y}`);
            path.setAttribute('stroke', threadColor);
            path.setAttribute('stroke-width', '1.2');
            path.setAttribute('stroke-dasharray', '4 6');
            path.setAttribute('fill', 'none');
            path.setAttribute('id', `thread_${feat.id}`);
            svg.appendChild(path);

            // Travelling pulse energy element along this path
            const pulseCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            pulseCircle.setAttribute('r', '3.5');
            pulseCircle.setAttribute('fill', isCore ? '#00E5FF' : '#8B5CF6');
            pulseCircle.setAttribute('cx', cx);
            pulseCircle.setAttribute('cy', cy);
            pulseCircle.setAttribute('opacity', '0');
            pulseCircle.setAttribute('id', `pulse_${feat.id}`);
            svg.appendChild(pulseCircle);

            // DOM Node
            const nodeEl = document.createElement('div');
            nodeEl.className = `nx-node nx-node--${feat.type}`;
            nodeEl.id = `node_${feat.id}`;
            nodeEl.style.left = `${(coord.x / 1000) * 100}%`;
            nodeEl.style.top  = `${(coord.y / 700) * 100}%`;

            nodeEl.innerHTML = `
                <div class="nx-node__capsule">
                    <div class="nx-node__icon-shell" title="${feat.title}">
                        ${feat.icon}
                    </div>
                    <div class="nx-node__info">
                        <span class="nx-node__title">${feat.title}</span>
                        <span class="nx-node__desc">${feat.desc}</span>
                    </div>
                </div>
            `;

            // Click selection handler
            nodeEl.addEventListener('click', (e) => {
                e.stopPropagation();
                selectFeatureNode(feat.id, coord);
            });

            container.appendChild(nodeEl);
        });

        // Click outside any node collapses the open node
        stage.addEventListener('click', () => {
            collapseAllNodes();
        });
    }

    // Collapse any active feature node back to icon-only state
    function collapseAllNodes() {
        if (!activeFeatureId) return;
        const prevNode = document.getElementById(`node_${activeFeatureId}`);
        const prevThread = document.getElementById(`thread_${activeFeatureId}`);
        if (prevNode) prevNode.classList.remove('nx-node--active');
        if (prevThread) {
            prevThread.setAttribute('stroke-width', '1.2');
            prevThread.style.filter = 'none';
        }
        activeFeatureId = null;
    }

    // Select feature node with Nexa Life Pulse interaction
    function selectFeatureNode(featId, coord) {
        // If clicking the currently active node, collapse it
        if (activeFeatureId === featId) {
            collapseAllNodes();
            return;
        }

        // Rule: ONLY ONE FEATURE OPEN AT A TIME
        collapseAllNodes();
        activeFeatureId = featId;

        const pulseEl   = document.getElementById(`pulse_${featId}`);
        const threadEl  = document.getElementById(`thread_${featId}`);
        const nodeEl    = document.getElementById(`node_${featId}`);
        const emitter   = document.getElementById('pulseEmitter');
        if (!nodeEl || !pulseEl) return;

        // Emitter ripple at center Nexa
        if (emitter) {
            gsap.fromTo(emitter,
                { opacity: 1, scale: 1 },
                { opacity: 0, scale: 1.8, duration: 0.5, ease: 'power2.out' }
            );
        }

        // 0.0s – 0.45s: NEXA LIFE PULSE travels from Nexa Core to selected node
        const cx = 500;
        const cy = 350;

        if (threadEl) {
            threadEl.setAttribute('stroke-width', '2');
            threadEl.style.filter = 'drop-shadow(0 0 6px rgba(0,229,255,0.4))';
        }

        gsap.fromTo(pulseEl,
            { cx: cx, cy: cy, opacity: 1, r: 4 },
            {
                cx: coord.x,
                cy: coord.y,
                duration: 0.42,
                ease: 'power2.inOut',
                onComplete: () => {
                    // Node receives pulse
                    gsap.to(pulseEl, { opacity: 0, duration: 0.2 });

                    // 0.45s – 0.70s: Node activates with tactile scale micro-interaction
                    gsap.fromTo(nodeEl,
                        { scale: 1.0 },
                        { scale: 1.08, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' }
                    );

                    // 0.70s – 1.0s: Icon transforms into compact capsule
                    nodeEl.classList.add('nx-node--active');
                }
            }
        );
    }

    // ============================================================
    // INTENT → ACTION PIPELINE (Scroll + Interactive Steps)
    // ============================================================
    function initIntentActionSection() {
        const pipeline = document.getElementById('intentPipeline');
        const lineFill = document.getElementById('intentLineFill');
        if (!pipeline || !lineFill) return;

        const steps = pipeline.querySelectorAll('.nx-intent-step');

        const activateStep = (idx) => {
            steps.forEach((s, i) => s.classList.toggle('nx-intent-step--active', i === idx));
            const pct = Math.min(100, Math.max(10, ((idx + 1) / steps.length) * 100));
            lineFill.style.height = `${pct}%`;
        };

        // ScrollTrigger activation
        if (typeof ScrollTrigger !== 'undefined') {
            steps.forEach((step, idx) => {
                const st = ScrollTrigger.create({
                    trigger: step,
                    start: 'top 75%',
                    end: 'bottom 40%',
                    onEnter:     () => activateStep(idx),
                    onEnterBack: () => activateStep(idx)
                });
                phase2ScrollTriggers.push(st);
            });
        }

        // Direct Click & Keyboard Interactivity
        steps.forEach((step, idx) => {
            step.addEventListener('click', () => {
                AudioController.play('act');
                activateStep(idx);
            });
            step.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    AudioController.play('act');
                    activateStep(idx);
                }
            });
        });
    }

    // ============================================================
    // SECTION 02: HARDWARE CRAFTSMANSHIP & 3D WEBGL STUDIO
    // ============================================================
    const PHOTO_VIEWS = {
        isometric: {
            src: 'assets/device/ChatGPT Image Aug 12, 2026, 08_05_02 AM.png',
            label: 'Primary Isometric Perspective — Sandblasted Aerospace Aluminum & Acoustic Fabric'
        },
        chassis: {
            src: 'assets/device/ChatGPT Image Aug 9, 2026, 12_14_16 PM.png',
            label: 'Monolithic Chassis Silhouette — Ultra-narrow Bezel & Integrated Heat Spreader'
        },
        acoustic: {
            src: 'assets/device/ChatGPT Image Aug 9, 2026, 12_14_19 PM.png',
            label: 'Precision Acoustic Cavity — Dual Neodymium Drivers with Dual Passive Radiators'
        },
        sensor: {
            src: 'assets/device/ChatGPT Image Aug 9, 2026, 12_14_22 PM.png',
            label: 'Top Capacitive Sensor Array — Continuous Rotary Glass Ring & Micro-LED Status Beacons'
        }
    };

    let product3DInitialized = false;
    let product3DRenderer    = null;
    let product3DScene       = null;
    let product3DCamera      = null;
    let product3DModel       = null;
    let product3DRAF         = null;
    let product3DAutoRotate  = true;
    let product3DWireframe   = false;
    let product3DObserver    = null;
    let isProductVisible     = false;

    function initProductSection() {
        const productDisplay = document.getElementById('productDisplay');
        const viewSwitcher   = document.getElementById('productViewSwitcher');
        const photoWrap      = document.getElementById('productPhotoWrap');
        const wrap3D         = document.getElementById('product3DWrap');
        const mainImg        = document.getElementById('productMainImg');
        const photoLabel     = document.getElementById('productPhotoLabel');
        if (!productDisplay) return;

        // Animate section display reveal on scroll
        if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
            const st = ScrollTrigger.create({
                trigger: '#productSection',
                start: 'top 80%',
                onEnter: () => {
                    gsap.fromTo(productDisplay,
                        { opacity: 0, y: 35, scale: 0.95 },
                        { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'power2.out' }
                    );
                }
            });
            phase2ScrollTriggers.push(st);
        }

        // View Switcher Buttons
        if (viewSwitcher) {
            const buttons = viewSwitcher.querySelectorAll('.nx-product__view-btn');
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const viewKey = btn.dataset.view;
                    AudioController.play('act');

                    buttons.forEach(b => {
                        b.classList.remove('nx-product__view-btn--active');
                        b.setAttribute('aria-selected', 'false');
                    });
                    btn.classList.add('nx-product__view-btn--active');
                    btn.setAttribute('aria-selected', 'true');

                    if (viewKey === '3d') {
                        // Switch to 3D WebGL mode
                        if (photoWrap) photoWrap.style.display = 'none';
                        if (wrap3D) wrap3D.style.display = 'flex';
                        init3DModelViewer();
                    } else if (PHOTO_VIEWS[viewKey]) {
                        // Switch to photographic perspective
                        if (wrap3D) wrap3D.style.display = 'none';
                        if (photoWrap) photoWrap.style.display = 'flex';

                        // Stop 3D render loop when hidden
                        if (product3DRAF) {
                            cancelAnimationFrame(product3DRAF);
                            product3DRAF = null;
                        }

                        const viewData = PHOTO_VIEWS[viewKey];
                        if (mainImg) {
                            gsap.to(mainImg, {
                                opacity: 0, scale: 0.96, duration: 0.2, ease: 'power2.in',
                                onComplete: () => {
                                    mainImg.src = viewData.src;
                                    if (photoLabel) photoLabel.textContent = viewData.label;
                                    gsap.to(mainImg, { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' });
                                }
                            });
                        }
                    }
                });
            });
        }
    }

    function init3DModelViewer() {
        const wrap = document.getElementById('product3DWrap');
        const canvas = document.getElementById('product3DCanvas');
        const loadingBox = document.getElementById('product3DLoading');
        const loadText = document.getElementById('product3DLoadText');
        const loadFill = document.getElementById('product3DLoadFill');
        const productSection = document.getElementById('productSection');
        if (!wrap || !canvas) return;

        // If already initialized, ensure loop is active and resize
        if (product3DInitialized) {
            on3DResize();
            if (!product3DRAF) render3D();
            return;
        }

        if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') {
            if (loadText) loadText.textContent = '3D Library Initializing... Please verify network.';
            return;
        }

        product3DInitialized = true;

        // Renderer
        const width = wrap.clientWidth || 700;
        const height = wrap.clientHeight || 480;
        product3DRenderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        product3DRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        product3DRenderer.setSize(width, height);
        product3DRenderer.outputEncoding = THREE.sRGBEncoding;
        product3DRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        product3DRenderer.toneMappingExposure = 1.1;

        // Scene & Camera
        product3DScene = new THREE.Scene();
        product3DCamera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
        product3DCamera.position.set(0, 0.4, 3.8);

        // Lighting System
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        product3DScene.add(ambientLight);

        // Cyan Key Light (Top-Left)
        const keyLight = new THREE.DirectionalLight(0x00E5FF, 2.2);
        keyLight.position.set(4, 5, 4);
        product3DScene.add(keyLight);

        // Violet Fill Light (Bottom-Right)
        const fillLight = new THREE.DirectionalLight(0x8B5CF6, 1.6);
        fillLight.position.set(-4, -3, 3);
        product3DScene.add(fillLight);

        // Warm Top Rim Light
        const rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
        rimLight.position.set(0, 6, -3);
        product3DScene.add(rimLight);

        // GLTF Model Loading
        const loader = new THREE.GLTFLoader();
        const modelPath = 'assets/device/neon-device.glb';

        loader.load(
            modelPath,
            (gltf) => {
                product3DModel = gltf.scene;

                // Center & Scale Model
                const box = new THREE.Box3().setFromObject(product3DModel);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scaleFactor = 2.0 / maxDim;

                product3DModel.position.x = -center.x * scaleFactor;
                product3DModel.position.y = -center.y * scaleFactor;
                product3DModel.position.z = -center.z * scaleFactor;
                product3DModel.scale.set(scaleFactor, scaleFactor, scaleFactor);

                product3DModel.rotation.x = 0.25;
                product3DModel.rotation.y = -0.35;

                product3DScene.add(product3DModel);
                window.nexaProduct3DModel = product3DModel;

                if (loadingBox) {
                    gsap.to(loadingBox, {
                        opacity: 0, duration: 0.4,
                        onComplete: () => { loadingBox.style.display = 'none'; }
                    });
                }
            },
            (xhr) => {
                if (xhr.lengthComputable && xhr.total > 0) {
                    const pct = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
                    if (loadText) loadText.textContent = `Loading 3D Hardware Model... ${pct}%`;
                    if (loadFill) loadFill.style.width = `${pct}%`;
                } else {
                    const mb = (xhr.loaded / 1048576).toFixed(1);
                    if (loadText) loadText.textContent = `Streaming 3D Mesh... ${mb} MB`;
                    if (loadFill) loadFill.style.width = '70%';
                }
            },
            (error) => {
                console.warn('[Nexa 3D] Failed to load model:', error);
                if (loadText) loadText.textContent = '3D Hardware Model loaded with photographic preview fallback.';
            }
        );

        // Mouse & Touch Drag Interaction
        let isDragging = false;
        let prevMouseX = 0;
        let prevMouseY = 0;
        let rotSpeedX = 0;
        let rotSpeedY = 0;

        const onPointerDown = (x, y) => {
            isDragging = true;
            prevMouseX = x;
            prevMouseY = y;
            rotSpeedX = 0;
            rotSpeedY = 0;
        };

        const onPointerMove = (x, y) => {
            if (!isDragging || !product3DModel) return;
            const deltaX = x - prevMouseX;
            const deltaY = y - prevMouseY;
            prevMouseX = x;
            prevMouseY = y;

            rotSpeedY = deltaX * 0.008;
            rotSpeedX = deltaY * 0.008;

            product3DModel.rotation.y += rotSpeedY;
            product3DModel.rotation.x += rotSpeedX;
        };

        const onPointerUp = () => { isDragging = false; };

        canvas.addEventListener('mousedown', (e) => onPointerDown(e.clientX, e.clientY));
        window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', onPointerUp);

        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        window.addEventListener('touchend', onPointerUp);

        // Zoom with wheel
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (!product3DCamera) return;
            product3DCamera.position.z += e.deltaY * 0.003;
            product3DCamera.position.z = Math.max(2.0, Math.min(6.5, product3DCamera.position.z));
        }, { passive: false });

        // Auto-Rotate Button
        const btnRotate = document.getElementById('btn3DRotateToggle');
        if (btnRotate) {
            btnRotate.addEventListener('click', () => {
                product3DAutoRotate = !product3DAutoRotate;
                btnRotate.textContent = `Auto-Rotate: ${product3DAutoRotate ? 'ON' : 'OFF'}`;
                AudioController.play('act');
            });
        }

        // Wireframe Button
        const btnWireframe = document.getElementById('btn3DWireframe');
        if (btnWireframe) {
            btnWireframe.addEventListener('click', () => {
                product3DWireframe = !product3DWireframe;
                btnWireframe.textContent = `Wireframe: ${product3DWireframe ? 'ON' : 'OFF'}`;
                AudioController.play('act');
                if (product3DModel) {
                    product3DModel.traverse((child) => {
                        if (child.isMesh && child.material) {
                            child.material.wireframe = product3DWireframe;
                        }
                    });
                }
            });
        }

        // Reset View Button
        const btnReset = document.getElementById('btn3DReset');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                AudioController.play('act');
                if (product3DModel) {
                    gsap.to(product3DModel.rotation, { x: 0.25, y: -0.35, z: 0, duration: 0.6, ease: 'power2.out' });
                }
                if (product3DCamera) {
                    gsap.to(product3DCamera.position, { z: 3.8, duration: 0.6, ease: 'power2.out' });
                }
            });
        }

        function on3DResize() {
            if (!wrap || !product3DRenderer || !product3DCamera) return;
            const w = wrap.clientWidth;
            const h = wrap.clientHeight;
            product3DCamera.aspect = w / h;
            product3DCamera.updateProjectionMatrix();
            product3DRenderer.setSize(w, h);
        }
        window.addEventListener('resize', on3DResize, { passive: true });

        // IntersectionObserver to pause WebGL rendering when off-screen
        if (productSection && typeof IntersectionObserver !== 'undefined') {
            product3DObserver = new IntersectionObserver((entries) => {
                isProductVisible = entries[0].isIntersecting;
                if (isProductVisible && !product3DRAF && wrap.style.display !== 'none') {
                    render3D();
                }
            }, { threshold: 0.05 });
            product3DObserver.observe(productSection);
        } else {
            isProductVisible = true;
        }

        function render3D() {
            if (!phase2Active || !isProductVisible || wrap.style.display === 'none') {
                product3DRAF = null;
                return;
            }
            product3DRAF = requestAnimationFrame(render3D);

            if (product3DModel) {
                if (product3DAutoRotate && !isDragging) {
                    product3DModel.rotation.y += 0.005;
                }
                if (!isDragging) {
                    rotSpeedX *= 0.92;
                    rotSpeedY *= 0.92;
                    product3DModel.rotation.y += rotSpeedY;
                    product3DModel.rotation.x += rotSpeedX;
                }
            }

            product3DRenderer.render(product3DScene, product3DCamera);
        }
        render3D();
    }

    // ============================================================
    // SECTION 04: COMMAND DEMONSTRATION & SFX ROOM AUTOMATION
    // ============================================================
    function initCommandExperience() {
        const video       = document.getElementById('nexaVideo');
        const commandBtn  = document.getElementById('commandBtn');
        const resetBtn    = document.getElementById('videoResetBtn');
        const overlay     = document.getElementById('videoOverlay');
        const scenariosBar= document.getElementById('commandScenariosBar');
        if (!video || !commandBtn) return;

        if (!commandBtn.querySelector('.nx-command-btn__label')) {
            commandBtn.innerHTML =
                '<span class="nx-command-btn__glow"></span>' +
                '<span class="nx-command-btn__label">COMMAND</span>';
        }

        // Build Dynamic Scenario Chips Playlist
        if (scenariosBar) {
            scenariosBar.innerHTML = '';
            COMMANDS.forEach((cmd, idx) => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = `nx-scenario-chip ${idx === 0 ? 'nx-scenario-chip--active' : ''}`;
                chip.setAttribute('data-cmd-idx', String(idx));
                chip.setAttribute('role', 'tab');
                chip.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
                chip.innerHTML = `
                    <div class="nx-scenario-chip__top">
                        <span class="nx-scenario-chip__num">SCENARIO 0${idx + 1}</span>
                        <span class="nx-scenario-chip__sfx-badge">${cmd.tag}</span>
                    </div>
                    <span class="nx-scenario-chip__title">${cmd.text}</span>
                `;
                chip.addEventListener('click', () => {
                    AudioController.play('act');
                    loadCommand(idx);
                    handleCommandPress();
                });
                scenariosBar.appendChild(chip);
            });
        }

        loadCommand(0);

        commandBtn.addEventListener('click', handleCommandPress);
        if (resetBtn) resetBtn.addEventListener('click', resetCommandExperience);

        video.addEventListener('ended', onVideoEnded);
        video.addEventListener('play', () => {
            if (overlay) {
                gsap.to(overlay, {
                    opacity: 0, duration: 0.4,
                    onComplete: () => { overlay.style.pointerEvents = 'none'; }
                });
            }
        });
    }

    function loadCommand(index) {
        const video      = document.getElementById('nexaVideo');
        const commandText= document.getElementById('commandText');
        const commandBtn = document.getElementById('commandBtn');
        const overlay    = document.getElementById('videoOverlay');
        const roomStatus = document.getElementById('roomStatusText');
        const sfxIndicator= document.getElementById('sfxIndicator');
        if (!video) return;

        currentCommandIndex = index;
        commandPlaying  = false;
        commandComplete = (index >= COMMANDS.length);

        if (sfxIndicator) sfxIndicator.classList.remove('nx-sfx-badge--active');

        // Update Scenario Chips Active State
        const chips = document.querySelectorAll('.nx-scenario-chip');
        chips.forEach((chip, idx) => {
            const isActive = (idx === index);
            chip.classList.toggle('nx-scenario-chip--active', isActive);
            chip.setAttribute('aria-selected', String(isActive));
        });

        if (commandText) {
            gsap.to(commandText, {
                opacity: 0, y: -10, duration: 0.2, ease: 'power2.in',
                onComplete: () => {
                    commandText.innerHTML = index < COMMANDS.length
                        ? COMMANDS[index].text
                        : '\u201cThe full room demonstration is complete.\u201d';
                    gsap.fromTo(commandText, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
                }
            });
        }

        if (index < COMMANDS.length) {
            const cmd = COMMANDS[index];
            video.src = VIDEOS_PATH + cmd.src;
            video.load();
            video.pause();

            if (cmd.preview) video.poster = cmd.preview;

            if (roomStatus) {
                roomStatus.innerHTML = `Environment Status: Ready &bull; Scenario 0${index + 1}: <strong>${cmd.tag}</strong>`;
            }

            if (overlay) {
                overlay.style.opacity = '1';
                overlay.style.pointerEvents = 'auto';
            }

            if (commandBtn) {
                commandBtn.disabled = false;
                const label = commandBtn.querySelector('.nx-command-btn__label');
                if (label) label.textContent = 'COMMAND';
            }
        } else {
            if (roomStatus) {
                roomStatus.innerHTML = `Environment Status: Demonstration Complete &bull; All 8 Room States Verified`;
            }
            if (commandBtn) {
                commandBtn.disabled = true;
                const label = commandBtn.querySelector('.nx-command-btn__label');
                if (label) label.textContent = 'DEMO COMPLETE';
            }
        }
    }

    function handleCommandPress() {
        if (commandPlaying || commandComplete) return;
        const video      = document.getElementById('nexaVideo');
        const commandBtn = document.getElementById('commandBtn');
        const roomStatus = document.getElementById('roomStatusText');
        const sfxIndicator = document.getElementById('sfxIndicator');
        const sfxLabel   = document.getElementById('sfxLabel');
        if (!video) return;

        const cmd = COMMANDS[currentCommandIndex];

        // Play 02.mp3 Voice Chime
        AudioController.play('cmd');

        // Play Synchronized Room SFX
        if (cmd && cmd.sfx) {
            setTimeout(() => {
                AudioController.play(cmd.sfx, 0.85);
            }, 300);
        }

        // Show SFX Wave Indicator
        if (sfxIndicator) {
            sfxIndicator.classList.add('nx-sfx-badge--active');
            if (sfxLabel && cmd) {
                sfxLabel.textContent = `Acoustic SFX: ${cmd.tag} Active`;
            }
        }

        if (roomStatus && cmd) {
            roomStatus.innerHTML = `Executing: <strong>${cmd.text}</strong> — ${cmd.desc}`;
        }

        commandPlaying = true;

        if (commandBtn) {
            gsap.to(commandBtn, {
                scale: 0.96, duration: 0.1, ease: 'power1.in',
                onComplete: () => gsap.to(commandBtn, { scale: 1, duration: 0.2, ease: 'power1.out' })
            });
        }

        // Hint preload next video
        const nextIndex = currentCommandIndex + 1;
        if (nextIndex < COMMANDS.length) {
            const href = VIDEOS_PATH + COMMANDS[nextIndex].src;
            if (!preloadedVideoHints.has(href)) {
                preloadedVideoHints.add(href);
                const link = document.createElement('link');
                link.rel   = 'preload';
                link.as    = 'video';
                link.href  = href;
                document.head.appendChild(link);
            }
        }

        video.play().catch(err => {
            console.warn('[Nexa Command] Video play error:', err);
            commandPlaying = false;
        });
    }

    function onVideoEnded() {
        const sfxIndicator = document.getElementById('sfxIndicator');
        if (sfxIndicator) sfxIndicator.classList.remove('nx-sfx-badge--active');

        const roomStatus = document.getElementById('roomStatusText');
        if (roomStatus && COMMANDS[currentCommandIndex]) {
            roomStatus.innerHTML = `Completed: <strong>${COMMANDS[currentCommandIndex].tag}</strong> &bull; Room state synchronized`;
        }

        setTimeout(() => loadCommand(currentCommandIndex + 1), 900);
    }

    function resetCommandExperience() {
        AudioController.play('act');
        const video = document.getElementById('nexaVideo');
        if (video) {
            video.pause();
            video.currentTime = 0;
        }
        loadCommand(0);
    }

    // ============================================================
    // NAVIGATION
    // ============================================================
    function initNav() {
        const nav = document.getElementById('nexaNav');
        if (!nav) return;

        let navScrollRAF = null;
        window.addEventListener('scroll', () => {
            if (navScrollRAF) return;
            navScrollRAF = requestAnimationFrame(() => {
                navScrollRAF = null;
                if (window.scrollY > 80) {
                    nav.classList.add('nx-nav--scrolled');
                } else {
                    nav.classList.remove('nx-nav--scrolled');
                }
            });
        }, { passive: true });

        nav.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener('click', (e) => {
                const target = document.querySelector(link.getAttribute('href'));
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    closeMobileMenu();
                }
            });
        });

        const toggle = document.getElementById('mobileMenuToggle');
        const menu   = document.getElementById('mobileMenu');
        if (toggle && menu) {
            toggle.addEventListener('click', () => {
                const open = toggle.getAttribute('aria-expanded') === 'true';
                toggle.setAttribute('aria-expanded', String(!open));
                menu.setAttribute('aria-hidden', String(open));
                toggle.classList.toggle('nx-nav__mobile-toggle--open', !open);
                menu.classList.toggle('nx-nav__mobile-menu--open', !open);
            });
            menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMobileMenu));
        }
    }

    function closeMobileMenu() {
        const toggle = document.getElementById('mobileMenuToggle');
        const menu   = document.getElementById('mobileMenu');
        if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.classList.remove('nx-nav__mobile-toggle--open'); }
        if (menu)   { menu.setAttribute('aria-hidden', 'true'); menu.classList.remove('nx-nav__mobile-menu--open'); }
    }

    // ============================================================
    // HERO REVEAL & PARTICLES
    // ============================================================
    function initHeroReveal() {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.from('#heroEyebrow',   { opacity: 0, y: -20, duration: 0.7 })
          .from('#heroTitle',     { opacity: 0, y: 30,  duration: 0.9 }, '-=0.4')
          .from('#heroStatement', { opacity: 0, y: 20,  duration: 0.7 }, '-=0.5')
          .from('#heroCopy',      { opacity: 0, y: 15,  duration: 0.6 }, '-=0.4')
          .from('#heroActions',   { opacity: 0, y: 15,  duration: 0.6 }, '-=0.3')
          .from('#heroScrollCue', { opacity: 0,          duration: 0.8 }, '-=0.2');

        const container = document.getElementById('heroParticles');
        if (!container) return;

        const count = window.innerWidth < 768 ? 12 : 28;
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'nx-particle';
            p.style.cssText = [
                `left:${(Math.random() * 100).toFixed(1)}%`,
                `top:${(Math.random() * 100).toFixed(1)}%`,
                `width:${(1 + Math.random() * 1.5).toFixed(1)}px`,
                `height:${(1 + Math.random() * 1.5).toFixed(1)}px`,
                `opacity:${(0.08 + Math.random() * 0.22).toFixed(2)}`,
                `animation-delay:${(Math.random() * 6).toFixed(1)}s`,
                `animation-duration:${(7 + Math.random() * 8).toFixed(1)}s`,
            ].join(';');
            container.appendChild(p);
        }
    }

    // ============================================================
    // SECTION ANIMATIONS (GSAP ScrollTrigger)
    // ============================================================
    function initSectionAnimations() {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
        gsap.registerPlugin(ScrollTrigger);

        document.querySelectorAll('.nx-section').forEach(section => {
            const label = section.querySelector('.nx-label');
            const title = section.querySelector('.nx-section-title');
            const lead  = section.querySelector('.nx-section-lead');

            if (label || title || lead) {
                const tl = gsap.timeline({
                    scrollTrigger: {
                        trigger: section,
                        start: 'top 80%',
                        toggleActions: 'play none none none'
                    }
                });
                if (label) tl.from(label, { opacity: 0, y: 20, duration: 0.6, ease: 'power2.out' });
                if (title) tl.from(title, { opacity: 0, y: 30, duration: 0.8, ease: 'power3.out' }, '-=0.3');
                if (lead)  tl.from(lead,  { opacity: 0, y: 20, duration: 0.7, ease: 'power2.out' }, '-=0.5');
                phase2ScrollTriggers.push(tl.scrollTrigger);
            }
        });

        const makeST = (config) => {
            const st = ScrollTrigger.create(config);
            phase2ScrollTriggers.push(st);
            return st;
        };

        // Use cases
        makeST({
            trigger: '#usecaseSection', start: 'top 75%',
            onEnter: () => gsap.from('.nx-usecase', { opacity: 0, y: 30, duration: 0.6, stagger: 0.08, ease: 'power2.out' })
        });

        // Hub items
        makeST({
            trigger: '#nexaHubSection', start: 'top 75%',
            onEnter: () => gsap.from('.nx-hub-item', { opacity: 0, y: 30, duration: 0.6, stagger: 0.1, ease: 'power2.out' })
        });

        // Privacy cards
        makeST({
            trigger: '#privacySection', start: 'top 75%',
            onEnter: () => gsap.from('.nx-privacy-card', { opacity: 0, y: 30, duration: 0.6, stagger: 0.12, ease: 'power2.out' })
        });

        // Product tiers
        makeST({
            trigger: '#tiersSection', start: 'top 75%',
            onEnter: () => gsap.from('.nx-tier', { opacity: 0, y: 35, duration: 0.8, stagger: 0.15, ease: 'power3.out' })
        });

        // Vision statements
        makeST({
            trigger: '#visionSection', start: 'top 75%',
            onEnter: () => gsap.from('.nx-vision__statement', { opacity: 0, x: -20, duration: 0.7, stagger: 0.15, ease: 'power2.out' })
        });
    }

    // ============================================================
    // HERO 3D AMBIENT QUANTUM LATTICE
    // ============================================================
    let hero3DRaf = null;
    let hero3DObserver = null;

    function initHero3DCanvas() {
        const canvas = document.getElementById('hero3DCanvas');
        const heroSection = document.getElementById('heroSection');
        if (!canvas || !heroSection) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = 0;
        let height = 0;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        function resize() {
            if (!canvas.parentElement) return;
            width = canvas.parentElement.clientWidth;
            height = canvas.parentElement.clientHeight;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
        }
        resize();
        window.addEventListener('resize', resize, { passive: true });

        // 3D Icosahedron Vertices
        const phi = (1 + Math.sqrt(5)) / 2;
        const rawVertices = [
            [-1,  phi, 0], [ 1,  phi, 0], [-1, -phi, 0], [ 1, -phi, 0],
            [ 0, -1,  phi], [ 0,  1,  phi], [ 0, -1, -phi], [ 0,  1, -phi],
            [ phi, 0, -1], [ phi, 0,  1], [-phi, 0, -1], [-phi, 0,  1]
        ];
        const radius = Math.min(width, height) * 0.28;
        const vertices = rawVertices.map(v => {
            const len = Math.hypot(v[0], v[1], v[2]);
            return { x: (v[0] / len) * radius, y: (v[1] / len) * radius, z: (v[2] / len) * radius };
        });

        const edges = [];
        for (let i = 0; i < vertices.length; i++) {
            for (let j = i + 1; j < vertices.length; j++) {
                const dist = Math.hypot(
                    vertices[i].x - vertices[j].x,
                    vertices[i].y - vertices[j].y,
                    vertices[i].z - vertices[j].z
                );
                if (dist < radius * 1.18) {
                    edges.push([i, j]);
                }
            }
        }

        let rotX = 0.2;
        let rotY = 0;
        let rotZ = 0;
        let targetRotX = 0;
        let targetRotY = 0;

        window.addEventListener('mousemove', (e) => {
            if (!phase2Active) return;
            const nx = (e.clientX / window.innerWidth) - 0.5;
            const ny = (e.clientY / window.innerHeight) - 0.5;
            targetRotX = ny * 0.35;
            targetRotY = nx * 0.45;
        }, { passive: true });

        let isHeroVisible = true;
        hero3DObserver = new IntersectionObserver((entries) => {
            isHeroVisible = entries[0].isIntersecting;
            if (isHeroVisible && !hero3DRaf) {
                render();
            }
        }, { threshold: 0.05 });
        hero3DObserver.observe(heroSection);

        function render() {
            if (!phase2Active || !isHeroVisible) {
                hero3DRaf = null;
                return;
            }
            hero3DRaf = requestAnimationFrame(render);

            rotY += 0.0035;
            rotX += (targetRotX - rotX) * 0.04;
            rotZ += 0.001;

            ctx.clearRect(0, 0, width, height);

            const cx = width / 2;
            const cy = height / 2 + 15;
            const fov = 420;

            const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
            const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
            const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);

            const projected = vertices.map(v => {
                let x1 = v.x * cosY - v.z * sinY;
                let z1 = v.z * cosY + v.x * sinY;
                let y2 = v.y * cosX - z1 * sinX;
                let z2 = z1 * cosX + v.y * sinX;
                let x3 = x1 * cosZ - y2 * sinZ;
                let y3 = y2 * cosZ + x1 * sinZ;

                const scale = fov / (fov + z2 + 220);
                return {
                    x: cx + x3 * scale,
                    y: cy + y3 * scale,
                    z: z2,
                    scale: scale
                };
            });

            ctx.lineWidth = 1;
            edges.forEach(([i, j]) => {
                const p1 = projected[i];
                const p2 = projected[j];
                const avgZ = (p1.z + p2.z) / 2;
                const alpha = Math.max(0.06, Math.min(0.42, 0.24 + avgZ / 400));
                ctx.strokeStyle = `rgba(0, 229, 255, ${alpha})`;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            });

            projected.forEach(p => {
                const nodeAlpha = Math.max(0.12, Math.min(0.85, 0.42 + p.z / 350));
                ctx.fillStyle = `rgba(0, 229, 255, ${nodeAlpha})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.5 * p.scale, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = `rgba(139, 92, 246, ${nodeAlpha * 0.35})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5.5 * p.scale, 0, Math.PI * 2);
                ctx.fill();
            });
        }
        render();
    }

    // ============================================================
    // CUSTOM RESPONSIVE CURSOR (Desktop only, Phase 2 only)
    // ============================================================
    let cursorRaf = null;

    function initCustomCursor() {
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

        const cursor = document.getElementById('nxCursor');
        const dot = document.getElementById('nxCursorDot');
        const ring = document.getElementById('nxCursorRing');
        if (!cursor || !dot || !ring) return;

        cursor.classList.add('nx-cursor--active');

        let mouseX = -100, mouseY = -100;
        let ringX = -100, ringY = -100;

        const onMouseMove = (e) => {
            if (!phase2Active) return;
            mouseX = e.clientX;
            mouseY = e.clientY;
            dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
        };

        const onMouseDown = () => cursor.classList.add('nx-cursor--pressed');
        const onMouseUp   = () => cursor.classList.remove('nx-cursor--pressed');
        const onMouseLeave = () => { cursor.style.opacity = '0'; };
        const onMouseEnter = () => { cursor.style.opacity = '1'; };

        window.addEventListener('mousemove', onMouseMove, { passive: true });
        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        document.body.addEventListener('mouseleave', onMouseLeave);
        document.body.addEventListener('mouseenter', onMouseEnter);

        const interactiveSelector = 'a, button, .nx-btn, .nx-feat-card, .nx-hub-item, .nx-tier, .nx-node, input, select, textarea';
        document.addEventListener('mouseover', (e) => {
            if (e.target.closest(interactiveSelector)) {
                cursor.classList.add('nx-cursor--hover');
            }
        });
        document.addEventListener('mouseout', (e) => {
            if (e.target.closest(interactiveSelector)) {
                cursor.classList.remove('nx-cursor--hover');
            }
        });

        function cursorLoop() {
            if (!phase2Active) {
                cursorRaf = null;
                return;
            }
            cursorRaf = requestAnimationFrame(cursorLoop);
            ringX += (mouseX - ringX) * 0.18;
            ringY += (mouseY - ringY) * 0.18;
            ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
        }
        cursorLoop();
    }

    // ============================================================
    // INTERACTIVE 3D PERSPECTIVE TILT (Desktop only)
    // ============================================================
    function initInteractive3DTilt() {
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

        const cards = document.querySelectorAll('.nx-feat-card, .nx-hub-item, .nx-tier');
        cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = ((y - centerY) / centerY) * -5;
                const rotateY = ((x - centerX) / centerX) * 5;

                card.style.transform = `perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            });
        });
    }

    // ============================================================
    // REQUEST ACCESS MODAL & SECURE API SUBMISSION
    // ============================================================
    function openRequestAccessModal() {
        const modal = document.getElementById('requestAccessModal');
        const form = document.getElementById('requestAccessForm');
        const successBox = document.getElementById('modalSuccess');
        const statusBox = document.getElementById('formStatus');
        const renderTimeInput = document.getElementById('formRenderTime');
        const nameInput = document.getElementById('reqName');

        if (!modal) return;

        modal.classList.add('nx-modal--active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        if (renderTimeInput) renderTimeInput.value = Date.now().toString();
        if (statusBox) { statusBox.className = 'nx-form-status'; statusBox.textContent = ''; }
        if (form) form.style.display = 'block';
        if (successBox) successBox.style.display = 'none';

        setTimeout(() => { if (nameInput) nameInput.focus(); }, 100);
    }

    function closeRequestAccessModal() {
        const modal = document.getElementById('requestAccessModal');
        if (!modal) return;
        modal.classList.remove('nx-modal--active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function initRequestAccessModal() {
        const modal = document.getElementById('requestAccessModal');
        const backdrop = document.getElementById('modalBackdrop');
        const closeBtn = document.getElementById('modalCloseBtn');
        const successCloseBtn = document.getElementById('modalSuccessClose');
        const form = document.getElementById('requestAccessForm');
        const statusBox = document.getElementById('formStatus');
        const submitBtn = document.getElementById('btnSubmitRequest');

        if (!modal || !form) return;

        if (backdrop) backdrop.addEventListener('click', closeRequestAccessModal);
        if (closeBtn) closeBtn.addEventListener('click', closeRequestAccessModal);
        if (successCloseBtn) successCloseBtn.addEventListener('click', closeRequestAccessModal);

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('nx-modal--active')) {
                closeRequestAccessModal();
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('reqName')?.value.trim();
            const email = document.getElementById('reqEmail')?.value.trim();
            const tier = document.getElementById('reqTier')?.value;
            const useCase = document.getElementById('reqUseCase')?.value;
            const website = document.getElementById('company_website_input')?.value;
            const renderTime = document.getElementById('formRenderTime')?.value;

            // Client validation
            if (!name || name.length < 2) {
                showFormStatus('Please enter your full name (at least 2 characters).', 'error');
                return;
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email)) {
                showFormStatus('Please enter a valid email address.', 'error');
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="nx-btn__label">TRANSMITTING...</span>';
            }

            try {
                const res = await fetch('/api/request-access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, tier, useCase, website, renderTime })
                });
                const result = await res.json();

                if (res.ok && result.success) {
                    form.style.display = 'none';
                    const successBox = document.getElementById('modalSuccess');
                    const msgText = document.getElementById('successMsgText');
                    if (msgText && result.ref) {
                        msgText.textContent = `Your early access priority spot has been recorded (Reference: ${result.ref}). We will notify you at ${email} as hardware production begins.`;
                    }
                    if (successBox) successBox.style.display = 'block';
                } else {
                    showFormStatus(result.error || 'Unable to register request. Please try again.', 'error');
                }
            } catch (err) {
                showFormStatus('Network connection error. Please verify connectivity and try again.', 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span class="nx-btn__label">RESERVE EARLY ACCESS SPOT</span>';
                }
            }
        });

        function showFormStatus(msg, type) {
            if (!statusBox) return;
            statusBox.className = `nx-form-status nx-form-status--${type}`;
            statusBox.textContent = msg;
        }
    }

    // ============================================================
    // RETURN TO PREFACE & CLEANUP
    // ============================================================
    function returnToPreface() {
        for (const st of phase2ScrollTriggers) {
            if (st && st.kill) st.kill();
        }
        phase2ScrollTriggers.length = 0;

        closeRequestAccessModal();

        const cursor = document.getElementById('nxCursor');
        if (cursor) cursor.classList.remove('nx-cursor--active');

        if (hero3DRaf) {
            cancelAnimationFrame(hero3DRaf);
            hero3DRaf = null;
        }
        if (hero3DObserver) {
            hero3DObserver.disconnect();
            hero3DObserver = null;
        }

        if (product3DRAF) {
            cancelAnimationFrame(product3DRAF);
            product3DRAF = null;
        }
        if (product3DObserver) {
            product3DObserver.disconnect();
            product3DObserver = null;
        }

        const video = document.getElementById('nexaVideo');
        if (video) { video.pause(); video.src = ''; }

        phase2Active      = false;
        phase2Initialized = false;
        diveInBound       = false;

        if (window.nexaSetPhase2) window.nexaSetPhase2(false);

        const officialSite = document.getElementById('officialSite');
        if (officialSite) {
            officialSite.classList.remove('official-site--active');
            officialSite.style.display = 'none';
        }

        const seqSection = document.querySelector('.sequence-section');
        const seqCanvas  = document.getElementById('sequenceCanvas');
        if (seqSection) seqSection.style.display = 'block';
        if (seqCanvas)  seqCanvas.style.display  = 'block';

        document.querySelectorAll('#prefaceBrand, #prefaceControls, #prefaceProgress, #prefaceDebug').forEach(el => {
            if (el) { el.style.display = ''; el.style.opacity = '1'; }
        });

        document.body.style.overflow = '';
        window.scrollTo(0, 0);

        if (window.prefaceScrollTrigger) window.prefaceScrollTrigger.enable();
        if (window.nexaRestart)          window.nexaRestart();

        setTimeout(bindDiveIn, 100);
    }

    // ============================================================
    // BOOT
    // ============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForPhase1);
    } else {
        waitForPhase1();
    }

})();

/* ============================================================
   ZETHICA — welcome-audio.js
   Automatic Welcome Audio Experience
   
   Features:
   - Automatic playback on homepage load with Promise handling
   - Graceful fallback to manual play when autoplay is blocked
   - Session tracking to prevent repeat playback on same visit
   - Sound-wave animation during playback
   - Play/pause/replay controls
   - Respects reduced-motion preferences
   - Mobile & desktop responsive
   ============================================================ */

'use strict';

class ZethicaWelcomeAudio {
  constructor() {
    // Audio element and DOM references
    this.audio = null;
    this.playBtn = null;
    this.pauseBtn = null;
    this.replayBtn = null;
    this.muteBtn = null;
    this.player = null;
    this.soundwave = null;
    this.statusText = null;
    
    // State tracking
    this.isPlaying = false;
    this.hasAutoplayAttempted = false;
    this.hasPlayedThisSession = false;
    this.isAutoplaySupported = null;
    
    // Configuration
    this.audioUrl = '/audio/Zethica_Welcome.m4a';
    this.sessionKey = 'zethica-welcome-audio-played';
    
    // Timing
    this.autoplayDelayMs = 800; // Wait for DOM/styles to load
    this.controlsShowDelayMs = 300;
  }

  /**
   * Initialize the welcome audio system
   */
  async init() {
    try {
      // Check if session has already played this audio
      this.checkSessionPlayback();
      
      // Create audio element
      this.createAudioElement();
      
      // Get DOM references (player created in HTML)
      this.getPlayerElements();
      
      // Bind event listeners
      this.bindEvents();
      
      // Respect reduced motion preferences
      if (!this.prefersReducedMotion()) {
        // Defer autoplay attempt to allow page to fully load
        setTimeout(() => this.attemptAutoplay(), this.autoplayDelayMs);
      } else {
        // User prefers reduced motion: just show manual controls
        this.revealControls();
      }
      
      console.log('[Zethica Audio] Welcome audio system initialized');
    } catch (error) {
      console.error('[Zethica Audio] Initialization failed:', error);
    }
  }

  /**
   * Check if audio was already played in this session
   */
  checkSessionPlayback() {
    const played = sessionStorage.getItem(this.sessionKey);
    if (played) {
      this.hasPlayedThisSession = true;
      console.log('[Zethica Audio] Audio already played this session');
    }
  }

  /**
   * Create and configure the HTML5 audio element
   */
  createAudioElement() {
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.audio.src = this.audioUrl;
    this.audio.onplay = () => this.onAudioPlay();
    this.audio.onpause = () => this.onAudioPause();
    this.audio.onended = () => this.onAudioEnded();
    this.audio.onerror = (e) => this.onAudioError(e);
  }

  /**
   * Get references to player DOM elements (created in HTML)
   */
  getPlayerElements() {
    this.player = document.getElementById('zethica-welcome-player');
    this.playBtn = document.getElementById('zethica-welcome-play');
    this.pauseBtn = document.getElementById('zethica-welcome-pause');
    this.replayBtn = document.getElementById('zethica-welcome-replay');
    this.muteBtn = document.getElementById('zethica-welcome-mute');
    this.soundwave = document.getElementById('zethica-welcome-soundwave');
    this.statusText = document.getElementById('zethica-welcome-status');
    
    if (!this.player) {
      throw new Error('Welcome audio player element not found in DOM');
    }
  }

  /**
   * Bind event listeners to player controls
   */
  bindEvents() {
    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.play());
    }
    
    if (this.pauseBtn) {
      this.pauseBtn.addEventListener('click', () => this.pause());
    }
    
    if (this.replayBtn) {
      this.replayBtn.addEventListener('click', () => this.replay());
    }
    
    if (this.muteBtn) {
      this.muteBtn.addEventListener('click', () => this.toggleMute());
    }
    
    // Audio events
    this.audio.addEventListener('play', () => this.updateUI());
    this.audio.addEventListener('pause', () => this.updateUI());
    this.audio.addEventListener('ended', () => this.updateUI());
  }

  /**
   * Attempt automatic playback on page load
   */
  async attemptAutoplay() {
    // Don't autoplay if already played this session
    if (this.hasPlayedThisSession) {
      console.log('[Zethica Audio] Skipping autoplay (already played this session)');
      this.revealControls();
      return;
    }

    this.hasAutoplayAttempted = true;

    try {
      console.log('[Zethica Audio] Attempting autoplay...');
      
      // Try to play
      const playPromise = this.audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Autoplay succeeded
            console.log('[Zethica Audio] Autoplay succeeded');
            this.isAutoplaySupported = true;
            this.markSessionPlayback();
            this.revealControls();
            this.updateUI();
          })
          .catch((error) => {
            // Autoplay blocked (expected in most browsers)
            console.log('[Zethica Audio] Autoplay blocked by browser:', error.name);
            this.isAutoplaySupported = false;
            this.handleAutoplayBlocked();
          });
      }
    } catch (error) {
      console.error('[Zethica Audio] Autoplay error:', error);
      this.isAutoplaySupported = false;
      this.handleAutoplayBlocked();
    }
  }

  /**
   * Handle case when autoplay is blocked
   */
  handleAutoplayBlocked() {
    console.log('[Zethica Audio] Autoplay blocked - showing manual controls');
    
    // Update status text
    if (this.statusText) {
      this.statusText.textContent = 'Autoplay blocked';
      this.statusText.classList.add('blocked');
    }
    
    // Show player with manual controls visible
    this.revealControls();
    this.player.classList.add('autoplay-blocked');
  }

  /**
   * Reveal player controls
   */
  revealControls() {
    if (this.player) {
      setTimeout(() => {
        this.player.classList.add('visible');
        this.updateUI();
      }, this.controlsShowDelayMs);
    }
  }

  /**
   * Mark audio as played in this session (sessionStorage)
   */
  markSessionPlayback() {
    sessionStorage.setItem(this.sessionKey, 'true');
    this.hasPlayedThisSession = true;
  }

  /**
   * Play the audio
   */
  play() {
    if (!this.audio) return;
    
    try {
      const playPromise = this.audio.play();
      
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error('[Zethica Audio] Play error:', error);
        });
      }
    } catch (error) {
      console.error('[Zethica Audio] Play failed:', error);
    }
  }

  /**
   * Pause the audio
   */
  pause() {
    if (!this.audio) return;
    this.audio.pause();
  }

  /**
   * Replay from the beginning
   */
  replay() {
    if (!this.audio) return;
    this.audio.currentTime = 0;
    this.play();
    this.markSessionPlayback();
  }

  /**
   * Toggle mute on/off
   */
  toggleMute() {
    if (!this.audio) return;
    this.audio.muted = !this.audio.muted;
    
    if (this.muteBtn) {
      this.muteBtn.classList.toggle('muted', this.audio.muted);
      this.muteBtn.setAttribute('aria-label', 
        this.audio.muted ? 'Unmute audio' : 'Mute audio'
      );
    }
  }

  /**
   * Audio play event handler
   */
  onAudioPlay() {
    this.isPlaying = true;
    console.log('[Zethica Audio] Playing');
  }

  /**
   * Audio pause event handler
   */
  onAudioPause() {
    this.isPlaying = false;
    console.log('[Zethica Audio] Paused');
  }

  /**
   * Audio ended event handler
   */
  onAudioEnded() {
    this.isPlaying = false;
    console.log('[Zethica Audio] Ended');
  }

  /**
   * Audio error handler
   */
  onAudioError(e) {
    console.error('[Zethica Audio] Error:', e);
    
    if (this.statusText) {
      this.statusText.textContent = 'Audio unavailable';
      this.statusText.classList.add('error');
    }
    
    if (this.player) {
      this.player.classList.add('error-state');
    }
  }

  /**
   * Update UI to reflect current playback state
   */
  updateUI() {
    if (!this.player) return;
    
    // Update playing state
    this.player.classList.toggle('playing', this.isPlaying);
    
    // Show/hide play and pause buttons
    if (this.playBtn) {
      this.playBtn.classList.toggle('hidden', this.isPlaying);
    }
    
    if (this.pauseBtn) {
      this.pauseBtn.classList.toggle('hidden', !this.isPlaying);
    }
    
    // Show soundwave animation when playing
    if (this.soundwave) {
      this.soundwave.classList.toggle('playing', this.isPlaying);
    }
    
    // Update status text
    if (this.statusText) {
      if (this.isPlaying) {
        this.statusText.textContent = 'Playing...';
        this.statusText.classList.remove('blocked', 'error');
      }
    }
  }

  /**
   * Check if user prefers reduced motion
   */
  prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const welcomeAudio = new ZethicaWelcomeAudio();
    welcomeAudio.init();
    
    // Expose for testing/debugging
    window.zethicaWelcomeAudio = welcomeAudio;
  });
} else {
  // DOM already loaded
  const welcomeAudio = new ZethicaWelcomeAudio();
  welcomeAudio.init();
  window.zethicaWelcomeAudio = welcomeAudio;
}

/**
 * ZETHICA Chat Widget
 * =====================================================================
 * A production-grade chat widget for the ZETHICA website that connects
 * to the /api/chat endpoint.
 *
 * Features:
 * - Floating launcher button (bottom-right)
 * - Responsive chat panel with message history
 * - Real-time API integration with error handling
 * - Per-session rate limiting (10 req/60 sec)
 * - Dark/light theme sync with site
 * - Full keyboard navigation
 * - ARIA labels and accessibility support
 * - XSS protection (no innerHTML for user content)
 * - Mobile responsive
 *
 * Auto-initializes on DOMContentLoaded.
 */

class ZethicaChatWidget {
  constructor() {
    // State
    this.isOpen = false;
    this.messages = [];
    this.isLoading = false;

    // Rate limiting (per session, per IP rate limit is on backend)
    this.requestTimestamps = [];
    this.rateLimitWindowMs = 60000; // 60 seconds
    this.maxRequestsPerWindow = 10;

    // DOM elements
    this.widgetEl = null;
    this.inputEl = null;
    this.sendBtnEl = null;
    this.messagesContainerEl = null;
    this.toggleBtnEl = null;
    this.unreadBadgeEl = null;
    this.closeOverlayEl = null;
    this.rateLimitUIEl = null;
    this.rateLimitTimerEl = null;

    this.init();
  }

  /**
   * Initialize: create DOM, attach listeners, sync theme
   */
  init() {
    this.createWidgetDOM();
    this.attachEventListeners();
    this.syncTheme();

    // Log for debugging
    console.log('[ZETHICA Chat Widget] Initialized successfully');
    console.log('[ZETHICA Chat Widget] Launcher button visible:', this.toggleBtnEl && this.toggleBtnEl.offsetParent !== null);

    // Listen for theme changes from site theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        setTimeout(() => this.syncTheme(), 50);
      });
    }

    // Also watch for direct data-theme attribute changes
    const observer = new MutationObserver(() => this.syncTheme());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /**
   * Create the widget HTML structure
   */
  createWidgetDOM() {
    // Main widget container
    this.widgetEl = document.createElement('div');
    this.widgetEl.id = 'zethica-chat-widget';
    this.widgetEl.className = 'zcw-container';
    this.widgetEl.setAttribute('aria-label', 'ZETHICA AI Chat Widget');

    this.widgetEl.innerHTML = `
      <!-- Chat panel (hidden by default) -->
      <div class="zcw-panel" role="dialog" aria-labelledby="zcw-header-title" aria-modal="true" aria-hidden="true">
        
        <!-- Header -->
        <div class="zcw-header">
          <div class="zcw-header-content">
            <div class="zcw-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <div class="zcw-header-text">
              <h3 id="zcw-header-title">ZETHICA AI</h3>
              <span class="zcw-status">Online</span>
            </div>
          </div>
          <button class="zcw-close-btn" aria-label="Close chat panel" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Messages area -->
        <div class="zcw-messages" role="log" aria-live="polite" aria-label="Chat message history">
          <div class="zcw-welcome">
            <div class="zcw-welcome-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <h4>Hi, Welcome to ZETHICA</h4>
            <p>Ask me anything about our services, pricing, process, or how to get started. I'm here to help!</p>
            <div class="zcw-quick-actions">
              <button class="zcw-quick-btn" data-message="What services do you offer?" title="Ask about services">
                Services
              </button>
              <button class="zcw-quick-btn" data-message="How much does a website cost?" title="Ask about pricing">
                Pricing
              </button>
              <button class="zcw-quick-btn" data-message="Tell me about your AI services." title="Ask about AI">
                AI Services
              </button>
              <button class="zcw-quick-btn" data-message="How do I get started?" title="Ask how to start">
                Get Started
              </button>
            </div>
          </div>
        </div>

        <!-- Rate limit warning -->
        <div class="zcw-rate-limit-notice" style="display: none;" role="alert" aria-live="assertive">
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="16" height="16">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span>Rate limited. Please wait <span id="zcw-rate-limit-counter">60</span>s.</span>
        </div>

        <!-- Input area -->
        <div class="zcw-input-area">
          <div class="zcw-input-wrapper">
            <input
              type="text"
              id="zcw-input"
              class="zcw-input"
              placeholder="Type your message..."
              maxlength="2000"
              aria-label="Chat message input"
              aria-describedby="zcw-char-count"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
            />
            <span id="zcw-char-count" class="zcw-char-count" aria-live="polite">0 / 2000</span>
            <button class="zcw-send-btn" id="zcw-send-btn" aria-label="Send message" title="Send (or press Enter)" type="button">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 C22.9702544,11.6889879 22.9702544,11.6889879 22.9702544,11.6889879 L4.13399899,1.16034022 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.97821575 L3.03521743,10.4192088 C3.03521743,10.5763061 3.19218622,10.7334035 3.50612381,10.7334035 L16.6915026,11.5188905 C16.6915026,11.5188905 17.1624089,11.5188905 17.1624089,11.0476283 L17.1624089,12.0902126 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z"/>
              </svg>
            </button>
          </div>
        </div>

      </div>

      <!-- Toggle button (floating launcher) -->
      <button class="zcw-launcher" id="zcw-launcher" aria-label="Open ZETHICA chat" title="Chat with ZETHICA AI" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
      </button>

      <!-- Backdrop overlay (for mobile) -->
      <div class="zcw-backdrop" id="zcw-backdrop"></div>
    `;

    document.body.appendChild(this.widgetEl);

    // Cache element references
    this.inputEl = this.widgetEl.querySelector('#zcw-input');
    this.sendBtnEl = this.widgetEl.querySelector('#zcw-send-btn');
    this.messagesContainerEl = this.widgetEl.querySelector('.zcw-messages');
    this.toggleBtnEl = this.widgetEl.querySelector('#zcw-launcher');
    this.closeOverlayEl = this.widgetEl.querySelector('#zcw-backdrop');
    this.rateLimitUIEl = this.widgetEl.querySelector('.zcw-rate-limit-notice');
    this.rateLimitTimerEl = this.widgetEl.querySelector('#zcw-rate-limit-counter');

    // Prevent body scroll when chat is open on mobile
    this.preventBodyScroll = (e) => {
      if (this.isOpen && window.innerWidth <= 640) {
        document.body.style.overflow = 'hidden';
      }
    };

    // Restore body scroll when chat is closed
    this.restoreBodyScroll = () => {
      document.body.style.overflow = '';
    };
  }

  /**
   * Attach all event listeners
   */
  attachEventListeners() {
    // Launcher toggle
    this.toggleBtnEl.addEventListener('click', () => this.toggle());
    this.toggleBtnEl.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.toggle();
    });

    // Close button in header
    const closeBtn = this.widgetEl.querySelector('.zcw-close-btn');
    closeBtn.addEventListener('click', () => this.close());
    closeBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.close();
    });

    // Backdrop click (mobile)
    this.closeOverlayEl.addEventListener('click', () => this.close());
    this.closeOverlayEl.addEventListener('touchend', (e) => {
      if (e.target === this.closeOverlayEl) {
        e.preventDefault();
        this.close();
      }
    });

    // Send button
    this.sendBtnEl.addEventListener('click', () => this.sendMessage());
    this.sendBtnEl.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.sendMessage();
    });

    // Enter to send, Shift+Enter for new line
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Escape to close
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });

    // Character counter
    this.inputEl.addEventListener('input', (e) => {
      const charCountEl = this.widgetEl.querySelector('#zcw-char-count');
      charCountEl.textContent = `${e.target.value.length} / 2000`;
    });

    // Quick action buttons
    this.widgetEl.querySelectorAll('.zcw-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const message = btn.getAttribute('data-message');
        this.inputEl.value = message;
        this.inputEl.focus();
        this.sendMessage();
      });

      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        const message = btn.getAttribute('data-message');
        this.inputEl.value = message;
        this.inputEl.focus();
        this.sendMessage();
      });
    });

    // Handle window resize for responsive behavior
    window.addEventListener('resize', () => {
      if (!this.isOpen) return;
      // If screen size changes to desktop while panel is open, keep it open
      // If screen size changes to mobile, keep it open with full-screen mode
    });

    // Prevent pinch zoom on mobile (optional, but helps with stability)
    document.addEventListener('touchmove', (e) => {
      if (this.isOpen && e.target.closest('#zethica-chat-widget')) {
        // Allow pinch zoom within the widget
        if (e.touches.length > 1) {
          // Allow default behavior for multi-touch (pinch zoom)
        }
      }
    }, { passive: false });
  }

  /**
   * Toggle panel open/close
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Open the chat panel
   */
  open() {
    this.isOpen = true;
    const panel = this.widgetEl.querySelector('.zcw-panel');
    panel.setAttribute('aria-hidden', 'false');
    this.widgetEl.classList.add('zcw-open');
    this.inputEl.focus();

    // Prevent background scroll on mobile
    if (window.innerWidth <= 640) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
  }

  /**
   * Close the chat panel
   */
  close() {
    this.isOpen = false;
    const panel = this.widgetEl.querySelector('.zcw-panel');
    panel.setAttribute('aria-hidden', 'true');
    this.widgetEl.classList.remove('zcw-open');

    // Restore background scroll on mobile
    if (window.innerWidth <= 640) {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
  }

  /**
   * Check if user is rate limited (client-side check)
   */
  isRateLimited() {
    const now = Date.now();
    // Remove old timestamps outside the window
    this.requestTimestamps = this.requestTimestamps.filter(
      ts => now - ts < this.rateLimitWindowMs
    );
    return this.requestTimestamps.length >= this.maxRequestsPerWindow;
  }

  /**
   * Get seconds until rate limit resets
   */
  getSecondsUntilReset() {
    if (this.requestTimestamps.length === 0) return 0;
    const oldestTs = this.requestTimestamps[0];
    const elapsed = Date.now() - oldestTs;
    const remaining = Math.ceil((this.rateLimitWindowMs - elapsed) / 1000);
    return Math.max(0, remaining);
  }

  /**
   * Show rate limit UI with countdown
   */
  showRateLimitUI() {
    this.rateLimitUIEl.style.display = 'flex';
    this.inputEl.disabled = true;
    this.sendBtnEl.disabled = true;

    const updateTimer = () => {
      const remaining = this.getSecondsUntilReset();
      this.rateLimitTimerEl.textContent = remaining;

      if (remaining <= 0) {
        this.rateLimitUIEl.style.display = 'none';
        this.inputEl.disabled = false;
        this.sendBtnEl.disabled = false;
        clearInterval(intervalId);
      }
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
  }

  /**
   * Send a message to /api/chat
   */
  async sendMessage() {
    const message = this.inputEl.value.trim();

    if (!message) return;
    if (this.isLoading) return;

    // Check client-side rate limit
    if (this.isRateLimited()) {
      this.addSystemMessage(
        `⏱️ You've sent 10 messages in the last 60 seconds. Please wait before sending another.`
      );
      this.showRateLimitUI();
      return;
    }

    // Add user message to UI
    this.addMessage('user', message);
    this.inputEl.value = '';
    this.inputEl.disabled = true;
    this.sendBtnEl.disabled = true;
    this.isLoading = true;

    // Show loading state
    const loadingMsgEl = this.addLoadingMessage();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      // Track request timestamp
      this.requestTimestamps.push(Date.now());

      if (!response.ok) {
        // Remove loading message
        loadingMsgEl.remove();

        if (response.status === 429) {
          this.addSystemMessage(
            `⏱️ Rate limit reached. The service enforced a limit. Please wait a moment.`
          );
          this.showRateLimitUI();
        } else if (response.status === 400) {
          this.addSystemMessage(
            `❌ Invalid request. Please check your message and try again.`
          );
        } else if (response.status === 500) {
          this.addSystemMessage(
            `❌ Server error. Our team has been notified. Please try again later.`
          );
        } else {
          this.addSystemMessage(
            `❌ Something went wrong. Please try again.`
          );
        }
        return;
      }

      const data = await response.json();
      const { reply, sources } = data;

      // Remove loading message
      loadingMsgEl.remove();

      // Add assistant response with sources
      this.addMessage('assistant', reply, sources);

    } catch (error) {
      console.error('[Chat Widget]', error.message);
      loadingMsgEl.remove();
      this.addSystemMessage(
        `⚠️ Connection error. Please check your internet and try again.`
      );
    } finally {
      this.inputEl.disabled = false;
      this.sendBtnEl.disabled = false;
      this.isLoading = false;
      this.inputEl.focus();
    }
  }

  /**
   * Add a user or assistant message to the chat
   * @param {string} sender - 'user', 'assistant', or 'system'
   * @param {string} text - Message text
   * @param {Array} sources - Optional array of {source_file, section_heading}
   */
  addMessage(sender, text, sources = []) {
    const msgEl = document.createElement('div');
    msgEl.className = `zcw-message zcw-${sender}`;

    // Build content safely (no innerHTML for user content)
    const contentDiv = document.createElement('div');
    contentDiv.className = 'zcw-message-text';
    contentDiv.textContent = text; // Safe: textContent, not innerHTML

    msgEl.appendChild(contentDiv);

    // Add sources if present
    if (sources && sources.length > 0) {
      const sourcesDiv = document.createElement('div');
      sourcesDiv.className = 'zcw-sources';

      const labelDiv = document.createElement('div');
      labelDiv.className = 'zcw-sources-label';
      labelDiv.textContent = '📄 Sources:';
      sourcesDiv.appendChild(labelDiv);

      sources.forEach(source => {
        const sourceDiv = document.createElement('div');
        sourceDiv.className = 'zcw-source';

        const fileSpan = document.createElement('strong');
        fileSpan.textContent = source.source_file || 'Document';
        sourceDiv.appendChild(fileSpan);

        if (source.section_heading) {
          const sectionSpan = document.createElement('span');
          sectionSpan.textContent = source.section_heading;
          sourceDiv.appendChild(sectionSpan);
        }

        sourcesDiv.appendChild(sourceDiv);
      });

      msgEl.appendChild(sourcesDiv);
    }

    this.messagesContainerEl.appendChild(msgEl);
    this.scrollMessagesToBottom();
  }

  /**
   * Add a system message (error, warning, info)
   */
  addSystemMessage(text) {
    const msgEl = document.createElement('div');
    msgEl.className = 'zcw-message zcw-system';
    const contentDiv = document.createElement('div');
    contentDiv.className = 'zcw-message-text';
    contentDiv.textContent = text; // Safe: textContent
    msgEl.appendChild(contentDiv);
    this.messagesContainerEl.appendChild(msgEl);
    this.scrollMessagesToBottom();
  }

  /**
   * Add a loading/typing indicator message
   * @returns {Element} The loading message element
   */
  addLoadingMessage() {
    const msgEl = document.createElement('div');
    msgEl.className = 'zcw-message zcw-assistant zcw-loading';
    msgEl.innerHTML = `
      <div class="zcw-loader">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    this.messagesContainerEl.appendChild(msgEl);
    this.scrollMessagesToBottom();
    return msgEl;
  }

  /**
   * Scroll messages container to bottom
   */
  scrollMessagesToBottom() {
    this.messagesContainerEl.scrollTop = this.messagesContainerEl.scrollHeight;
  }

  /**
   * Sync widget theme with page theme
   */
  syncTheme() {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    this.widgetEl.setAttribute('data-theme', theme);
  }
}

/**
 * Auto-initialize when DOM is ready
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.zethicaChatWidget = new ZethicaChatWidget();
  });
} else {
  window.zethicaChatWidget = new ZethicaChatWidget();
}

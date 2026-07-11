/* ============================================================
   ZETHICA — script.js
   ============================================================ */

'use strict';

// ─── THEME TOGGLE ─────────────────────────────────────────────────────────────
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

// Load saved theme or default to dark
const savedTheme = localStorage.getItem('zethica-theme') || 'dark';
html.setAttribute('data-theme', savedTheme);

themeToggle.addEventListener('click', () => {
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('zethica-theme', next);
});

// ─── NAVBAR SCROLL ────────────────────────────────────────────────────────────
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}, { passive: true });

// ─── MOBILE MENU ──────────────────────────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navLinks.classList.toggle('mobile-open');
});

// Close on nav link click
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('mobile-open');
  });
});

// ─── SCROLL REVEAL ────────────────────────────────────────────────────────────
const revealElements = document.querySelectorAll(
  '.service-card, .ai-card, .step, .testi-card, .about-inner, .about-pillars .pillar, .contact-inner'
);

revealElements.forEach(el => el.classList.add('reveal'));

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      const delay = entry.target.getAttribute('data-delay') || 0;
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, parseInt(delay));
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.1,
  rootMargin: '0px 0px -60px 0px'
});

revealElements.forEach(el => revealObserver.observe(el));

// ─── TOAST NOTIFICATION ───────────────────────────────────────────────────────
function showToast(message, duration = 4000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ─── CONTACT FORM — Formspree submission ─────────────────────────────────────
const contactForm = document.getElementById('contactForm');

contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const btn = contactForm.querySelector('button[type="submit"]');
  const originalText = btn.textContent;

  // Sync reply-to with email field
  document.getElementById('replyto').value = document.getElementById('email').value;

  btn.textContent = 'Sending...';
  btn.disabled = true;

  try {
    const response = await fetch(contactForm.action, {
      method: 'POST',
      body: new FormData(contactForm),
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      btn.textContent = 'Message Sent';
      btn.style.background = 'linear-gradient(135deg, #0F6E56, #13A87E)';
      showToast('Message sent. We\'ll get back to you within a few hours.');
      contactForm.reset();
    } else {
      const data = await response.json();
      const errorMsg = data?.errors?.map(e => e.message).join(', ') || 'Something went wrong.';
      btn.textContent = 'Try Again';
      btn.style.background = 'linear-gradient(135deg, #b91c1c, #dc2626)';
      showToast('Error: ' + errorMsg);
    }
  } catch (err) {
    btn.textContent = 'Try Again';
    btn.style.background = 'linear-gradient(135deg, #b91c1c, #dc2626)';
    showToast('Network error. Please try again or email us directly.');
  }

  setTimeout(() => {
    btn.textContent = originalText;
    btn.style.background = '';
    btn.disabled = false;
  }, 4000);
});

// ─── WAITLIST FORM ────────────────────────────────────────────────────────────
const waitlistForm = document.getElementById('waitlistForm');

waitlistForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const btn = waitlistForm.querySelector('button');
  const input = waitlistForm.querySelector('input');
  const originalText = btn.textContent;

  btn.textContent = 'Joining...';
  btn.disabled = true;

  setTimeout(() => {
    btn.textContent = '✓ You\'re In!';
    btn.style.background = 'linear-gradient(135deg, #059669, #10B981)';
    showToast('You\'re on the AI waitlist. We\'ll notify you first when it launches.');

    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
      btn.disabled = false;
      input.value = '';
    }, 3000);
  }, 1200);
});

// ─── ACTIVE NAV HIGHLIGHT ON SCROLL ──────────────────────────────────────────
const sections = document.querySelectorAll('section[id]');
const navItems = document.querySelectorAll('.nav-links a');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('id');
      navItems.forEach(item => {
        item.style.color = '';
        if (item.getAttribute('href') === `#${id}`) {
          item.style.color = 'var(--accent-primary)';
        }
      });
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => sectionObserver.observe(s));

// ─── SMOOTH PARALLAX ON HERO ORBS ────────────────────────────────────────────
const orbs = document.querySelectorAll('.hero-orb');

window.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 20;
  const y = (e.clientY / window.innerHeight - 0.5) * 20;

  orbs.forEach((orb, i) => {
    const factor = (i + 1) * 0.4;
    orb.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
  });
}, { passive: true });

// ─── COUNTER ANIMATION ────────────────────────────────────────────────────────
function animateCounter(el, target, suffix = '') {
  let current = 0;
  const increment = Math.ceil(target / 60);
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = current + suffix;
  }, 25);
}

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const statNums = entry.target.querySelectorAll('.stat-num');
      statNums.forEach(num => {
        const text = num.textContent;
        if (text.includes('150')) animateCounter(num, 150, '+');
        if (text.includes('50')) animateCounter(num, 50, '+');
        if (text.includes('5★')) {
          // Keep as-is
        }
      });
      statsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) statsObserver.observe(heroStats);

// ─── SERVICE CARD TILT EFFECT ─────────────────────────────────────────────────
document.querySelectorAll('.service-card, .ai-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `translateY(-6px) rotateX(${y * -5}deg) rotateY(${x * 5}deg)`;
    card.style.transition = 'transform 0.1s ease';
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
  });
});

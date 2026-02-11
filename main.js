const revealElements = document.querySelectorAll('.reveal');
const counters = document.querySelectorAll('.counter');
const glowCards = document.querySelectorAll('.glow-card');
const header = document.querySelector('.site-header');
const navLinks = Array.from(document.querySelectorAll('.site-header nav a[href^="#"]'));
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

revealElements.forEach((el) => revealObserver.observe(el));

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      const el = entry.target;
      const target = Number(el.dataset.target || 0);
      const durationMs = 1400;
      const startTs = performance.now();

      const tick = (now) => {
        const t = Math.min(1, (now - startTs) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased).toLocaleString();
        if (t < 1) {
          requestAnimationFrame(tick);
        }
      };

      requestAnimationFrame(tick);
      counterObserver.unobserve(el);
    });
  },
  { threshold: 0.55 }
);

counters.forEach((counter) => counterObserver.observe(counter));

glowCards.forEach((card) => {
  card.addEventListener('pointermove', (event) => {
    const rect = card.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mx', `${x}%`);
    card.style.setProperty('--my', `${y}%`);
  });

  card.addEventListener('pointerleave', () => {
    card.style.setProperty('--mx', '50%');
    card.style.setProperty('--my', '50%');
  });
});

const updateActiveNav = () => {
  const scrollY = window.scrollY + window.innerHeight * 0.35;
  let activeId = '';

  sections.forEach((section) => {
    if (scrollY >= section.offsetTop) {
      activeId = section.id;
    }
  });

  navLinks.forEach((link) => {
    const id = link.getAttribute('href').slice(1);
    link.classList.toggle('active', id === activeId);
  });
};

const onScroll = () => {
  if (header) {
    header.classList.toggle('scrolled', window.scrollY > 24);
  }
  updateActiveNav();
};

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', updateActiveNav);
updateActiveNav();
onScroll();

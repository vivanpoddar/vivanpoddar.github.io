const header = document.querySelector('.site-header');
const navLinks = Array.from(document.querySelectorAll('.site-header nav a[href^="#"]'));
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

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

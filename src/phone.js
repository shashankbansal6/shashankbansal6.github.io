// On a phone nothing may scroll inside the page's own scroll: a card that is short enough stays pinned over the
// scene, a card that is taller than most of the screen is let go and scrolls past with the page instead.
export function fitCards(mobile, els) {
  els.forEach((el) => el.classList.toggle('flow', mobile && el.offsetHeight > innerHeight * 0.7));
}

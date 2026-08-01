// beacon2026/frontend/src/utils/backgroundTime.js
// Sets html[data-daytime] to "day" (06:00-18:00 local time) or "night",
// driving the light-day.png / light-night.png page background in index.css.

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

function currentDaytime() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? 'day' : 'night';
}

export function startBackgroundTimeUpdater() {
  const apply = () => {
    document.documentElement.setAttribute('data-daytime', currentDaytime());
  };
  apply();
  const id = setInterval(apply, CHECK_INTERVAL_MS);
  return () => clearInterval(id);
}

import { t } from "./i18n.js";
const themes = {
  lagoon: "监控台原版",
  dune: "沙海驿站",
  coral: "珊瑚轨道",
  oasis: "绿洲档案",
  dusk: "暮色电台",
};
const picker = document.getElementById("theme");
const ids = Object.keys(themes);
const coin = document.createElement("span");
coin.className = "theme-coin";
coin.setAttribute("aria-hidden", "true");
const faces = ["front", "back"].map((side) => {
  const face = document.createElement("span");
  face.className = "coin-face " + side;
  coin.append(face);
  return face;
});
picker.replaceChildren(coin);
let turns = 0;
function applyTheme(id, flip = false) {
  const theme = Object.hasOwn(themes, id) ? id : "lagoon";
  document.documentElement.dataset.theme = theme;
  picker.dataset.i18nTitle = themes[theme];
  picker.dataset.i18nAriaLabel = themes[theme];
  picker.title = t(themes[theme]);
  picker.setAttribute("aria-label", t(themes[theme]));
  const color = getComputedStyle(document.documentElement)
    .getPropertyValue("--action")
    .trim();
  if (flip) {
    turns++;
    faces[turns % 2].style.backgroundColor = color;
    coin.style.transform = `rotateY(${turns * 180}deg)`;
  } else {
    faces.forEach((face) => (face.style.backgroundColor = color));
  }
  try {
    localStorage.setItem("experiment-map:theme", theme);
  } catch {}
}
applyTheme(document.documentElement.dataset.theme);
picker.addEventListener("click", () => {
  applyTheme(
    ids[(ids.indexOf(document.documentElement.dataset.theme) + 1) % ids.length],
    true,
  );
});

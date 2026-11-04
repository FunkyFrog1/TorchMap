const $ = (id) => document.getElementById(id);
const menus = [...document.querySelectorAll(".toolbar-menu")];
for (const menu of menus) {
  menu.addEventListener("toggle", () => {
    if (menu.open)
      for (const other of menus) if (other !== menu) other.open = false;
  });
  menu.addEventListener("click", (event) => {
    if (event.target.closest("button")) menu.open = false;
  });
}
document.addEventListener("click", (event) => {
  for (const menu of menus) if (!menu.contains(event.target)) menu.open = false;
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") for (const menu of menus) menu.open = false;
});

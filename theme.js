const themeKey = "portfolio-theme";
const root = document.documentElement;
const themeToggle = document.querySelector("#theme-toggle");

function setTheme(theme) {
    root.dataset.theme = theme;
    const nextTheme = theme === "light" ? "dark" : "light";
    themeToggle.textContent = `${nextTheme[0].toUpperCase()}${nextTheme.slice(1)} theme`;
    themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
}

try {
    const savedTheme = localStorage.getItem(themeKey);
    if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
    }
} catch (error) {
    console.warn("Unable to read the saved theme preference.", error);
}

themeToggle.addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
    setTheme(nextTheme);

    try {
        localStorage.setItem(themeKey, nextTheme);
    } catch (error) {
        console.warn("Unable to save the theme preference.", error);
    }
});

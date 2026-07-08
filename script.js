const chapterFiles = [
  "01-mezze-saser-tillbehor.md",
  "02-spett-kebab.md",
  "03-grillen.md",
  "04-havet.md",
  "05-mackor-burgare-gatumat.md",
  "06-husman-soder-beirut.md",
  "07-pizza-pasta-vardag.md",
  "08-fest-jul-nyar.md",
  "09-sott-drinkar.md"
];

const state = {
  chapters: [],
  recipes: [],
  selectedChapter: 0,
  selectedRecipe: null,
  query: "",
  filter: "all"
};

const els = {
  chapterCount: document.querySelector("#chapterCount"),
  recipeCount: document.querySelector("#recipeCount"),
  chapterList: document.querySelector("#chapterList"),
  chapterReader: document.querySelector("#chapterReader"),
  recipeList: document.querySelector("#recipeList"),
  visibleRecipeCount: document.querySelector("#visibleRecipeCount"),
  search: document.querySelector("#recipeSearch"),
  filterGroup: document.querySelector(".filter-group"),
  emptyState: document.querySelector("#emptyState"),
  clearSearch: document.querySelector("#clearSearch"),
  chapterRail: document.querySelector("#chapterRail"),
  toggleIndex: document.querySelector("#toggleIndex"),
  closeIndex: document.querySelector("#closeIndex")
};

async function init() {
  bindEvents();
  renderLoading();

  try {
    const chapters = await Promise.all(
      chapterFiles.map(async (file, index) => {
        const response = await fetch(`chapters/${file}`);
        if (!response.ok) {
          throw new Error(`Could not load chapters/${file}`);
        }
        return parseChapter(await response.text(), file, index);
      })
    );

    state.chapters = chapters;
    state.recipes = chapters.flatMap((chapter) => chapter.recipes);
    state.selectedChapter = 0;
    state.selectedRecipe = chapters[0]?.recipes[0]?.id || null;
    render();
  } catch (error) {
    renderError(error);
  }
}

function bindEvents() {
  els.search.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    state.selectedRecipe = null;
    renderRecipeIndex();
  });

  els.filterGroup.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    document.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.filter === state.filter);
    });
    renderRecipeIndex();
  });

  els.clearSearch.addEventListener("click", () => {
    state.query = "";
    els.search.value = "";
    state.filter = "all";
    document.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.filter === "all");
    });
    renderRecipeIndex();
    els.search.focus();
  });

  els.toggleIndex.addEventListener("click", () => {
    const open = els.chapterRail.classList.toggle("open");
    els.toggleIndex.setAttribute("aria-expanded", String(open));
  });

  els.closeIndex.addEventListener("click", closeChapterRail);
}

function parseChapter(markdown, file, index) {
  const lines = markdown.split(/\r?\n/);
  const titleLine = lines.find((line) => line.startsWith("# ")) || `# Kapitel ${index + 1}`;
  const title = titleLine.replace(/^#\s+/, "").trim();
  const numberMatch = title.match(/Kapitel\s+(\d+)/i);
  const number = numberMatch ? Number(numberMatch[1]) : index + 1;
  const shortTitle = title.replace(/^Kapitel\s+\d+:\s*/i, "");
  const intro = findIntro(lines);
  const families = parseFamilies(lines);
  const recipes = parseRecipes(lines).map((recipe, recipeIndex) => ({
    ...recipe,
    id: `${file.replace(".md", "")}-${recipeIndex}`,
    chapterFile: file,
    chapterIndex: index,
    chapterNumber: number,
    chapterTitle: shortTitle
  }));

  return {
    file,
    number,
    title,
    shortTitle,
    intro,
    families,
    recipes
  };
}

function findIntro(lines) {
  for (const line of lines) {
    const clean = line.trim();
    if (!clean || clean.startsWith("#") || clean.startsWith(">")) continue;
    return stripMarkdown(clean);
  }
  return "Kapitlet saknar introtext i draften.";
}

function parseFamilies(lines) {
  const families = [];
  let inFamilies = false;

  for (const line of lines) {
    if (line.startsWith("## Receptfamiljer")) {
      inFamilies = true;
      continue;
    }
    if (inFamilies && line.startsWith("## ")) break;
    if (!inFamilies) continue;

  const match = line.match(/^\*\*(.+?)\*\*\s+\u2014\s+(.+)$/);
    if (match) {
      families.push({
        title: stripMarkdown(match[1]),
        description: stripMarkdown(match[2])
      });
    }
  }

  return families.slice(0, 4);
}

function parseRecipes(lines) {
  const recipes = [];
  let inRecipes = false;

  for (const line of lines) {
    if (line.trim() === "## Recept") {
      inRecipes = true;
      continue;
    }
    if (inRecipes && line.startsWith("## ")) break;
    if (!inRecipes || !line.trim().startsWith("- **[")) continue;

    const recipe = parseRecipeLine(line.trim());
    if (recipe) recipes.push(recipe);
  }

  return recipes;
}

function parseRecipeLine(line) {
  const match = line.match(/^- \*\*\[(.+?)\]\((.+?)\)\*\*\s+\u2014\s+(.+)$/);
  if (!match) return null;

  const [, title, href, rest] = match;
  const videoMatch = rest.match(/\*\(video:\s*(.+?)\)\*/i);
  const flagMatches = [...rest.matchAll(/\*\*\[(.+?)\]\*\*/g)].map((item) => stripMarkdown(item[1]));
  const description = rest
    .replace(/\*\(video:\s*.+?\)\*/i, "")
    .replace(/\*\*\[.+?\]\*\*/g, "")
    .trim();

  return {
    title: stripMarkdown(title),
    href,
    description: stripMarkdown(description),
    video: videoMatch ? stripMarkdown(videoMatch[1]) : "",
    flags: flagMatches
  };
}

function render() {
  els.chapterCount.textContent = `${state.chapters.length} kapitel`;
  els.recipeCount.textContent = `${state.recipes.length} recept från draften`;
  renderChapterList();
  renderChapter();
  renderRecipeIndex();
}

function renderChapterList() {
  els.chapterList.innerHTML = state.chapters
    .map((chapter, index) => {
      const active = index === state.selectedChapter ? " active" : "";
      return `
        <button class="chapter-button${active}" type="button" data-chapter="${index}">
          <span class="chapter-number">Kapitel ${chapter.number}</span>
          <span class="chapter-title">${escapeHtml(chapter.shortTitle)}</span>
        </button>
      `;
    })
    .join("");

  els.chapterList.querySelectorAll("[data-chapter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedChapter = Number(button.dataset.chapter);
      state.selectedRecipe = state.chapters[state.selectedChapter]?.recipes[0]?.id || null;
      renderChapterList();
      renderChapter();
      renderRecipeIndex();
      closeChapterRail();
      els.chapterReader.focus({ preventScroll: true });
    });
  });
}

function renderChapter() {
  const chapter = state.chapters[state.selectedChapter];
  if (!chapter) return;

  const flagCount = chapter.recipes.reduce((total, recipe) => total + recipe.flags.length, 0);
  const families = chapter.families.length
    ? `
      <div class="chapter-divider">
        <span></span>
        <strong>Receptfamiljer</strong>
      </div>
      <div class="family-list">
        ${chapter.families
          .map(
            (family) => `
              <section class="family-card">
                <h3>${escapeHtml(family.title)}</h3>
                <p>${escapeHtml(family.description)}</p>
              </section>
            `
          )
          .join("")}
      </div>
    `
    : "";

  const featured = chapter.recipes.slice(0, 3);

  els.chapterReader.innerHTML = `
    <div class="chapter-meta">
      <span class="source-note">${escapeHtml(chapter.file)}</span>
      <span>${chapter.recipes.length} recept</span>
      ${flagCount ? `<span class="status-note">${flagCount} redaktionella markorer</span>` : ""}
    </div>
    <h2>${escapeHtml(chapter.shortTitle)}</h2>
    <p class="chapter-intro">${escapeHtml(chapter.intro)}</p>
    ${families}
    <div class="chapter-divider">
      <span></span>
      <strong>Utvalda recept</strong>
    </div>
    <div class="featured-recipes">
      ${featured
        .map(
          (recipe) => `
            <section class="featured-recipe">
              <h3>${escapeHtml(recipe.title)}</h3>
              <p>${escapeHtml(recipe.description)}</p>
              ${recipe.video ? `<p class="source-note">video: ${escapeHtml(recipe.video)}</p>` : ""}
            </section>
          `
        )
        .join("")}
    </div>
  `;
}

function renderRecipeIndex() {
  const recipes = getVisibleRecipes();
  els.visibleRecipeCount.textContent = recipes.length;
  els.emptyState.hidden = recipes.length > 0;

  els.recipeList.innerHTML = recipes
    .map((recipe) => {
      const active = recipe.id === state.selectedRecipe ? " active" : "";
      return `
        <button class="recipe-card${active}" type="button" data-recipe="${escapeHtml(recipe.id)}">
          <strong>${escapeHtml(recipe.title)}</strong>
          <p>${escapeHtml(recipe.description)}</p>
          <span class="recipe-meta">
            <span>Kapitel ${recipe.chapterNumber}</span>
            ${recipe.video ? "<span>video</span>" : ""}
          </span>
          ${recipe.flags.map((flag) => `<span class="recipe-flag">${escapeHtml(flag)}</span>`).join("")}
        </button>
      `;
    })
    .join("");

  els.recipeList.querySelectorAll("[data-recipe]").forEach((button) => {
    button.addEventListener("click", () => {
      const recipe = state.recipes.find((item) => item.id === button.dataset.recipe);
      if (!recipe) return;
      state.selectedRecipe = recipe.id;
      state.selectedChapter = recipe.chapterIndex;
      renderChapterList();
      renderChapter();
      renderRecipeIndex();
      els.chapterReader.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function getVisibleRecipes() {
  return state.recipes.filter((recipe) => {
    const queryText = [
      recipe.title,
      recipe.description,
      recipe.video,
      recipe.chapterTitle,
      recipe.flags.join(" ")
    ]
      .join(" ")
      .toLowerCase();

    const matchesQuery = !state.query || queryText.includes(state.query);
    const matchesFilter =
      state.filter === "all" ||
      (state.filter === "flagged" && recipe.flags.length > 0) ||
      (state.filter === "video" && recipe.video);

    return matchesQuery && matchesFilter;
  });
}

function renderLoading() {
  els.chapterReader.innerHTML = `
    <div class="chapter-meta"><span class="source-note">Laddar</span></div>
    <h2>Kokboken oppnas</h2>
    <p class="chapter-intro">Vi hämtar kapitelutkasten från <code>cookbook/chapters/</code>.</p>
  `;
}

function renderError(error) {
  els.recipeCount.textContent = "Kapitlen kunde inte laddas";
  els.chapterReader.innerHTML = `
    <div class="chapter-meta"><span class="status-note">Fel vid laddning</span></div>
    <h2>Kunde inte läsa draftkapitlen</h2>
    <p class="chapter-intro">${escapeHtml(error.message)}</p>
    <p class="chapter-intro">Starta sidan via en lokal webbserver så att webbläsaren får hämta Markdown-filerna.</p>
  `;
  els.emptyState.hidden = false;
}

function closeChapterRail() {
  els.chapterRail.classList.remove("open");
  els.toggleIndex.setAttribute("aria-expanded", "false");
}

function stripMarkdown(value) {
  return value
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

init();

const STORAGE_KEY = "xhs-content-organizer-state-v2";

const defaultRules = [
  { name: "绘画", keywords: ["绘画", "画画", "插画", "速写", "水彩", "油画", "板绘", "临摹", "构图", "色彩"] },
  { name: "书单", keywords: ["书单", "读书", "小说", "文学", "阅读", "书摘", "作者", "出版社", "推荐书"] },
  { name: "语言学习", keywords: ["英语", "日语", "韩语", "法语", "语言", "背单词", "口语", "听力", "语法", "雅思", "托福"] },
  { name: "美食", keywords: ["美食", "食谱", "做饭", "烘焙", "探店", "餐厅", "咖啡", "甜品", "菜谱", "减脂餐"] },
  { name: "穿搭", keywords: ["穿搭", "ootd", "搭配", "显瘦", "通勤", "妆容", "护肤", "发型"] },
  { name: "旅行", keywords: ["旅行", "攻略", "酒店", "路线", "景点", "城市", "机票", "签证"] },
  { name: "学习效率", keywords: ["学习", "笔记", "效率", "复习", "考试", "规划", "自律", "课程"] },
  { name: "其他", keywords: [] },
];

const sampleNotes = [
  {
    title: "新手水彩花朵练习：三步控制晕染边缘",
    content:
      "先用清水铺底，再用低饱和粉色从花心向外点染。重点是等纸面半干时补阴影，边缘会自然柔和。适合刚开始画水彩的人练习控水和配色。",
    author: "小周画画",
    source: "收藏",
    link: "https://www.xiaohongshu.com/explore/watercolor-demo",
    tags: ["水彩", "绘画", "新手"],
  },
  {
    title: "今年读完最想推荐的 8 本书",
    content: "书单偏文学和非虚构，包括女性成长、城市观察和心理学入门。每本都附了适合人群和阅读节奏，通勤每天 30 分钟也能读完。",
    author: "夜读手账",
    source: "点赞",
    link: "https://www.xiaohongshu.com/explore/book-list-8",
    tags: ["读书", "书单"],
  },
  {
    title: "英语听力从零到稳定输入的周计划",
    content: "第一周只做精听短音频，第二周加入影子跟读，第三周开始记录生词和句型。核心是每天固定 20 分钟，不追求一次听懂全部。",
    author: "语言学习阿远",
    source: "收藏",
    link: "https://www.xiaohongshu.com/explore/english-listening-plan",
    tags: ["英语", "听力", "学习"],
  },
  {
    title: "周末空气炸锅低油晚餐",
    content: "鸡腿肉提前用生抽、黑胡椒和蒜末腌 20 分钟，180 度烤 15 分钟后翻面。搭配南瓜和蘑菇，适合想省时间又想吃热饭的时候。",
    author: "厨房记录本",
    source: "笔记",
    link: "https://www.xiaohongshu.com/explore/air-fryer-dinner",
    tags: ["美食", "菜谱"],
  },
];

let rules = structuredClone(defaultRules);
let notes = [];
let activeCategory = "全部";
let selectedId = null;
let activeView = "notesView";

const els = {
  fileInput: document.querySelector("#fileInput"),
  loadSample: document.querySelector("#loadSample"),
  rulesList: document.querySelector("#rulesList"),
  addRule: document.querySelector("#addRule"),
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  exportJson: document.querySelector("#exportJson"),
  categoryTabs: document.querySelector("#categoryTabs"),
  notesList: document.querySelector("#notesList"),
  detailPane: document.querySelector("#detailPane"),
  totalCount: document.querySelector("#totalCount"),
  categoryCount: document.querySelector("#categoryCount"),
  linkCount: document.querySelector("#linkCount"),
  visibleCount: document.querySelector("#visibleCount"),
  views: document.querySelectorAll(".view"),
  bottomTabs: document.querySelectorAll(".bottom-tab"),
};

function normalizeText(value) {
  return String(value || "").trim();
}

function splitKeywords(value) {
  return normalizeText(value)
    .split(/[，,、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function findUrl(text) {
  const match = normalizeText(text).match(/https?:\/\/[^\s'"<>]+/i);
  return match ? match[0] : "";
}

function summarize(text, maxLength = 92) {
  const clean = normalizeText(text).replace(/\s+/g, " ");
  if (!clean) return "暂无正文，建议补充标题、正文或作者备注后重新分类。";
  const sentence = clean.split(/[。！？!?]/).find((part) => part.length >= 12) || clean;
  return sentence.length > maxLength ? `${sentence.slice(0, maxLength)}...` : sentence;
}

function scoreSentence(sentence) {
  let score = sentence.length > 18 ? 2 : 0;
  if (/[0-9一二三四五六七八九十]+[.、步个本天周月]/.test(sentence)) score += 3;
  if (/(方法|清单|步骤|推荐|避雷|经验|教程|攻略|重点|核心|总结)/.test(sentence)) score += 4;
  if (/(收藏|点赞|适合|新手|入门|进阶|模板|链接)/.test(sentence)) score += 2;
  return score;
}

function extractKeyPoints(note) {
  const text = `${note.title}。${note.content}`.replace(/\s+/g, " ");
  const sentences = text
    .split(/[。！？!?\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8);
  return sentences.sort((a, b) => scoreSentence(b) - scoreSentence(a)).slice(0, 4);
}

function categorize(note) {
  const haystack = `${note.title} ${note.content} ${note.author} ${note.tags.join(" ")}`.toLowerCase();
  const scored = rules
    .filter((rule) => rule.name !== "其他")
    .map((rule) => {
      const hits = rule.keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
      return { name: rule.name, hits, score: hits.length };
    })
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  return best && best.score > 0
    ? { category: best.name, matchedKeywords: best.hits, confidence: Math.min(99, 56 + best.score * 12) }
    : { category: "其他", matchedKeywords: [], confidence: 42 };
}

function normalizeNote(raw, index) {
  const title = normalizeText(raw.title || raw.标题 || raw.name || raw.noteTitle || `未命名内容 ${index + 1}`);
  const content = normalizeText(raw.content || raw.正文 || raw.desc || raw.description || raw.text || raw.note || "");
  const link = normalizeText(raw.link || raw.url || raw.href || raw.链接 || findUrl(`${title} ${content}`));
  const author = normalizeText(raw.author || raw.作者 || raw.user || raw.nickname || "未知作者");
  const source = normalizeText(raw.source || raw.type || raw.来源 || raw.status || "笔记");
  const tagsValue = raw.tags || raw.标签 || raw.keywords || [];
  const tags = Array.isArray(tagsValue) ? tagsValue.map(normalizeText).filter(Boolean) : splitKeywords(tagsValue);
  const note = {
    id: raw.id || raw.noteId || raw.note_id || `note-${Date.now()}-${index}`,
    title,
    content,
    link,
    author,
    source: source.includes("赞") ? "点赞" : source.includes("藏") ? "收藏" : source,
    tags,
    createdAt: normalizeText(raw.createdAt || raw.date || raw.time || raw.时间 || ""),
  };
  const classified = categorize(note);
  return {
    ...note,
    ...classified,
    summary: summarize(content || title),
    keyPoints: extractKeyPoints(note),
  };
}

function parseCsv(text) {
  const rows = [];
  let cell = "";
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((item) => item.trim())) rows.push(row);
  const headers = rows.shift()?.map((item) => item.trim()) || [];
  return rows.map((cells) =>
    headers.reduce((record, header, idx) => {
      record[header] = cells[idx] || "";
      return record;
    }, {}),
  );
}

function parseTxt(text) {
  return text
    .split(/\n{2,}/)
    .map((block, index) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (!lines.length) return null;
      return {
        title: lines[0].replace(findUrl(lines[0]), "").trim() || `链接内容 ${index + 1}`,
        content: lines.slice(1).join(" "),
        link: findUrl(block),
      };
    })
    .filter(Boolean);
}

function parseInput(text, fileName = "") {
  if (/\.csv$/i.test(fileName)) return parseCsv(text);
  if (/\.json$/i.test(fileName)) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : parsed.items || parsed.notes || parsed.data || [];
  }
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : parsed.items || parsed.notes || parsed.data || [];
  } catch {
    return parseTxt(text);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ rules, notes, activeCategory, selectedId }));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return;
    rules = Array.isArray(saved.rules) ? saved.rules : rules;
    notes = Array.isArray(saved.notes) ? saved.notes : notes;
    activeCategory = saved.activeCategory || activeCategory;
    selectedId = saved.selectedId || selectedId;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function reclassifyAll() {
  notes = notes.map((note) => {
    const classified = categorize(note);
    return {
      ...note,
      ...classified,
      summary: summarize(note.content || note.title),
      keyPoints: extractKeyPoints(note),
    };
  });
  saveState();
  render();
}

function getCategories() {
  return [...new Set(["全部", ...rules.map((rule) => rule.name)])];
}

function getFilteredNotes() {
  const query = els.searchInput.value.trim().toLowerCase();
  const filterCategory = els.categoryFilter.value || "全部";
  const status = els.statusFilter.value;
  return notes.filter((note) => {
    const categoryOk = activeCategory === "全部" || note.category === activeCategory;
    const dropdownOk = filterCategory === "全部" || note.category === filterCategory;
    const statusOk = status === "all" || note.source === status;
    const queryOk =
      !query ||
      [note.title, note.content, note.summary, note.author, note.link, note.category, note.tags.join(" "), note.matchedKeywords.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(query);
    return categoryOk && dropdownOk && statusOk && queryOk;
  });
}

function renderRules() {
  els.rulesList.innerHTML = "";
  const template = document.querySelector("#ruleTemplate");
  rules.forEach((rule, index) => {
    const node = template.content.cloneNode(true);
    const nameInput = node.querySelector(".rule-name");
    const keywordInput = node.querySelector(".rule-keywords");
    nameInput.value = rule.name;
    keywordInput.value = rule.keywords.join("，");
    nameInput.addEventListener("change", () => {
      rules[index].name = nameInput.value.trim() || rule.name;
      reclassifyAll();
    });
    keywordInput.addEventListener("change", () => {
      rules[index].keywords = splitKeywords(keywordInput.value);
      reclassifyAll();
    });
    els.rulesList.appendChild(node);
  });
}

function renderFilters() {
  const current = els.categoryFilter.value || activeCategory;
  els.categoryFilter.innerHTML = getCategories()
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");
  els.categoryFilter.value = getCategories().includes(current) ? current : "全部";
}

function renderTabs() {
  const counts = notes.reduce((acc, note) => {
    acc[note.category] = (acc[note.category] || 0) + 1;
    return acc;
  }, {});
  els.categoryTabs.innerHTML = getCategories()
    .map((name) => {
      const count = name === "全部" ? notes.length : counts[name] || 0;
      return `<button class="tag-button ${activeCategory === name ? "active" : ""}" type="button" data-category="${escapeHtml(name)}"><span>${escapeHtml(name)}</span><span>${count}</span></button>`;
    })
    .join("");
  els.categoryTabs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category;
      els.categoryFilter.value = activeCategory;
      saveState();
      render();
    });
  });
}

function sourceClass(source) {
  if (source === "收藏") return "favorite";
  if (source === "点赞") return "like";
  return "note";
}

function renderNotes() {
  const filtered = getFilteredNotes();
  els.visibleCount.textContent = filtered.length;
  if (!filtered.length) {
    els.notesList.innerHTML = '<div class="empty-list">没有匹配结果</div>';
    renderDetail(null);
    return;
  }
  if (!filtered.some((note) => note.id === selectedId)) selectedId = filtered[0].id;
  els.notesList.innerHTML = filtered
    .map(
      (note) => `
      <button class="note-item ${selectedId === note.id ? "active" : ""}" type="button" data-id="${escapeHtml(note.id)}">
        <div>
          <div class="meta-line">
            <span class="pill ${sourceClass(note.source)}">${escapeHtml(note.source)}</span>
            <span class="pill">${escapeHtml(note.category)}</span>
            <span class="confidence">${note.confidence}% 匹配</span>
          </div>
          <h3>${escapeHtml(note.title)}</h3>
          <p>${escapeHtml(note.summary)}</p>
        </div>
        <span class="confidence">${note.link ? "可跳转" : "无链接"}</span>
      </button>`,
    )
    .join("");
  els.notesList.querySelectorAll(".note-item").forEach((button) => {
    button.addEventListener("click", () => {
      selectedId = button.dataset.id;
      activeView = "detailView";
      saveState();
      render();
      setView("detailView");
    });
  });
  renderDetail(notes.find((note) => note.id === selectedId));
}

function renderDetail(note) {
  if (!note) {
    els.detailPane.innerHTML = '<div class="empty-detail"><span aria-hidden="true">⌁</span><p>选择一篇内容查看核心信息</p></div>';
    return;
  }
  els.detailPane.innerHTML = `
    <h2>${escapeHtml(note.title)}</h2>
    <div class="detail-meta">
      <span class="pill ${sourceClass(note.source)}">${escapeHtml(note.source)}</span>
      <span class="pill">${escapeHtml(note.category)}</span>
      <span class="pill">${escapeHtml(note.author)}</span>
      ${note.createdAt ? `<span class="pill">${escapeHtml(note.createdAt)}</span>` : ""}
    </div>
    <div class="detail-block">
      <h3>核心摘要</h3>
      <p>${escapeHtml(note.summary)}</p>
    </div>
    <div class="detail-block">
      <h3>要点</h3>
      <ul>${(note.keyPoints.length ? note.keyPoints : [note.content || note.title]).map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>
    </div>
    <div class="detail-block">
      <h3>命中关键词</h3>
      <div class="chips">${(note.matchedKeywords.length ? note.matchedKeywords : ["暂无"]).map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}</div>
    </div>
    <div class="detail-block">
      <h3>原文链接</h3>
      <p>${note.link ? escapeHtml(note.link) : "未导入链接"}</p>
    </div>
    ${note.link ? `<a class="open-link" href="${escapeAttribute(note.link)}" target="_blank" rel="noreferrer">打开小红书原帖</a>` : ""}
  `;
}

function renderMetrics() {
  els.totalCount.textContent = notes.length;
  els.categoryCount.textContent = new Set(notes.map((note) => note.category)).size;
  els.linkCount.textContent = notes.filter((note) => note.link).length;
}

function setView(viewId) {
  activeView = viewId;
  els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  els.bottomTabs.forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
}

function render() {
  renderFilters();
  renderTabs();
  renderMetrics();
  renderNotes();
  renderRules();
  setView(activeView);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

async function loadTextFile(file) {
  const text = await file.text();
  const parsed = parseInput(text, file.name);
  notes = parsed.map(normalizeNote);
  selectedId = notes[0]?.id || null;
  activeCategory = "全部";
  activeView = "notesView";
  saveState();
  render();
}

function downloadJson() {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), rules, notes }, null, 2);
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "xhs-content-organized.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {
    // file:// 打开时无法注册，放到 HTTPS 或 localhost 后会自动可用。
  });
}

els.fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) loadTextFile(file);
});

els.loadSample.addEventListener("click", () => {
  notes = sampleNotes.map(normalizeNote);
  selectedId = notes[0]?.id || null;
  activeCategory = "全部";
  activeView = "notesView";
  saveState();
  render();
});

els.addRule.addEventListener("click", () => {
  rules.splice(rules.length - 1, 0, { name: "新分类", keywords: ["关键词"] });
  saveState();
  render();
  setView("rulesView");
});

els.searchInput.addEventListener("input", renderNotes);
els.categoryFilter.addEventListener("change", () => {
  activeCategory = els.categoryFilter.value;
  saveState();
  render();
});
els.statusFilter.addEventListener("change", renderNotes);
els.exportJson.addEventListener("click", downloadJson);
els.bottomTabs.forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));

loadState();
render();
registerServiceWorker();

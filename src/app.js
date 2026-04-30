(() => {
  const { useMemo, useState } = React;
  const h = React.createElement;
  const data = window.ASP_DATA;

  const icons = {
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    folder: "M3 6h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M8 12v4 M12 12v2 M16 12v5",
    calendar: "M7 2v4 M17 2v4 M3 9h18 M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2",
    book: "M12 7v14 M3 5a3 3 0 0 1 3-3h6v19H6a3 3 0 0 0-3 3z M21 5a3 3 0 0 0-3-3h-6v19h6a3 3 0 0 1 3 3z",
    users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.8",
    award: "M12 15a6 6 0 1 0 0-12a6 6 0 0 0 0 12 M8.5 14.5 7 22l5-3 5 3-1.5-7.5",
    settings: "M12 15.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7 M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.5-.2-.1a1.7 1.7 0 0 0-1.9.3l-.2.1-3.5-2-.1-.3a1.7 1.7 0 0 0-1.7 0l-.1.3-3.5 2-.2-.1a1.7 1.7 0 0 0-1.9-.3l-.2.1-2-3.5.1-.1A1.7 1.7 0 0 0 4.6 15v-.2L1 12.7V9.3l3.6-2.1V7a1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.5.2.1a1.7 1.7 0 0 0 1.9-.3l.2-.1 3.5 2 .1.3a1.7 1.7 0 0 0 1.7 0l.1-.3 3.5-2 .2.1a1.7 1.7 0 0 0 1.9.3l.2-.1 2 3.5-.1.1a1.7 1.7 0 0 0-.3 1.9v.2L23 9.3v3.4L19.4 15z",
    search: "M21 21l-4.3-4.3 M10.5 18a7.5 7.5 0 1 1 0-15a7.5 7.5 0 0 1 0 15",
    plus: "M12 5v14 M5 12h14",
    github: "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.1-1.3-.3-2.5-1-3.5.3-1.2.3-2.4 0-3.5 0 0-1 0-3 1.5a12 12 0 0 0-8 0C6 2 5 2 5 2c-.3 1.1-.3 2.3 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.4.5-.7 1.1-.8 1.8-.2.6-.2 1.2-.2 1.7v4",
    info: "M12 16v-4 M12 8h.01 M12 22a10 10 0 1 0 0-20a10 10 0 0 0 0 20",
    megaphone: "M3 11v3a2 2 0 0 0 2 2h2l4 4v-4l8-3V6l-8-3v4H5a2 2 0 0 0-2 2v2z",
    userPlus: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8 M20 8v6 M17 11h6",
    file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8 M8 9h2",
    layers: "M12 2 2 7l10 5 10-5-10-5z M2 12l10 5 10-5 M2 17l10 5 10-5",
    chart: "M4 19V5 M4 19h16 M8 16v-5 M12 16V8 M16 16v-8",
    user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8",
    x: "M18 6 6 18 M6 6l12 12",
  };

  const pageMeta = {
    dashboard: ["section_mockA", "title_mockA", "description_mockA"],
    about: ["section_mockB", "title_mockB", "description_mockB"],
    notice: ["section_mockC", "title_mockC", "description_mockC"],
    recruit: ["section_mockD", "title_mockD", "description_mockD"],
    squad: ["section_mockE", "title_mockE", "description_mockE"],
    projects: ["section_mockF", "title_mockF", "description_mockF"],
    events: ["section_mockG", "title_mockG", "description_mockG"],
    blog: ["section_mockH", "title_mockH", "description_mockH"],
    seasons: ["section_mockI", "title_mockI", "description_mockI"],
    leaderboard: ["section_mockJ", "title_mockJ", "description_mockJ"],
    achievements: ["section_mockK", "title_mockK", "description_mockK"],
    wiki: ["section_mockL", "title_mockL", "description_mockL"],
    profile: ["section_mockM", "title_mockM", "description_mockM"],
    admin: ["section_mockN", "title_mockN", "description_mockN"],
  };

  function Icon({ name }) {
    const pathData = icons[name] || icons.grid;
    return h(
      "svg",
      { className: "icon", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
      pathData.split(" M").map((path, index) => h("path", { key: index, d: index === 0 ? path : `M${path}` })),
    );
  }

  function includesQuery(item, query) {
    if (!query) return true;
    return JSON.stringify(item).toLowerCase().includes(query.toLowerCase());
  }

  function PageHeader({ page, onAction }) {
    const [section, title, description] = pageMeta[page] || pageMeta.dashboard;
    return h(
      "section",
      { className: "page-header" },
      h("div", null, h("span", { className: "eyebrow" }, section), h("h2", null, title), h("p", null, description)),
      h("button", { className: "primary", onClick: () => onAction("modal", `${page}_action_mockA`) }, h(Icon, { name: "plus" }), "button_mockA"),
    );
  }

  function Sidebar({ active, setActive }) {
    return h(
      "aside",
      { className: "sidebar" },
      h("button", { className: "brand", onClick: () => setActive("dashboard") }, h("span", null, h(Icon, { name: "github" })), h("strong", null, data.team.name)),
      h(
        "nav",
        null,
        data.nav.map((item) =>
          h(
            "button",
            { key: item.id, className: item.id === active ? "active" : "", onClick: () => setActive(item.id) },
            h(Icon, { name: item.icon }),
            h("span", null, item.label),
          ),
        ),
      ),
      h("section", { className: "repo-card" }, h("span", null, "github_org_mockA"), h("strong", null, data.team.org), h("a", { href: data.team.githubOrg, target: "_blank", rel: "noreferrer" }, "github_link_mockA")),
    );
  }

  function Header({ active, query, setQuery, onAction }) {
    const current = data.nav.find((item) => item.id === active);
    return h(
      "header",
      { className: "header" },
      h("div", null, h("span", { className: "eyebrow" }, data.team.season), h("h1", null, current ? current.label : data.team.name)),
      h(
        "div",
        { className: "header-actions" },
        h("label", { className: "search" }, h(Icon, { name: "search" }), h("input", { value: query, onChange: (event) => setQuery(event.target.value), placeholder: "search_mockA" })),
        h("button", { className: "primary", onClick: () => onAction("modal", "create_mockA") }, h(Icon, { name: "plus" }), "button_mockA"),
      ),
    );
  }

  function Hero({ setActive, onAction }) {
    return h(
      "section",
      { className: "hero" },
      h(
        "div",
        null,
        h("span", { className: "eyebrow" }, "hero_label_mockA"),
        h("h2", null, data.team.tagline),
        h("p", null, data.team.description),
        h("div", { className: "hero-actions" }, h("button", { className: "primary", onClick: () => setActive("events") }, "button_mockB"), h("button", { onClick: () => onAction("toast", "toast_mockA") }, "button_mockC")),
      ),
      h("div", { className: "workflow-map", "aria-hidden": "true" }, data.dashboard.heroNodes.map((label, index) => h("span", { key: label, className: index === 0 ? "node main" : "node" }, label))),
    );
  }

  function StatGrid() {
    return h("section", { className: "stat-grid" }, data.team.stats.map((stat) => h("article", { key: stat.label, className: `stat-card ${stat.tone}` }, h("span", null, stat.label), h("strong", null, stat.value))));
  }

  function ProjectCard({ item, onDetail, onAction }) {
    return h(
      "article",
      { className: "study-card clickable", onClick: () => onDetail("projects", item) },
      h("div", { className: "card-row" }, h("span", { className: "pill" }, item.category), h("span", { className: "status" }, item.status)),
      h("h3", null, item.title),
      h("p", null, item.description),
      h("div", { className: "tag-row" }, item.tags.map((tag) => h("span", { key: tag }, tag))),
      h("div", { className: "study-meta" }, h("span", null, `${item.members} · ${item.level}`), h("span", null, item.schedule)),
      h("div", { className: "progress" }, h("span", { style: { width: `${item.progress}%` } })),
      h("button", { className: "mini-button", onClick: (event) => { event.stopPropagation(); onAction("modal", item.id); } }, "button_mockD"),
    );
  }

  function ListCard({ item, type, onDetail, onAction }) {
    return h(
      "article",
      { className: "list-card clickable", onClick: () => onDetail(type, item) },
      h("span", { className: "pill" }, item.category || item.status || item.type || "category_mockA"),
      h("h3", null, item.title || item.name),
      h("p", null, item.summary || item.description || item.focus || "description_mockA"),
      h("div", { className: "card-row muted-row" }, h("span", null, item.date || item.updated || item.period || item.mode || item.role || "meta_mockA"), h("span", null, item.metric || item.size || item.count || item.points || "meta_mockB")),
      h("button", { className: "mini-button", onClick: (event) => { event.stopPropagation(); onAction("toast", `${type}_button_mockA`); } }, "button_mockA"),
    );
  }

  function CollectionPage({ page, items, query, onDetail, onAction }) {
    const filtered = useMemo(() => items.filter((item) => includesQuery(item, query)), [items, query]);
    return h(
      React.Fragment,
      null,
      h(PageHeader, { page, onAction }),
      h("section", { className: "collection-grid" }, filtered.map((item) => h(ListCard, { key: item.id || item.title || item.name, item, type: page, onDetail, onAction }))),
      filtered.length === 0 && h("div", { className: "empty-state" }, "empty_mockA"),
    );
  }

  function ProjectsPage({ query, onDetail, onAction }) {
    const filtered = data.projects.filter((item) => includesQuery(item, query));
    return h(
      React.Fragment,
      null,
      h(PageHeader, { page: "projects", onAction }),
      h("section", { className: "study-grid" }, filtered.map((item) => h(ProjectCard, { key: item.id, item, onDetail, onAction }))),
      filtered.length === 0 && h("div", { className: "empty-state" }, "empty_mockA"),
    );
  }

  function Dashboard({ setActive, query, onDetail, onAction }) {
    const previewProjects = data.projects.filter((item) => includesQuery(item, query)).slice(0, 4);
    return h(
      React.Fragment,
      null,
      h(Hero, { setActive, onAction }),
      h(StatGrid),
      h(
        "div",
        { className: "main-grid" },
        h("section", null, h("div", { className: "section-title" }, h("div", null, h("span", { className: "eyebrow" }, "section_mockA"), h("h2", null, "title_mockA")), h("button", { onClick: () => setActive("projects") }, "button_mockA")), h("div", { className: "study-grid" }, previewProjects.map((item) => h(ProjectCard, { key: item.id, item, onDetail, onAction })))),
        h("aside", { className: "rail" }, h(CompactPanel, { title: "title_mockB", page: "events", setActive, items: data.events, onDetail }), h(CompactPanel, { title: "title_mockC", page: "wiki", setActive, items: data.wikiPages, onDetail })),
      ),
    );
  }

  function CompactPanel({ title, page, setActive, items, onDetail }) {
    return h("section", { className: "panel" }, h("div", { className: "panel-head" }, h("h2", null, title), h("button", { onClick: () => setActive(page) }, "button_mockA")), h("div", { className: "compact-list" }, items.slice(0, 4).map((item) => h("button", { key: item.id, onClick: () => onDetail(page, item) }, h("strong", null, item.title || item.name), h("span", null, item.category || item.date || item.updated || "meta_mockA")))));
  }

  function AboutPage({ onAction }) {
    return h(
      React.Fragment,
      null,
      h(PageHeader, { page: "about", onAction }),
      h("section", { className: "two-col" }, ["title_mockA", "title_mockB", "title_mockC", "title_mockD"].map((title, index) => h("article", { className: "panel value-card", key: title }, h("span", { className: "pill" }, `category_mock${String.fromCharCode(65 + index)}`), h("h3", null, title), h("p", null, `description_mock${String.fromCharCode(65 + index)}`), h("button", { onClick: () => onAction("toast", title) }, "button_mockA")))),
    );
  }

  function RecruitPage({ onAction }) {
    return h(React.Fragment, null, h(PageHeader, { page: "recruit", onAction }), h("section", { className: "timeline" }, data.recruitSteps.map((step, index) => h("article", { key: step.title, className: "timeline-item" }, h("span", null, `step_mock${String.fromCharCode(65 + index)}`), h("h3", null, step.title), h("p", null, step.description), h("button", { onClick: () => onAction("modal", step.title) }, "button_mockA")))));
  }

  function LeaderboardPage({ onDetail, onAction }) {
    return h(React.Fragment, null, h(PageHeader, { page: "leaderboard", onAction }), h("section", { className: "leaderboard" }, data.members.map((member, index) => h("button", { key: member.id, onClick: () => onDetail("profile", member) }, h("span", { className: "rank" }, `#${index + 1}`), h("strong", null, member.name), h("span", null, member.role), h("b", null, member.points)))));
  }

  function ProfilePage({ onDetail, onAction }) {
    return h(React.Fragment, null, h(PageHeader, { page: "profile", onAction }), h("section", { className: "collection-grid" }, data.members.map((member) => h(ListCard, { key: member.id, item: member, type: "profile", onDetail, onAction }))));
  }

  function AdminPage({ onAction }) {
    return h(React.Fragment, null, h(PageHeader, { page: "admin", onAction }), h("section", { className: "task-grid" }, data.adminTasks.map((task) => h("label", { key: task.title }, h("input", { type: "checkbox", onChange: () => onAction("toast", task.title) }), h("span", null, task.title), h("small", null, task.description)))));
  }

  function DetailDrawer({ detail, onClose, onAction }) {
    if (!detail) return null;
    const item = detail.item;
    return h(
      "div",
      { className: "drawer-backdrop", onClick: onClose },
      h(
        "aside",
        { className: "drawer", onClick: (event) => event.stopPropagation() },
        h("button", { className: "icon-button", onClick: onClose, "aria-label": "close_mockA" }, h(Icon, { name: "x" })),
        h("span", { className: "eyebrow" }, `${detail.type}_detail_mockA`),
        h("h2", null, item.title || item.name),
        h("p", null, item.description || item.summary || item.focus || "description_mockA"),
        h("dl", null, Object.entries(item).slice(0, 8).map(([key, value]) => h(React.Fragment, { key }, h("dt", null, key), h("dd", null, Array.isArray(value) ? value.join(", ") : String(value))))),
        h("div", { className: "drawer-actions" }, h("button", { className: "primary", onClick: () => onAction("toast", "detail_action_mockA") }, "button_mockA"), h("button", { onClick: () => onAction("modal", "detail_modal_mockA") }, "button_mockB")),
      ),
    );
  }

  function Modal({ modal, onClose, onAction }) {
    if (!modal) return null;
    return h("div", { className: "modal-backdrop", onClick: onClose }, h("section", { className: "modal", onClick: (event) => event.stopPropagation() }, h("button", { className: "icon-button", onClick: onClose, "aria-label": "close_mockB" }, h(Icon, { name: "x" })), h("span", { className: "eyebrow" }, "modal_mockA"), h("h2", null, "title_mockZ"), h("p", null, modal), h("label", null, "input_label_mockA", h("input", { placeholder: "input_mockA" })), h("label", null, "input_label_mockB", h("textarea", { placeholder: "textarea_mockA" })), h("div", { className: "drawer-actions" }, h("button", { className: "primary", onClick: () => { onAction("toast", "saved_mockA"); onClose(); } }, "button_mockSave"), h("button", { onClick: onClose }, "button_mockCancel"))));
  }

  function Toast({ message }) {
    return message ? h("div", { className: "toast" }, message) : null;
  }

  function renderPage(active, props) {
    const collectionMap = {
      notice: data.notices,
      squad: data.squads,
      events: data.events,
      blog: data.blogPosts,
      seasons: data.seasons,
      achievements: data.badges,
      wiki: data.wikiPages,
    };
    if (active === "dashboard") return h(Dashboard, props);
    if (active === "about") return h(AboutPage, props);
    if (active === "recruit") return h(RecruitPage, props);
    if (active === "projects") return h(ProjectsPage, props);
    if (active === "leaderboard") return h(LeaderboardPage, props);
    if (active === "profile") return h(ProfilePage, props);
    if (active === "admin") return h(AdminPage, props);
    return h(CollectionPage, { ...props, page: active, items: collectionMap[active] || [] });
  }

  function App() {
    const [active, setActive] = useState("dashboard");
    const [query, setQuery] = useState("");
    const [detail, setDetail] = useState(null);
    const [modal, setModal] = useState(null);
    const [toast, setToast] = useState("");

    function notify(message) {
      setToast(message);
      window.clearTimeout(window.__aspToastTimer);
      window.__aspToastTimer = window.setTimeout(() => setToast(""), 2200);
    }

    function onAction(type, payload) {
      if (type === "modal") setModal(payload);
      if (type === "toast") notify(payload);
    }

    function onDetail(type, item) {
      setDetail({ type, item });
    }

    function changePage(id) {
      setActive(id);
      setDetail(null);
      setModal(null);
      window.location.hash = id;
    }

    return h(
      "div",
      { className: "app-shell" },
      h(Sidebar, { active, setActive: changePage }),
      h("main", { className: "content" }, h(Header, { active, query, setQuery, onAction }), renderPage(active, { setActive: changePage, query, onDetail, onAction })),
      h("nav", { className: "bottom-nav", "aria-label": "nav_mobile_mockA" }, data.nav.map((item) => h("button", { key: item.id, className: item.id === active ? "active" : "", onClick: () => changePage(item.id) }, h(Icon, { name: item.icon }), h("span", null, item.label)))),
      h(DetailDrawer, { detail, onClose: () => setDetail(null), onAction }),
      h(Modal, { modal, onClose: () => setModal(null), onAction }),
      h(Toast, { message: toast }),
    );
  }

  ReactDOM.createRoot(document.getElementById("root")).render(h(App));
})();

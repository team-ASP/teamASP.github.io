"use client";

export function safeMarkdownHref(rawHref) {
  const href = String(rawHref || "").trim();
  if (!href) return "";
  if (href.startsWith("/") || href.startsWith("#")) return href;
  try {
    const url = new URL(href);
    if (["http:", "https:", "mailto:"].includes(url.protocol)) return url.href;
  } catch {
    return "";
  }
  return "";
}

export function countChecklist(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  let total = 0;
  let checked = 0;
  for (const line of lines) {
    const match = line.trim().match(/^[-*]\s+\[([ xX])\]\s+/);
    if (match) {
      total += 1;
      if (match[1].toLowerCase() === "x") checked += 1;
    }
  }
  return { total, checked };
}

export function stripMarkdownSnippet(markdown, maxLen = 110) {
  const plain = String(markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[#>*\-\s|]+/gm, " ")
    .replace(/[*`_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  return plain.length > maxLen ? `${plain.slice(0, maxLen)}…` : plain;
}

export function extractHeadings(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const headings = [];
  let inCode = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const match = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].replace(/[*`_]/g, "").trim(),
      });
    }
  }
  return headings;
}

function renderInlineMarkdown(value, keyPrefix) {
  const text = String(value || "");
  const pattern = /(`[^`]+`|\*\*[^*]+?\*\*|\*[^*]+?\*|\[[^\]]+?\]\([^)]+?\))/g;
  const nodes = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={key}>{renderInlineMarkdown(token.slice(2, -2), `${key}-b`)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={key}>{renderInlineMarkdown(token.slice(1, -1), `${key}-i`)}</em>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+?)\]\(([^)]+?)\)$/);
      const href = safeMarkdownHref(linkMatch?.[2]);
      nodes.push(
        href ? (
          <a
            key={key}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          >
            {renderInlineMarkdown(linkMatch[1], `${key}-a`)}
          </a>
        ) : (
          linkMatch?.[1] || token
        ),
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function isBlockStart(line) {
  return /^(```|#{1,3}\s+|[-*]\s+|\d+\.\s+|>\s+|\|.+\|$|---+$)/.test(line.trim());
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function MarkdownRenderer({ value, compact = false, onToggleChecklist = null }) {
  const normalized = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return null;

  const lines = normalized.split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    const key = `md-${blocks.length}`;

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr key={key} className="v2-md-hr" />);
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={key} className="v2-md-pre">
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (
      trimmed.startsWith("|") &&
      trimmed.endsWith("|") &&
      index + 1 < lines.length &&
      /^\|[\s:-]+\|$/.test(lines[index + 1].trim().replace(/\|/g, "|"))
    ) {
      const headers = parseTableRow(trimmed);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith("|") && lines[index].trim().endsWith("|")) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      blocks.push(
        <div key={key} className="md-table-scroll">
          <table className="md-table">
            <thead>
              <tr>
                {headers.map((cell, ci) => (
                  <th key={`${key}-h-${ci}`}>{renderInlineMarkdown(cell, `${key}-h-${ci}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={`${key}-r-${ri}`}>
                  {headers.map((_, ci) => (
                    <td key={`${key}-r-${ri}-c-${ci}`}>{renderInlineMarkdown(row[ci] || "", `${key}-r-${ri}-c-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const Tag = compact ? "p" : `h${Math.min(level + 1, 4)}`;
      blocks.push(
        <Tag key={key} className={compact ? "v2-md-h-compact" : `v2-md-h${level}`}>
          {renderInlineMarkdown(heading[2], key)}
        </Tag>,
      );
      index += 1;
      continue;
    }

    const chk = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (chk) {
      const items = [];
      while (index < lines.length) {
        const m = lines[index].trim().match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
        if (!m) break;
        items.push({ lineIndex: index, checked: m[1].toLowerCase() === "x", text: m[2] });
        index += 1;
      }
      blocks.push(
        <ul key={key} className="md-checklist">
          {items.map((item) => (
            <li key={`${key}-chk-${item.lineIndex}`} className={item.checked ? "checked" : ""}>
              <input
                type="checkbox"
                checked={item.checked}
                readOnly={!onToggleChecklist}
                onChange={() => onToggleChecklist?.(item.lineIndex)}
              />
              <span>{renderInlineMarkdown(item.text, `${key}-chk-${item.lineIndex}`)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    const ul = trimmed.match(/^[-*]\s+(.+)$/);
    if (ul) {
      const items = [];
      while (index < lines.length) {
        const m = lines[index].trim().match(/^[-*]\s+(.+)$/);
        if (!m || /^[-*]\s+\[([ xX])\]\s+/.test(lines[index].trim())) break;
        items.push(m[1]);
        index += 1;
      }
      blocks.push(
        <ul key={key} className="v2-md-ul">
          {items.map((item, idx) => (
            <li key={`${key}-u-${idx}`}>{renderInlineMarkdown(item, `${key}-u-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const ol = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      const items = [];
      while (index < lines.length) {
        const m = lines[index].trim().match(/^\d+\.\s+(.+)$/);
        if (!m) break;
        items.push(m[1]);
        index += 1;
      }
      blocks.push(
        <ol key={key} className="v2-md-ol">
          {items.map((item, idx) => (
            <li key={`${key}-o-${idx}`}>{renderInlineMarkdown(item, `${key}-o-${idx}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const quote = trimmed.match(/^>\s+(.+)$/);
    if (quote) {
      const quotes = [];
      while (index < lines.length) {
        const m = lines[index].trim().match(/^>\s+(.+)$/);
        if (!m) break;
        quotes.push(m[1]);
        index += 1;
      }
      blocks.push(
        <blockquote key={key} className="v2-md-quote">
          {renderInlineMarkdown(quotes.join(" "), key)}
        </blockquote>,
      );
      continue;
    }

    const paragraph = [trimmed];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={key}>{renderInlineMarkdown(paragraph.join(" "), key)}</p>);
  }

  return <div className={`v2-markdown${compact ? " compact" : ""}`}>{blocks}</div>;
}

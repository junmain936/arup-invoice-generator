import { useState, useRef, useCallback } from "react";

// ─── Parsers ────────────────────────────────────────────────────────────────

function detectLanguage(code) {
  if (/^\s*<(!DOCTYPE|html|head|body)/i.test(code)) return "html";
  if (/import\s+React|jsx|tsx/.test(code)) return "jsx";
  if (/def |class |import |from |if __name__/.test(code)) return "python";
  if (/func |package main|:=/.test(code)) return "go";
  if (/<\?php/.test(code)) return "php";
  return "js";
}

function parseCodeIntoBlocks(code) {
  const lang = detectLanguage(code);
  const blocks = [];

  if (lang === "html") {
    // HTML: split by major tags
    const tagPattern = /(<(html|head|body|style|script|div|section|header|footer|main|nav|article)[^>]*>[\s\S]*?<\/\2>)/gi;
    let lastIndex = 0;
    let match;
    let idx = 0;
    const regex = new RegExp(tagPattern);
    while ((match = regex.exec(code)) !== null) {
      if (match.index > lastIndex) {
        const between = code.slice(lastIndex, match.index).trim();
        if (between) {
          blocks.push({ id: idx++, name: `Block_${idx}`, code: between });
        }
      }
      const tagName = match[2];
      blocks.push({ id: idx++, name: `<${tagName}>`, code: match[0] });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < code.length) {
      const remaining = code.slice(lastIndex).trim();
      if (remaining) blocks.push({ id: idx++, name: `Block_${idx}`, code: remaining });
    }
  } else if (lang === "python") {
    // Python: split by def/class
    const lines = code.split("\n");
    let current = [];
    let currentName = "Module_Top";
    let idx = 0;

    for (const line of lines) {
      const defMatch = line.match(/^(def|class)\s+(\w+)/);
      if (defMatch && current.length > 0) {
        blocks.push({ id: idx++, name: currentName, code: current.join("\n") });
        current = [line];
        currentName = `${defMatch[1]}_${defMatch[2]}`;
      } else {
        current.push(line);
        if (defMatch) currentName = `${defMatch[1]}_${defMatch[2]}`;
      }
    }
    if (current.length > 0) {
      blocks.push({ id: idx++, name: currentName, code: current.join("\n") });
    }
  } else {
    // JS/JSX/TS: split by function/class/const arrow fn
    const lines = code.split("\n");
    let current = [];
    let currentName = "Top_Level";
    let depth = 0;
    let idx = 0;
    let inBlock = false;

    for (const line of lines) {
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      depth += opens - closes;

      const fnMatch = line.match(/^(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|class\s+(\w+))/);

      if (fnMatch && depth <= 1 && current.length > 0) {
        blocks.push({ id: idx++, name: currentName, code: current.join("\n").trim() });
        current = [line];
        currentName = fnMatch[1] || fnMatch[2] || fnMatch[3] || `Block_${idx}`;
        inBlock = true;
      } else {
        current.push(line);
        if (fnMatch && !inBlock) {
          currentName = fnMatch[1] || fnMatch[2] || fnMatch[3] || `Block_${idx}`;
          inBlock = true;
        }
      }

      if (depth === 0 && inBlock && current.length > 3) {
        blocks.push({ id: idx++, name: currentName, code: current.join("\n").trim() });
        current = [];
        currentName = `Block_${idx}`;
        inBlock = false;
      }
    }
    if (current.length > 0 && current.join("").trim()) {
      blocks.push({ id: idx++, name: currentName, code: current.join("\n").trim() });
    }
  }

  // Fallback: if only 1 block or none, split by blank lines / size
  if (blocks.length <= 1) {
    const parts = code.split(/\n{2,}/);
    return parts
      .map((part, i) => ({ id: i, name: `Block_${i + 1}`, code: part.trim() }))
      .filter((b) => b.code.length > 0);
  }

  return blocks;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CodeBlockEditor() {
  const [blocks, setBlocks] = useState([]);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [pasteVal, setPasteVal] = useState("");
  const [view, setView] = useState("upload"); // "upload" | "editor"
  const [fullCode, setFullCode] = useState("");
  const [updated, setUpdated] = useState(false);
  const fileRef = useRef();

  const processCode = useCallback((code) => {
    const parsed = parseCodeIntoBlocks(code);
    setBlocks(parsed);
    setFullCode(code);
    setView("editor");
  }, []);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => processCode(ev.target.result);
    reader.readAsText(file);
  };

  const handlePaste = () => {
    if (pasteVal.trim()) processCode(pasteVal);
  };

  const handleBlockChange = (id, newCode) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, code: newCode } : b)));
    setUpdated(false);
  };

  const handleNameChange = (id, newName) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, name: newName } : b)));
  };

  const handleAddBlock = (afterId) => {
    const newId = Date.now();
    const newBlock = { id: newId, name: `New_Block`, code: "// New block\n" };
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === afterId);
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      return next;
    });
  };

  const handleDeleteBlock = (id) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleUpdate = () => {
    const merged = blocks.map((b) => b.code).join("\n\n");
    setFullCode(merged);
    setUpdated(true);
    setTimeout(() => setUpdated(false), 2000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(fullCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered = blocks.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Upload Screen ──────────────────────────────────────────────────────────
  if (view === "upload") {
    return (
      <div style={styles.root}>
        <div style={styles.uploadCard}>
          <div style={styles.logo}>⬡</div>
          <h1 style={styles.title}>Code Block Editor</h1>
          <p style={styles.sub}>Upload a file or paste code to split it into editable blocks</p>

          <div
            style={styles.dropZone}
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => processCode(ev.target.result);
                reader.readAsText(file);
              }
            }}
          >
            <div style={styles.dropIcon}>📁</div>
            <p style={styles.dropText}>Drop file here or <span style={styles.browse}>click to browse</span></p>
            <p style={styles.dropSub}>Supports JS, JSX, TS, Python, HTML, CSS, PHP, Go…</p>
            <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFile} />
          </div>

          <div style={styles.divider}><span style={styles.dividerText}>or paste code</span></div>

          <textarea
            style={styles.pasteBox}
            placeholder="// Paste your code here..."
            value={pasteVal}
            onChange={(e) => setPasteVal(e.target.value)}
            spellCheck={false}
          />

          <button
            style={{ ...styles.btn, opacity: pasteVal.trim() ? 1 : 0.4 }}
            disabled={!pasteVal.trim()}
            onClick={handlePaste}
          >
            Parse Code →
          </button>
        </div>
      </div>
    );
  }

  // ── Editor Screen ──────────────────────────────────────────────────────────
  return (
    <div style={styles.editorRoot}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <button style={styles.backBtn} onClick={() => { setView("upload"); setPasteVal(""); setBlocks([]); }}>
          ← Back
        </button>
        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            style={styles.searchInput}
            placeholder="Search blocks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button style={styles.clearSearch} onClick={() => setSearch("")}>✕</button>
          )}
        </div>
        <div style={styles.blockCount}>{filtered.length} block{filtered.length !== 1 ? "s" : ""}</div>
      </div>

      {/* Blocks Area */}
      <div style={styles.blocksArea}>
        {filtered.length === 0 ? (
          <div style={styles.noMatch}>No blocks match "{search}"</div>
        ) : (
          <>
            {filtered.map((block, idx) => (
              <div key={block.id}>
                <BlockCard
                  block={block}
                  index={idx + 1}
                  total={filtered.length}
                  onChange={handleBlockChange}
                  onNameChange={handleNameChange}
                  onDelete={handleDeleteBlock}
                />
                {/* Add Block button after each block */}
                <div style={styles.addBlockRow}>
                  <button
                    style={styles.addBlockBtn}
                    onClick={() => handleAddBlock(block.id)}
                  >
                    <span style={styles.addIcon}>＋</span> Add Block here
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Bottom Fixed Bar */}
      <div style={styles.bottomBar}>
        <div style={styles.bottomLeft}>
          <span style={styles.fileTag}>📝 {blocks.length} blocks total</span>
        </div>
        <div style={styles.bottomRight}>
          <button style={styles.updateBtn} onClick={handleUpdate}>
            {updated ? "✓ Updated!" : "⟳ Update Full Code"}
          </button>
          {fullCode && (
            <button style={styles.copyBtn} onClick={handleCopy}>
              {copied ? "✓ Copied!" : "⎘ Copy Full Code"}
            </button>
          )}
        </div>
      </div>

      {/* Full Code Preview (shows after update) */}
      {fullCode && updated === false && view === "editor" && (
        <FullCodePanel code={fullCode} onCopy={handleCopy} copied={copied} />
      )}
    </div>
  );
}

// ─── Block Card ───────────────────────────────────────────────────────────────

function BlockCard({ block, index, onChange, onNameChange, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [nameEdit, setNameEdit] = useState(false);
  const [nameVal, setNameVal] = useState(block.name);
  const lines = block.code.split("\n").length;

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardLeft}>
          <span style={styles.blockNum}>#{index}</span>
          {nameEdit ? (
            <input
              style={styles.nameInput}
              value={nameVal}
              autoFocus
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={() => { onNameChange(block.id, nameVal); setNameEdit(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { onNameChange(block.id, nameVal); setNameEdit(false); } }}
            />
          ) : (
            <span style={styles.blockName} onClick={() => setNameEdit(true)} title="Click to rename">
              {block.name} ✎
            </span>
          )}
          <span style={styles.lineCount}>{lines} line{lines !== 1 ? "s" : ""}</span>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button
            style={{ ...styles.editToggle, ...(editing ? styles.editActive : {}) }}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "✓ Done" : "✎ Edit"}
          </button>
          <button
            style={styles.deleteBtn}
            onClick={() => onDelete(block.id)}
            title="Delete block"
          >
            🗑
          </button>
        </div>
      </div>

      <textarea
        style={{
          ...styles.codeBox,
          ...(editing ? styles.codeBoxEditing : {}),
          height: Math.min(Math.max(lines * 20, 80), 320) + "px",
        }}
        value={block.code}
        readOnly={!editing}
        onChange={(e) => onChange(block.id, e.target.value)}
        spellCheck={false}
      />
    </div>
  );
}

// ─── Full Code Panel ─────────────────────────────────────────────────────────

function FullCodePanel({ code, onCopy, copied }) {
  const lines = code.split("\n").length;
  return (
    <div style={styles.fullPanel}>
      <div style={styles.fullHeader}>
        <span style={styles.fullTitle}>📄 Full Code Preview</span>
        <span style={styles.fullMeta}>{lines} lines · {code.length} chars</span>
        <button style={styles.copyBtn} onClick={onCopy}>
          {copied ? "✓ Copied!" : "⎘ Copy"}
        </button>
      </div>
      <textarea
        style={styles.fullCode}
        value={code}
        readOnly
        spellCheck={false}
      />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  root: {
    minHeight: "100vh",
    background: "#0d0d0f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    padding: "20px",
  },
  uploadCard: {
    background: "#141418",
    border: "1px solid #2a2a35",
    borderRadius: "16px",
    padding: "40px",
    maxWidth: "520px",
    width: "100%",
    boxShadow: "0 0 60px rgba(99,102,241,0.08)",
  },
  logo: {
    fontSize: "32px",
    textAlign: "center",
    marginBottom: "12px",
    color: "#6366f1",
  },
  title: {
    margin: "0 0 8px",
    textAlign: "center",
    color: "#f0f0ff",
    fontSize: "22px",
    fontWeight: "700",
    letterSpacing: "-0.5px",
  },
  sub: {
    margin: "0 0 28px",
    textAlign: "center",
    color: "#666",
    fontSize: "13px",
  },
  dropZone: {
    border: "2px dashed #2a2a40",
    borderRadius: "12px",
    padding: "32px 20px",
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color 0.2s",
    background: "#0d0d13",
    marginBottom: "20px",
  },
  dropIcon: { fontSize: "32px", marginBottom: "12px" },
  dropText: { color: "#aaa", fontSize: "14px", margin: "0 0 6px" },
  browse: { color: "#6366f1", textDecoration: "underline" },
  dropSub: { color: "#444", fontSize: "12px", margin: 0 },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    margin: "20px 0",
  },
  dividerText: {
    color: "#444",
    fontSize: "12px",
    whiteSpace: "nowrap",
    background: "#141418",
    padding: "0 8px",
    margin: "0 auto",
  },
  pasteBox: {
    width: "100%",
    minHeight: "160px",
    background: "#0d0d13",
    border: "1px solid #2a2a35",
    borderRadius: "10px",
    color: "#c0c0e0",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "12px",
    padding: "14px",
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
    lineHeight: "1.6",
    display: "block",
  },
  btn: {
    marginTop: "16px",
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: "0.5px",
    transition: "transform 0.1s",
  },
  // Editor root
  editorRoot: {
    minHeight: "100vh",
    background: "#0d0d0f",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    paddingBottom: "80px",
  },
  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "#101014",
    borderBottom: "1px solid #1e1e28",
    padding: "12px 20px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
  },
  backBtn: {
    background: "transparent",
    border: "1px solid #2a2a38",
    color: "#888",
    padding: "7px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "12px",
    fontFamily: "'JetBrains Mono', monospace",
    whiteSpace: "nowrap",
  },
  searchWrap: {
    flex: 1,
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  searchIcon: {
    position: "absolute",
    left: "12px",
    fontSize: "14px",
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    background: "#0d0d13",
    border: "1px solid #2a2a38",
    borderRadius: "8px",
    color: "#d0d0f0",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "13px",
    padding: "8px 36px 8px 36px",
    outline: "none",
    boxSizing: "border-box",
  },
  clearSearch: {
    position: "absolute",
    right: "10px",
    background: "transparent",
    border: "none",
    color: "#555",
    cursor: "pointer",
    fontSize: "12px",
    padding: "2px 4px",
  },
  blockCount: {
    color: "#555",
    fontSize: "12px",
    whiteSpace: "nowrap",
    minWidth: "70px",
    textAlign: "right",
  },
  blocksArea: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    flex: 1,
  },
  noMatch: {
    textAlign: "center",
    color: "#444",
    padding: "60px 0",
    fontSize: "14px",
  },
  // Card
  card: {
    background: "#111116",
    border: "1px solid #1e1e2c",
    borderRadius: "12px",
    overflow: "hidden",
    transition: "border-color 0.2s",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderBottom: "1px solid #1a1a24",
    background: "#0e0e14",
  },
  cardLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    overflow: "hidden",
  },
  blockNum: {
    color: "#6366f1",
    fontSize: "11px",
    fontWeight: "700",
    minWidth: "28px",
  },
  blockName: {
    color: "#a0a0c0",
    fontSize: "12px",
    cursor: "pointer",
    maxWidth: "200px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    borderBottom: "1px dashed #333",
    paddingBottom: "1px",
  },
  nameInput: {
    background: "#0a0a12",
    border: "1px solid #6366f1",
    borderRadius: "4px",
    color: "#d0d0f0",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "12px",
    padding: "2px 8px",
    outline: "none",
    maxWidth: "180px",
  },
  lineCount: {
    color: "#333",
    fontSize: "10px",
    whiteSpace: "nowrap",
  },
  editToggle: {
    background: "transparent",
    border: "1px solid #2a2a38",
    color: "#666",
    padding: "5px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "11px",
    fontFamily: "'JetBrains Mono', monospace",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  },
  editActive: {
    borderColor: "#6366f1",
    color: "#6366f1",
    background: "rgba(99,102,241,0.08)",
  },
  codeBox: {
    width: "100%",
    background: "#0a0a10",
    border: "none",
    borderTop: "1px solid #141420",
    color: "#b0b0d0",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: "12px",
    padding: "14px",
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
    lineHeight: "1.65",
    display: "block",
    overflow: "auto",
    cursor: "default",
    transition: "background 0.2s, border-color 0.2s",
    minHeight: "80px",
  },
  codeBoxEditing: {
    background: "#0d0d18",
    borderTop: "1px solid #6366f155",
    cursor: "text",
    color: "#d0d0f0",
  },
  // Bottom bar
  bottomBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#101014",
    borderTop: "1px solid #1e1e28",
    padding: "12px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 200,
    boxShadow: "0 -4px 20px rgba(0,0,0,0.5)",
  },
  bottomLeft: { display: "flex", alignItems: "center", gap: "10px" },
  bottomRight: { display: "flex", alignItems: "center", gap: "10px" },
  fileTag: { color: "#444", fontSize: "12px" },
  updateBtn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    border: "none",
    color: "#fff",
    padding: "9px 18px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "12px",
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: "700",
  },
  copyBtn: {
    background: "#1a1a28",
    border: "1px solid #2a2a40",
    color: "#a0a0c8",
    padding: "9px 18px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "12px",
    fontFamily: "'JetBrains Mono', monospace",
  },
  // Add block row
  addBlockRow: {
    display: "flex",
    justifyContent: "center",
    padding: "6px 0 2px",
  },
  addBlockBtn: {
    background: "transparent",
    border: "1px dashed #2a2a40",
    color: "#4a4a6a",
    borderRadius: "8px",
    padding: "6px 20px",
    fontSize: "11px",
    fontFamily: "'JetBrains Mono', monospace",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    transition: "all 0.15s",
    letterSpacing: "0.3px",
  },
  addIcon: {
    fontSize: "14px",
    color: "#5a5a8a",
    lineHeight: 1,
  },
  deleteBtn: {
    background: "transparent",
    border: "1px solid #2a2a38",
    color: "#555",
    borderRadius: "6px",
    padding: "5px 8px",
    cursor: "pointer",
    fontSize: "12px",
    lineHeight: 1,
    transition: "all 0.15s",
  },
  // Full panel
  fullPanel: {
    margin: "0 20px 20px",
    background: "#0a0a12",
    border: "1px solid #1e1e2c",
    borderRadius: "12px",
    overflow: "hidden",
  },
  fullHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 14px",
    background: "#0e0e16",
    borderBottom: "1px solid #1a1a24",
  },
  fullTitle: { color: "#8080b0", fontSize: "12px", flex: 1 },
  fullMeta: { color: "#444", fontSize: "11px" },
  fullCode: {
    width: "100%",
    minHeight: "200px",
    maxHeight: "400px",
    background: "transparent",
    border: "none",
    color: "#a0a0c0",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "12px",
    padding: "14px",
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
    lineHeight: "1.65",
    display: "block",
    overflow: "auto",
  },
};

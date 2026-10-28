/* =====================================================================
   KERNEL · Text Processing
   window.TRACKS.text — modules: search / transform

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.
   ===================================================================== */
(function () {
  "use strict";

  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
  }
  function segment(pairs, initialIdx, onPick) {
    var seg = h("div", { class: "w-seg" });
    var btns = [];
    for (var i = 0; i < pairs.length; i++) {
      (function (pair, idx) {
        var b = h("button", { type: "button", class: "w-seg-btn" + (idx === initialIdx ? " active" : "") }, pair[1]);
        b.addEventListener("click", function () {
          for (var j = 0; j < btns.length; j++) btns[j].classList.remove("active");
          b.classList.add("active");
          onPick(pair[0]);
        });
        btns.push(b);
        seg.appendChild(b);
      })(pairs[i], i);
    }
    return seg;
  }
  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }
  function roLine(text) { return h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, text); }
  var PRE = "margin:0;padding:12px 14px;border-radius:10px;background:var(--surface-solid);color:var(--text);" +
    "border:1px solid var(--line);font-family:var(--font-mono);font-size:0.8rem;line-height:1.55;white-space:pre-wrap;overflow-x:auto";
  function term(text) { return h("pre", { style: PRE }, text); }
  function label(text) {
    return h("div", { style: "font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-faint);margin:10px 0 4px" }, text);
  }

  var Widgets = {};

  /* ==================================================================
     1. textRegex — try a pattern against a small log
  ================================================================== */
  var LOG = [
    "2026-10-28T09:14:02Z INFO  api  GET /orders 200 41ms user=ana",
    "2026-10-28T09:14:05Z WARN  api  GET /orders 429 3ms user=bo",
    "2026-10-28T09:14:07Z ERROR db   timeout after 5000ms host=db1.lab.example",
    "2026-10-28T09:15:11Z INFO  api  POST /cart 201 88ms user=ana",
    "2026-10-28T09:15:40Z ERROR api  POST /pay 502 1210ms user=cy",
    "2026-10-28T09:16:02Z INFO  auth login ok user=bo ip=192.0.2.44",
    "2026-10-28T09:16:09Z WARN  auth login failed user=root ip=203.0.113.9"
  ];
  var PRESETS = [
    ["ERROR", "ERROR"],
    [" 5[0-9]{2} ", "HTTP 5xx"],
    ["user=(ana|bo)\\b", "user ana or bo"],
    ["[0-9]{4,}ms", "4+ digit ms"],
    ["ip=203\\.0\\.113\\.[0-9]+", "ip in 203.0.113/24"]
  ];

  Widgets.textRegex = function (mount) {
    shell(mount, "tester", "Regex against a log file",
      "Type an extended regex (grep -E style) or pick a preset. Matching lines are listed with the matched text bracketed, as grep -o would isolate it. Toggle -i and -v.");
    var state = { pat: "ERROR", i: false, v: false };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var inp = h("input", { type: "text", "aria-label": "Regular expression", spellcheck: "false",
      style: "background:var(--surface-solid);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:6px 8px;font-family:var(--font-mono);font-size:0.8rem;width:240px" });
    inp.value = state.pat;
    inp.addEventListener("input", function () { state.pat = String(inp.value || ""); paint(); });

    function toggle(name, key) {
      var b = h("button", { type: "button", class: "w-btn ghost" }, name + ": off");
      b.addEventListener("click", function () {
        state[key] = !state[key];
        b.className = "w-btn" + (state[key] ? " primary" : " ghost");
        b.textContent = name + (state[key] ? ": on" : ": off");
        paint();
      });
      return b;
    }

    function paint() {
      clear(stage); clear(readout);
      var flags = "-E" + (state.i ? "i" : "") + (state.v ? "v" : "");
      stage.appendChild(term("$ grep " + flags + " '" + state.pat + "' app.log"));
      var re;
      try { re = new RegExp(state.pat, state.i ? "gi" : "g"); }
      catch (e) {
        readout.appendChild(ro("status", "invalid pattern"));
        readout.appendChild(roLine("grep: the pattern does not compile. Check unbalanced brackets or parentheses."));
        return;
      }
      if (state.pat === "") {
        readout.appendChild(roLine("An empty pattern matches every line. Type something to filter."));
      }
      var out = h("pre", { style: PRE });
      var count = 0;
      for (var i = 0; i < LOG.length; i++) {
        var line = LOG[i];
        re.lastIndex = 0;
        var hit = re.test(line);
        if (hit === state.v) continue;
        count++;
        if (state.v || state.pat === "") { out.appendChild(document.createTextNode(line + "\n")); continue; }
        re.lastIndex = 0;
        var last = 0, m, guard = 0;
        while ((m = re.exec(line)) && guard++ < 50) {
          if (m[0] === "") { re.lastIndex++; continue; }
          out.appendChild(document.createTextNode(line.slice(last, m.index)));
          out.appendChild(h("b", { style: "color:var(--accent-ink);text-decoration:underline" }, "[" + m[0] + "]"));
          last = m.index + m[0].length;
        }
        out.appendChild(document.createTextNode(line.slice(last) + "\n"));
      }
      if (!count) out.appendChild(document.createTextNode("(no lines selected; grep would exit with status 1)"));
      stage.appendChild(out);
      readout.appendChild(ro("lines selected", count + " / " + LOG.length));
      readout.appendChild(ro("exit status", count ? 0 : 1));
      readout.appendChild(roLine(state.v ? "-v inverts the selection: it prints lines that do NOT match." :
        "In basic grep (no -E), + ? | { } and ( ) need backslashes; with -E they work as written. -P is GNU only and missing from macOS grep."));
    }

    var presetPairs = [];
    for (var p = 0; p < PRESETS.length; p++) presetPairs.push([PRESETS[p][0], PRESETS[p][1]]);
    mount.appendChild(h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, "pattern", inp),
      toggle("-i", "i"), toggle("-v", "v")));
    mount.appendChild(h("div", { class: "widget-controls" },
      segment(presetPairs, 0, function (v) { state.pat = v; inp.value = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. textPipeline — build a log-analysis pipeline stage by stage
  ================================================================== */
  var ACCESS = [
    "192.0.2.10 - - [28/Oct/2026:09:00:01] \"GET /api/orders HTTP/1.1\" 200 512",
    "198.51.100.7 - - [28/Oct/2026:09:00:02] \"GET /api/orders HTTP/1.1\" 500 98",
    "192.0.2.10 - - [28/Oct/2026:09:00:03] \"POST /api/cart HTTP/1.1\" 201 77",
    "203.0.113.5 - - [28/Oct/2026:09:00:04] \"GET /api/pay HTTP/1.1\" 502 40",
    "198.51.100.7 - - [28/Oct/2026:09:00:05] \"GET /api/orders HTTP/1.1\" 500 98",
    "192.0.2.10 - - [28/Oct/2026:09:00:06] \"GET /health HTTP/1.1\" 200 2",
    "198.51.100.7 - - [28/Oct/2026:09:00:07] \"GET /api/pay HTTP/1.1\" 503 40",
    "203.0.113.5 - - [28/Oct/2026:09:00:08] \"GET /api/orders HTTP/1.1\" 200 512"
  ];
  var STAGES = [
    { id: "grep", cmd: "grep -E '\" 5[0-9]{2} '", desc: "keep 5xx responses",
      fn: function (L) { return L.filter(function (l) { return / 5\d\d /.test(l); }); } },
    { id: "awk", cmd: "awk '{print $1}'", desc: "keep field 1, the client IP",
      fn: function (L) { return L.map(function (l) { return l.split(/\s+/)[0]; }); } },
    { id: "sort", cmd: "sort", desc: "group identical lines together",
      fn: function (L) { return L.slice().sort(); } },
    { id: "uniq", cmd: "uniq -c", desc: "count adjacent duplicates",
      fn: function (L) {
        var out = [], prev = null, n = 0;
        for (var i = 0; i <= L.length; i++) {
          if (i < L.length && L[i] === prev) { n++; continue; }
          if (prev !== null) out.push(("      " + n).slice(-7) + " " + prev);
          if (i < L.length) { prev = L[i]; n = 1; }
        }
        return out;
      } },
    { id: "rank", cmd: "sort -rn", desc: "highest count first",
      fn: function (L) { return L.slice().sort(function (a, b) { return parseInt(b, 10) - parseInt(a, 10) || (a < b ? -1 : 1); }); } },
    { id: "head", cmd: "head -n 2", desc: "top two",
      fn: function (L) { return L.slice(0, 2); } }
  ];

  Widgets.textPipeline = function (mount) {
    shell(mount, "builder", "Which client is causing the 5xx errors?",
      "Switch stages on and off. Each stage reads the previous stage's output, exactly like a shell pipeline, so you can see what every command contributes.");
    var on = { grep: true, awk: true, sort: true, uniq: true, rank: true, head: false };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var controls = h("div", { class: "widget-controls" });
    STAGES.forEach(function (s) {
      var b = h("button", { type: "button", class: "w-btn" + (on[s.id] ? " primary" : " ghost") }, s.cmd);
      b.addEventListener("click", function () {
        on[s.id] = !on[s.id];
        b.className = "w-btn" + (on[s.id] ? " primary" : " ghost");
        paint();
      });
      controls.appendChild(b);
    });
    function paint() {
      try {
        clear(stage); clear(readout);
        var parts = ["cat access.log"], data = ACCESS.slice(), used = 0;
        stage.appendChild(label("input: access.log (" + ACCESS.length + " lines)"));
        for (var i = 0; i < STAGES.length; i++) {
          var s = STAGES[i];
          if (!on[s.id]) continue;
          data = s.fn(data);
          parts.push(s.cmd);
          used++;
        }
        stage.appendChild(term("$ " + parts.join(" \\\n  | ")));
        stage.appendChild(label("output"));
        stage.appendChild(term(data.length ? data.join("\n") : "(empty)"));
        readout.appendChild(ro("stages", used));
        readout.appendChild(ro("output lines", data.length));
        var hint;
        if (on.uniq && !on.sort) hint = "uniq without sort only merges ADJACENT duplicates, so the counts are split. Turn sort back on.";
        else if (on.rank && !on.uniq) hint = "sort -rn sorts by a leading number; without uniq -c there is no count to rank on.";
        else if (!on.grep) hint = "Without the grep stage you are counting every request, not just failures.";
        else if (on.uniq && on.rank) hint = "198.51.100.7 produced three of the four server errors: start your investigation there.";
        else hint = "Turn on sort, uniq -c and sort -rn for the classic frequency count.";
        readout.appendChild(roLine(hint));
      } catch (e) {
        clear(readout);
        readout.appendChild(roLine("Could not run this pipeline."));
      }
    }
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "text-search": {
      title: "Search checkpoint",
      sub: "grep, ripgrep, find and xargs.",
      questions: [
        {
          q: "Which command searches recursively for the literal string `a.b*c`, with no regex interpretation?",
          options: ["grep -r 'a.b*c' .", "grep -rF 'a.b*c' .", "grep -rE 'a.b*c' .", "grep -rw 'a.b*c' ."],
          answer: 1,
          explain: "-F treats the pattern as a fixed string, so the dot and asterisk are matched literally. Without it, the dot matches any character and the asterisk repeats the b. Fixed-string search is also faster, which matters on large trees."
        },
        {
          q: "ripgrep finds nothing in a file you can see in the repository. What is the most likely reason?",
          options: ["rg cannot read UTF-8", "The file is listed in .gitignore or is hidden, and rg skips those by default", "rg only searches the current directory", "rg needs -E for regexes"],
          answer: 1,
          explain: "ripgrep respects ignore files and skips hidden and binary files unless told otherwise. Use --hidden, --no-ignore or -uu to widen the search. These defaults are why it is fast in code repositories, but they surprise people searching build output or dotfiles."
        },
        {
          q: "You want to delete every .tmp file under a tree whose names may contain spaces. Which is safe?",
          options: ["rm $(find . -name '*.tmp')", "find . -name '*.tmp' | xargs rm", "find . -name '*.tmp' -print0 | xargs -0 rm --", "ls -R | grep .tmp | xargs rm"],
          answer: 2,
          explain: "NUL is the one byte that cannot appear in a path, so -print0 with xargs -0 keeps every name intact. The other forms split names on whitespace and can delete the wrong files. find . -name '*.tmp' -delete is an even simpler alternative."
        },
        {
          q: "What is the difference between `find . -exec cmd {} \\;` and `find . -exec cmd {} +`?",
          options: ["None", "The first runs cmd once per file; the second passes many files per invocation", "The second runs commands in parallel", "The first only works on directories"],
          answer: 1,
          explain: "With a semicolon, find forks the command for every match, which is slow on big trees. With a plus, it batches as many paths as fit on a command line, like xargs. Use the batching form unless the command can only take one file."
        },
        {
          q: "On macOS, `find . -mtime -1 -printf '%p\\n'` fails. Why?",
          options: ["-mtime does not exist on BSD find", "-printf is a GNU extension that BSD find lacks", "find needs sudo on macOS", "The quotes are wrong"],
          answer: 1,
          explain: "BSD find on macOS supports -mtime but not -printf. Use -print, pipe into stat -f for custom formats, or install GNU findutils with Homebrew and call gfind. Scripts that must run on both systems should avoid GNU-only flags."
        },
        {
          q: "`xargs -P 4 -n 1` does what?",
          options: ["Prints four lines at a time", "Runs up to four command invocations in parallel, one argument each", "Retries failures four times", "Limits input to four arguments in total"],
          answer: 1,
          explain: "-n 1 passes a single argument to each invocation and -P 4 keeps up to four running at once. It is a quick way to parallelise independent work such as compressing files or probing hosts. Output from parallel jobs can interleave, so capture per-job output if it matters."
        }
      ]
    },
    "text-transform": {
      title: "Transform checkpoint",
      sub: "sed, awk, cut, sort, uniq and jq.",
      questions: [
        {
          q: "Which sed invocation edits a file in place on BOTH macOS and Linux?",
          options: ["sed -i 's/a/b/' f", "sed -i '' 's/a/b/' f", "sed -i.bak 's/a/b/' f", "sed --in-place 's/a/b/' f"],
          answer: 2,
          explain: "GNU sed treats the suffix after -i as optional, while BSD sed requires an argument. An attached suffix such as -i.bak is accepted by both and leaves a backup you can delete afterwards. sed -i '' only works on BSD; plain -i only on GNU."
        },
        {
          q: "`awk -F, '$3 > 100 {print $1}' sales.csv` prints what?",
          options: ["Lines containing the text > 100", "Column 1 of every row whose third comma-separated field is greater than 100", "The first 100 lines", "The sum of column 3"],
          answer: 1,
          explain: "-F, sets the field separator to a comma, the pattern $3 > 100 selects rows numerically, and the action prints field 1. A header row compares as a string, so add NR > 1 if the file has one. Quoted CSV fields containing commas need a real CSV parser."
        },
        {
          q: "Why does `uniq -c` sometimes report the same value on several lines?",
          options: ["uniq is case-sensitive", "uniq only collapses adjacent duplicates, so unsorted input splits the counts", "uniq ignores the last line", "-c counts characters"],
          answer: 1,
          explain: "uniq compares each line only with the previous one. Sorting first brings identical lines together so each value is counted once. sort | uniq -c | sort -rn is the standard frequency count; sort -u alone deduplicates without counts."
        },
        {
          q: "Which jq filter prints the name of every item whose status is failed, one per line and without quotes?",
          options: ["jq '.items | name'", "jq -r '.items[] | select(.status == \"failed\") | .name'", "jq '.items[status=failed].name'", "jq -c '.items.name'"],
          answer: 1,
          explain: ".items[] iterates the array, select keeps elements where the condition is true, and .name extracts the field. -r prints raw strings instead of JSON-encoded ones, which is what you want when feeding the result to another shell command."
        },
        {
          q: "`sort -k2,2n data.txt` sorts by what?",
          options: ["The whole line numerically", "Field 2 only, numerically", "Fields 2 onwards as text", "The second character"],
          answer: 1,
          explain: "-k2,2 limits the key to field 2 alone, and the n modifier compares numerically. Writing -k2 without the end position uses field 2 through the end of the line, a common source of odd orderings. Add -t to choose a separator other than whitespace."
        },
        {
          q: "A sed command `s/\\/var\\/log/\\/data\\/log/g` is hard to read. What is the cleanest fix?",
          options: ["Use awk instead", "Use a different delimiter: s|/var/log|/data/log|g", "Escape fewer slashes", "Wrap it in double quotes"],
          answer: 1,
          explain: "sed accepts any character as the delimiter for the s command, so a pipe or hash avoids escaping every slash in a path. The result is easier to read and review. The same trick works for the address syntax, written as \\|pattern|."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.text = {
    id: "text",
    name: "Text Processing",
    short: "TEXT",
    tagline: "Find, slice and reshape text from the command line",
    color: "#38bdf8",
    blurb: "Logs, configs and API output are all text. Search them with grep and ripgrep, locate files with find, fan out work with xargs, and reshape streams with sed, awk, cut, sort, uniq and jq, with the GNU versus BSD differences you hit on a Mac.",
    modules: [
      {
        id: "search",
        name: "Searching",
        icon: "compass",
        lessons: [
          {
            id: "grep-rg",
            title: "grep and ripgrep",
            summary: "Regex flavours, the flags you use daily, context lines, and when ripgrep is the better tool.",
            minutes: 10,
            tags: ["grep", "ripgrep", "regex"],
            blocks: [
              { t: "p", html: "<code>grep</code> prints lines that match a pattern. That is its whole job, and it does it fast enough to scan gigabytes of logs. Knowing three regex flavours and a dozen flags covers nearly every search you will run." },
              { t: "h", text: "Three regex flavours" },
              { t: "table", headers: ["Mode", "Flag", "Notes"], rows: [
                ["Basic (BRE)", "default", "<code>+ ? | { } ( )</code> are literal unless backslashed"],
                ["Extended (ERE)", "<code>-E</code> (egrep)", "Metacharacters work as written; use this by default"],
                ["Fixed string", "<code>-F</code> (fgrep)", "No regex at all; fastest, safest for user input"],
                ["Perl (PCRE)", "<code>-P</code>", "Lookarounds, \\d; GNU grep only, absent on macOS"]
              ] },
              { t: "widget", id: "textRegex" },
              { t: "h", text: "Flags worth memorising" },
              { t: "code", lang: "bash", code: "grep -rn 'listen' /etc/nginx/          # recursive, with line numbers\ngrep -i 'timeout' app.log              # case-insensitive\ngrep -v '^#' sshd_config | grep -v '^$'   # drop comments and blank lines\ngrep -c ' 500 ' access.log             # count matching lines\ngrep -o 'user=[a-z]*' app.log          # print only the matched part\ngrep -C 3 'panic' app.log              # 3 lines of context (-A after, -B before)\ngrep -l 'TODO' -r src/                 # file names only\ngrep -w 'id' schema.sql                # whole words: not 'uuid'" },
              { t: "note", variant: "tip", html: "<code>grep -q</code> prints nothing and just sets the exit status: perfect in <code>if grep -q ...; then</code>. Exit 0 means a match, 1 means none, 2 means an error such as a missing file." },
              { t: "h", text: "ripgrep" },
              { t: "p", html: "<code>rg</code> is a modern grep: recursive by default, multithreaded, and it skips files in <code>.gitignore</code>, hidden files and binaries. In a code repository it is usually far faster and less noisy." },
              { t: "code", lang: "bash", code: "rg 'fetchOrders' -t js           # only JavaScript files\nrg -g '!*.min.js' 'apiKey'       # exclude a glob\nrg --hidden -uu 'PermitRootLogin' /etc   # search everything, ignores off\nrg -l 'deprecated' | xargs rg -c 'deprecated'" },
              { t: "note", variant: "warn", html: "macOS ships BSD grep. It supports <code>-E</code>, <code>-o</code> and context flags, but not <code>-P</code>, and some GNU long options differ. <code>brew install grep</code> installs GNU grep as <code>ggrep</code>." },
              { t: "cue", html: "<b>In the field:</b> when a grep across logs returns nothing, check you are not searching compressed rotations. <code>zgrep</code> or <code>rg -z</code> read <code>.gz</code> files directly." },
              { t: "note", variant: "key", html: "Use grep -E for regexes, -F for literal strings, -q in conditions; reach for rg in code trees and remember -P is GNU only." }
            ]
          },
          {
            id: "find",
            title: "find: locate files by any attribute",
            summary: "Tests for name, type, size, time and permissions, actions like -delete and -exec, and BSD versus GNU find.",
            minutes: 9,
            tags: ["find", "files"],
            blocks: [
              { t: "p", html: "<code>find</code> walks a directory tree and evaluates an expression for every entry. The expression is a chain of tests (does this match?) and actions (do this), joined by an implicit AND." },
              { t: "code", lang: "bash", code: "find /var/log -name '*.log' -size +100M          # big logs\nfind . -type f -mtime -1                          # modified in the last 24 hours\nfind /srv -type d -name node_modules -prune -o -type f -name '*.js' -print\nfind /tmp -type f -mmin +120 -user deploy -delete # old temp files of one user\nfind / -xdev -type f -perm -4000 2>/dev/null      # SUID files on the root filesystem" },
              { t: "table", headers: ["Test", "Meaning"], rows: [
                ["<code>-name / -iname</code>", "Glob on the base name (quote it!)"],
                ["<code>-path</code>", "Glob on the whole path"],
                ["<code>-type f|d|l</code>", "Regular file, directory, symlink"],
                ["<code>-size +10M</code>", "Bigger than 10 MiB (k, M, G suffixes)"],
                ["<code>-mtime -7</code>", "Modified less than 7 days ago (+7 = more than)"],
                ["<code>-newer ref</code>", "Modified after file ref"],
                ["<code>-perm -0002</code>", "World-writable bit set"],
                ["<code>-xdev</code>", "Do not cross into other filesystems"]
              ] },
              { t: "note", variant: "trap", html: "Always quote the pattern: <code>find . -name '*.log'</code>. Unquoted, the shell may expand <code>*.log</code> against the current directory first and find receives the wrong arguments." },
              { t: "h", text: "Acting on results" },
              { t: "ul", items: [
                "<code>-print</code> is the default action; <code>-print0</code> separates with NUL for safe piping.",
                "<code>-delete</code> removes matches (put it last; it implies depth-first).",
                "<code>-exec cmd {} +</code> batches paths; <code>-exec cmd {} \\;</code> runs once per file.",
                "<code>-ok</code> is like <code>-exec</code> but asks for confirmation."
              ] },
              { t: "note", variant: "warn", html: "Test before you delete: run the same expression with <code>-print</code>, read the list, then swap in <code>-delete</code>. Operator order matters; <code>-delete</code> before a test applies to everything." },
              { t: "h", text: "macOS notes" },
              { t: "p", html: "BSD find requires a starting path (<code>find .</code>, not bare <code>find</code>), lacks <code>-printf</code>, and spells some options differently. <code>mdfind</code> queries the Spotlight index instead of walking the disk, and <code>brew install findutils</code> adds GNU <code>gfind</code>." },
              { t: "cue", html: "<b>In the field:</b> <code>find / -xdev -type f -size +1G -exec ls -lh {} +</code> is the quickest way to spot the file that just filled a disk." },
              { t: "note", variant: "key", html: "find evaluates tests and actions left to right per entry; quote patterns, print before deleting, and batch with -exec {} +." }
            ]
          },
          {
            id: "xargs",
            title: "xargs: turning output into arguments",
            summary: "Why xargs exists, NUL-safe input, placeholders, batching and parallel runs.",
            minutes: 8,
            tags: ["xargs", "parallel"],
            blocks: [
              { t: "p", html: "Many commands read arguments, not stdin: <code>rm</code>, <code>kill</code>, <code>ssh-keygen -R</code>. <code>xargs</code> reads items from stdin and appends them to a command line, splitting into several runs if the list exceeds the kernel's argument size limit." },
              { t: "code", lang: "bash", code: "# Safe for any file name\nfind . -name '*.orig' -print0 | xargs -0 rm --\n\n# One host per invocation, replace a placeholder\nprintf '%s\\n' web1 web2 web3 | xargs -I{} ssh {}.lab.example uptime\n\n# Four parallel workers, one file each\nls *.log | xargs -P 4 -n 1 gzip\n\n# Show the command before running it\nprintf '%s\\n' a b | xargs -t -n 1 echo" },
              { t: "table", headers: ["Flag", "Effect"], rows: [
                ["<code>-0</code>", "Items are NUL-separated (pair with -print0)"],
                ["<code>-n N</code>", "At most N arguments per run"],
                ["<code>-I{}</code>", "Replace {} with each item (implies one per run)"],
                ["<code>-P N</code>", "Run up to N processes in parallel"],
                ["<code>-r</code>", "Do not run if input is empty (GNU; BSD does this by default)"],
                ["<code>-t</code>", "Print each command to stderr before running"]
              ] },
              { t: "note", variant: "trap", html: "Default xargs splits on any whitespace and treats quotes and backslashes specially. A file named <code>Q3 report.pdf</code> becomes two arguments. Use <code>-0</code> whenever the input is file names." },
              { t: "h", text: "xargs or a loop?" },
              { t: "compare", bad: { title: "Slow on 50,000 files", items: ["for f in $(find ...); do rm \"$f\"; done", "One process per file, and the $(...) splits on spaces"] }, good: { title: "Fast and safe", items: ["find ... -print0 | xargs -0 rm", "find ... -delete when find can do it alone"] } },
              { t: "note", variant: "tip", html: "On GNU systems, an empty input still runs the command once unless you add <code>-r</code>; <code>xargs rm</code> with no input then errors. BSD xargs on macOS already skips empty input." },
              { t: "cue", html: "<b>In the field:</b> <code>pgrep -f 'worker --queue=old' | xargs -r kill</code> stops a group of processes by command line, and does nothing if none match." },
              { t: "h", text: "Safe and parallel" },
              { t: "code", lang: "bash", code: "# Names with spaces or newlines: always pair -print0 with -0\nfind /var/log/app -name '*.log' -mtime +7 -print0 | xargs -0 -r gzip -9\n\n# Dry run first: print the commands instead of running them\nfind . -name '*.tmp' -print0 | xargs -0 -r echo rm --\n\n# Four at a time, one argument each\nprintf '%s\\n' web1 web2 web3 web4 | xargs -P4 -I{} ssh {}.lab.example uptime" },
              { t: "note", variant: "tip", html: "BSD xargs on macOS has no <code>-r</code> (it already skips empty input in most cases) and no long options. <code>brew install findutils</code> provides GNU <code>gxargs</code> and <code>gfind</code>." },
              { t: "quiz", id: "text-search" },
              { t: "note", variant: "key", html: "xargs turns a stream into argument lists; feed it NUL-separated input, cap with -n, parallelise with -P and preview with -t." }
            ]
          }
        ]
      },
      {
        id: "transform",
        name: "Transforming",
        icon: "wrench",
        lessons: [
          {
            id: "sed",
            title: "sed: stream editing",
            summary: "Substitution, addresses, deletion and printing, in-place editing, and the BSD sed -i trap on macOS.",
            minutes: 10,
            tags: ["sed", "regex", "macOS"],
            blocks: [
              { t: "p", html: "<code>sed</code> reads input line by line into a pattern space, applies a script of commands, and prints the result. Most real use is one command: substitute." },
              { t: "code", lang: "bash", code: "sed 's/http:/https:/' urls.txt          # first match on each line\nsed 's/foo/bar/g' f                     # every match\nsed -E 's/([0-9]+)ms/\\1 ms/g' app.log    # capture group (ERE)\nsed -n '/ERROR/p' app.log                # print only matching lines\nsed '/^#/d; /^$/d' sshd_config           # delete comments and blanks\nsed -n '10,20p' big.log                  # lines 10-20\nsed '1i\\\n# generated, do not edit' conf.ini   # insert a header line\nsed 's|/var/log|/data/log|g' paths.txt   # any delimiter avoids escaping /" },
              { t: "h", text: "Addresses" },
              { t: "table", headers: ["Address", "Selects"], rows: [
                ["<code>5</code>", "Line 5"],
                ["<code>$</code>", "The last line"],
                ["<code>/re/</code>", "Lines matching the regex"],
                ["<code>/start/,/end/</code>", "From a start match through the next end match"],
                ["<code>!</code> after an address", "Every line NOT selected"]
              ] },
              { t: "h", text: "In-place editing: the macOS trap" },
              { t: "table", headers: ["Goal", "GNU sed (Linux)", "BSD sed (macOS)"], rows: [
                ["Edit in place, no backup", "<code>sed -i 's/a/b/' f</code>", "<code>sed -i '' 's/a/b/' f</code>"],
                ["Edit with backup", "<code>sed -i.bak 's/a/b/' f</code>", "<code>sed -i.bak 's/a/b/' f</code>"],
                ["Extended regex", "<code>-E</code> or <code>-r</code>", "<code>-E</code>"],
                ["\\n in replacement", "Works", "Needs a literal backslash-newline"]
              ] },
              { t: "note", variant: "trap", html: "On macOS, <code>sed -i 's/a/b/' f</code> treats <code>s/a/b/</code> as the backup suffix and the file name as the script, failing with a confusing error. Use <code>-i.bak</code> for portable scripts or <code>brew install gnu-sed</code> for <code>gsed</code>." },
              { t: "note", variant: "warn", html: "<code>sed -i</code> replaces the file with a new one. It breaks hard links and can change ownership; for config under configuration management, edit the source template instead." },
              { t: "cue", html: "<b>In the field:</b> preview first with <code>sed 's/old/new/g' f | diff f -</code>, then rerun with <code>-i.bak</code> once the diff looks right." },
              { t: "h", text: "Practical recipes" },
              { t: "code", lang: "bash", code: "sed -n '120,140p' app.log                          # print a line range\nsed -n '/BEGIN deploy/,/END deploy/p' app.log       # print between markers\nsed -E 's/(user=)[^ ]+/\\1REDACTED/g' access.log    # mask a field, keep the key\nsed -i.bak 's/^#\\?PasswordAuthentication .*/PasswordAuthentication no/' sshd_config\nsed '/^\\s*#/d; /^\\s*$/d' nginx.conf              # strip comments and blank lines" },
              { t: "note", variant: "warn", html: "<code>sed -i</code> differs: GNU accepts <code>-i</code> alone, BSD sed on macOS needs an argument, so use <code>-i ''</code>. <code>-i.bak</code> works on both and leaves a backup, which is the portable habit." },
              { t: "note", variant: "key", html: "sed s/re/rep/g with an address covers most jobs; use -E, choose a convenient delimiter, and write -i.bak to be portable across GNU and BSD." }
            ]
          },
          {
            id: "awk",
            title: "awk: fields, patterns and aggregation",
            summary: "Records and fields, pattern-action pairs, BEGIN and END, associative arrays and practical log summaries.",
            minutes: 11,
            tags: ["awk", "aggregation"],
            blocks: [
              { t: "p", html: "<code>awk</code> is a small language built for columns. It splits each line (a <b>record</b>) into <b>fields</b> <code>$1</code>..<code>$NF</code>, and runs every <code>pattern { action }</code> pair whose pattern is true." },
              { t: "table", headers: ["Name", "Meaning"], rows: [
                ["<code>$0</code>", "The whole line"],
                ["<code>$1, $2, $NF</code>", "First, second, last field"],
                ["<code>NR</code>", "Record number across all input"],
                ["<code>NF</code>", "Number of fields on this line"],
                ["<code>FS / -F</code>", "Input field separator (default: runs of whitespace)"],
                ["<code>OFS</code>", "Output separator used by print a, b"]
              ] },
              { t: "code", lang: "bash", code: "# Column 1 of an access log: client IP\nawk '{print $1}' access.log\n\n# Requests slower than 1s (response time is the last field, in ms)\nawk '$NF > 1000 {print $7, $NF \"ms\"}' access.log\n\n# Bytes per status code (status $9, bytes $10)\nawk '{bytes[$9] += $10} END {for (s in bytes) print s, bytes[s]}' access.log\n\n# Average, guarding against empty input\nawk '{sum += $NF; n++} END {if (n) printf \"avg %.1f ms over %d\\n\", sum/n, n}' times.log\n\n# CSV with a header: skip it, filter on a column\nawk -F, 'NR > 1 && $3 == \"failed\" {print $1}' jobs.csv" },
              { t: "note", variant: "tip", html: "Single-quote the program so the shell leaves <code>$1</code> alone. Pass shell values in with <code>-v</code>: <code>awk -v limit=\"$MAX\" '$NF &gt; limit' f</code>." },
              { t: "h", text: "Arrays are hash maps" },
              { t: "p", html: "awk arrays are associative: any string can be a key. That makes group-by, distinct counts and joins one-liners. Iteration order with <code>for (k in a)</code> is unspecified, so pipe into <code>sort</code> when order matters." },
              { t: "code", lang: "bash", code: "# Distinct users per endpoint\nawk '{seen[$7 FS $3]++} END {for (k in seen) {split(k, p, FS); c[p[1]]++} for (e in c) print c[e], e}' access.log | sort -rn\n\n# Join: print orders with the customer name from a second file\nawk 'NR == FNR {name[$1] = $2; next} {print $0, name[$2]}' customers.txt orders.txt" },
              { t: "note", variant: "warn", html: "macOS ships the one true awk (BWK awk); Linux usually has gawk or mawk. Core syntax is the same, but gawk extras such as <code>strftime</code>, <code>gensub</code> and <code>asort</code> are missing on a Mac unless you <code>brew install gawk</code>." },
              { t: "cue", html: "<b>In the field:</b> before writing a Python script for a quick log question, try one awk line. Most \"how many, how big, which one\" questions fit." },
              { t: "note", variant: "key", html: "awk = pattern { action } over fields; associative arrays plus END give you group-by and joins in one line." }
            ]
          },
          {
            id: "cut-sort-uniq",
            title: "cut, sort, uniq and friends",
            summary: "Slicing columns, sorting by keys, counting duplicates, and composing them into frequency tables.",
            minutes: 9,
            tags: ["sort", "uniq", "cut", "pipelines"],
            blocks: [
              { t: "p", html: "Small single-purpose tools combine into answers. <code>cut</code> picks columns, <code>sort</code> orders and groups, <code>uniq</code> collapses and counts, <code>head</code> and <code>wc</code> summarise." },
              { t: "widget", id: "textPipeline" },
              { t: "h", text: "The pieces" },
              { t: "code", lang: "bash", code: "cut -d: -f1,7 /etc/passwd          # user and shell, colon separated\ncut -c1-19 app.log                 # first 19 characters (a timestamp)\nsort -t, -k3,3nr sales.csv         # field 3, numeric, descending\nsort -u ips.txt                    # sort and deduplicate\nsort -h sizes.txt                  # human sizes: 2K < 1M < 3G\nuniq -c                            # count adjacent duplicates\nuniq -d                            # only lines that repeat\ncomm -12 <(sort a) <(sort b)       # lines in both files\npaste -d, names.txt ages.txt       # glue files side by side\ntr -s ' ' < f                      # squeeze runs of spaces\nwc -l < f                          # line count without the file name" },
              { t: "note", variant: "trap", html: "<code>cut -d' '</code> treats every single space as a separator, so aligned columns with several spaces produce empty fields. Use <code>awk '{print $3}'</code> (or <code>tr -s ' '</code> first) for whitespace-aligned output like <code>ps</code> or <code>df</code>." },
              { t: "h", text: "Sorting gotchas" },
              { t: "ul", items: [
                "<code>-k2</code> means field 2 <i>to the end of the line</i>; write <code>-k2,2</code> for just field 2.",
                "Plain sort is lexical, so 10 sorts before 9; add <code>n</code> for numbers or <code>h</code> for sizes.",
                "Locale affects order and speed; <code>LC_ALL=C sort</code> sorts by byte value and is much faster on large files.",
                "<code>sort -h</code> and <code>-V</code> (version sort) exist on recent macOS sort, but older systems lack them."
              ] },
              { t: "code", lang: "bash", code: "# Top 5 most frequent error messages\ngrep ERROR app.log | cut -d' ' -f4- | sort | uniq -c | sort -rn | head -5\n#     412 db timeout after 5000ms\n#      97 upstream 502 from pay-svc\n#      12 cache miss storm" },
              { t: "cue", html: "<b>In the field:</b> memorise <code>sort | uniq -c | sort -rn | head</code>. It answers \"what is most common?\" for any column of any log." },
              { t: "note", variant: "key", html: "cut for fixed delimiters, awk for whitespace columns, sort -k with an end field, and always sort before uniq." }
            ]
          },
          {
            id: "jq",
            title: "jq: JSON on the command line",
            summary: "Paths, iteration, select, map, building objects and arrays, raw output, and practical API and log recipes.",
            minutes: 11,
            tags: ["jq", "JSON", "APIs"],
            blocks: [
              { t: "p", html: "APIs, cloud CLIs and structured logs speak JSON. <code>jq</code> is a filter language for it: each filter takes JSON in and emits JSON out, and filters chain with <code>|</code> just like a shell pipeline." },
              { t: "code", lang: "bash", code: "echo '{\"items\":[{\"name\":\"web1\",\"status\":\"ok\",\"cpu\":12},{\"name\":\"db1\",\"status\":\"failed\",\"cpu\":97}]}' > hosts.json\n\njq '.' hosts.json                         # pretty-print\njq '.items[0].name' hosts.json            # \"web1\"\njq -r '.items[].name' hosts.json          # web1, db1 (raw, one per line)\njq -r '.items[] | select(.status == \"failed\") | .name' hosts.json   # db1\njq '[.items[] | .cpu] | add / length' hosts.json                   # 54.5\njq '.items | map({host: .name, hot: (.cpu > 80)})' hosts.json\njq -r '.items[] | [.name, .status, .cpu] | @tsv' hosts.json        # tab-separated" },
              { t: "table", headers: ["Filter", "Does"], rows: [
                ["<code>.a.b</code>, <code>.a[0]</code>", "Navigate objects and arrays"],
                ["<code>.[]</code>", "Iterate every element (emits many results)"],
                ["<code>select(cond)</code>", "Keep inputs where cond is true"],
                ["<code>map(f)</code>", "Apply f to every array element"],
                ["<code>{k: .x}</code>, <code>[ ... ]</code>", "Build new objects and arrays"],
                ["<code>length, keys, add, sort_by(.f), group_by(.f)</code>", "Common built-ins"],
                ["<code>// \"default\"</code>", "Fallback when the left side is null or false"],
                ["<code>@csv, @tsv, @base64</code>", "Format strings"]
              ] },
              { t: "note", variant: "tip", html: "Pass shell values with <code>--arg</code> (string) or <code>--argjson</code> (number, object). Never splice a variable into the filter text: <code>jq --arg n \"$HOST\" '.items[] | select(.name == $n)'</code>." },
              { t: "h", text: "Recipes" },
              { t: "code", lang: "bash", code: "# Count by a field\njq -r '.items | group_by(.status) | map(\"\\(.[0].status) \\(length)\") | .[]' hosts.json\n\n# Newline-delimited JSON logs: errors from one service\njq -c 'select(.level == \"error\" and .svc == \"api\") | {ts, msg}' app.ndjson\n\n# Safely edit a config file\njq '.replicas = 3' deploy.json > deploy.json.new && mv deploy.json.new deploy.json" },
              { t: "note", variant: "trap", html: "Without <code>-r</code>, strings keep their JSON quotes, so <code>for h in $(jq '.items[].name' f)</code> gives you <code>\"web1\"</code> with quotes. Use <code>-r</code> whenever output feeds a shell command." },
              { t: "cue", html: "<b>In the field:</b> when an API response is huge, start with <code>jq 'keys'</code> or <code>jq '.items[0]'</code> to learn the shape before writing the real filter." },
              { t: "h", text: "Recipes for logs and APIs" },
              { t: "code", lang: "bash", code: "# Structured log lines: count errors by service\njq -r 'select(.level==\"error\") | .service' app.jsonl | sort | uniq -c | sort -rn\n\n# Turn an API array into TSV for awk or a spreadsheet\ncurl -s https://api.shop.example/v1/hosts | jq -r '.items[] | [.name, .ip, .state] | @tsv'\n\n# Safely edit a JSON file (jq has no -i)\njq '.replicas = 3' deploy.json > deploy.json.new && mv deploy.json.new deploy.json" },
              { t: "note", variant: "tip", html: "jq behaves identically on macOS and Linux. Recent macOS releases include it at <code>/usr/bin/jq</code>, and <code>brew install jq</code> works on older ones." },
              { t: "quiz", id: "text-transform" },
              { t: "note", variant: "key", html: "jq filters chain with |; iterate with .[], filter with select, reshape with map and {}, and use -r and --arg at the shell boundary." }
            ]
          }
        ]
      }
    ]
  };
})();

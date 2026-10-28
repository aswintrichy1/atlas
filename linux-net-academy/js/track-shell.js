/* =====================================================================
   KERNEL · Shell & Command Line
   window.TRACKS.shell — modules: basics / scripting

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
  function term(text) {
    return h("pre", {
      style: "margin:0;padding:12px 14px;border-radius:10px;background:var(--surface-solid);color:var(--text);" +
        "border:1px solid var(--line);font-family:var(--font-mono);font-size:0.8rem;line-height:1.55;white-space:pre-wrap;overflow-x:auto"
    }, text);
  }
  function label(text) {
    return h("div", { style: "font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-faint);margin:10px 0 4px" }, text);
  }

  var Widgets = {};

  /* ==================================================================
     1. shellRedirect — where do stdout and stderr end up?
  ================================================================== */
  var OUT = ["/etc/ssh/sshd_config", "/etc/resolv.conf", "/etc/sysctl.conf"];
  var ERR = ["find: '/etc/sudoers.d': Permission denied", "find: '/etc/ssl/private': Permission denied"];
  var FORMS = [
    { id: "none", label: "(none)", suffix: "", out: "tty", err: "tty",
      why: "With no redirection both descriptors inherit the terminal, so results and errors interleave on screen." },
    { id: "gt", label: "> out.txt", suffix: " > out.txt", out: "out.txt", err: "tty",
      why: "> rewires only fd 1. Errors still reach the terminal on fd 2, which is usually what you want." },
    { id: "err", label: "2> err.txt", suffix: " 2> err.txt", out: "tty", err: "err.txt",
      why: "2> rewires fd 2. Results stay on screen while the permission errors are saved separately." },
    { id: "both", label: "> out.txt 2>&1", suffix: " > out.txt 2>&1", out: "out.txt", err: "out.txt",
      why: "Left to right: fd 1 goes to out.txt, then fd 2 is made a copy of fd 1, so both land in the file." },
    { id: "wrong", label: "2>&1 > out.txt", suffix: " 2>&1 > out.txt", out: "out.txt", err: "tty",
      why: "Order matters: fd 2 copies fd 1 while fd 1 is still the terminal, then fd 1 moves to the file. Errors stay on screen." },
    { id: "amp", label: "&> all.txt", suffix: " &> all.txt", out: "all.txt", err: "all.txt",
      why: "&> is bash and zsh shorthand for > file 2>&1. It is not POSIX sh, so avoid it in #!/bin/sh scripts." },
    { id: "null", label: "2>/dev/null | wc -l", suffix: " 2>/dev/null | wc -l", out: "pipe", err: "null",
      why: "Errors are discarded and only stdout enters the pipe, so wc counts real matches. A pipe carries fd 1 only." }
  ];

  Widgets.shellRedirect = function (mount) {
    shell(mount, "simulator", "Route stdout and stderr",
      "The command prints three matches on stdout and two permission errors on stderr. Pick a redirection and see where each line lands.");
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var pairs = [];
    for (var i = 0; i < FORMS.length; i++) pairs.push([FORMS[i].id, FORMS[i].label]);

    function paint(id) {
      try {
        var f = FORMS[0];
        for (var j = 0; j < FORMS.length; j++) if (FORMS[j].id === id) f = FORMS[j];
        var screen = [], files = {};
        function put(target, lines) {
          if (target === "tty") screen = screen.concat(lines);
          else if (target === "null" || target === "pipe") return;
          else files[target] = (files[target] || []).concat(lines);
        }
        put(f.out, OUT);
        put(f.err, ERR);
        if (f.out === "pipe") screen.push(String(OUT.length));
        clear(stage);
        stage.appendChild(label("Command"));
        stage.appendChild(term("$ find /etc -name '*.conf'" + f.suffix));
        stage.appendChild(label("Terminal"));
        stage.appendChild(term(screen.length ? screen.join("\n") : "(nothing printed)"));
        var names = Object.keys(files);
        for (var n = 0; n < names.length; n++) {
          stage.appendChild(label("File " + names[n]));
          stage.appendChild(term(files[names[n]].join("\n")));
        }
        clear(readout);
        var where = function (t) { return t === "tty" ? "terminal" : t === "null" ? "/dev/null" : t === "pipe" ? "pipe into wc" : t; };
        readout.appendChild(ro("fd 1 (stdout) →", where(f.out)));
        readout.appendChild(ro("fd 2 (stderr) →", where(f.err)));
        readout.appendChild(roLine(f.why));
      } catch (e) {
        clear(readout);
        readout.appendChild(roLine("Could not render this redirection."));
      }
    }
    mount.appendChild(h("div", { class: "widget-controls" }, segment(pairs, 0, paint)));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint("none");
  };

  /* ==================================================================
     2. shellExpansion — step through the expansion pipeline
  ================================================================== */
  var EXP = [
    { id: "unq", label: "unquoted var", line: "rm $file",
      env: "file='my report.txt'",
      steps: [["parameter", "rm my report.txt"], ["word splitting", "rm | my | report.txt"], ["globbing", "rm | my | report.txt"]],
      argv: ["rm", "my", "report.txt"],
      verdict: "Three words: rm tries to delete 'my' and 'report.txt'. Quote it: rm \"$file\"." },
    { id: "q", label: "quoted var", line: "rm \"$file\"",
      env: "file='my report.txt'",
      steps: [["parameter", "rm \"my report.txt\""], ["word splitting", "(skipped inside double quotes)"], ["quote removal", "rm | my report.txt"]],
      argv: ["rm", "my report.txt"],
      verdict: "Double quotes keep the value as one argument. This is the default you want for every expansion." },
    { id: "glob", label: "glob", line: "ls *.log",
      env: "directory holds app.log, db.log, notes.txt",
      steps: [["globbing", "ls app.log db.log"]],
      argv: ["ls", "app.log", "db.log"],
      verdict: "The shell expands the pattern before ls runs; ls never sees the asterisk." },
    { id: "noglob", label: "glob, no match", line: "ls *.csv",
      env: "no .csv files exist",
      steps: [["globbing (bash)", "ls *.csv   (left as a literal)"], ["globbing (zsh)", "zsh: no matches found: *.csv"]],
      argv: ["ls", "*.csv"],
      verdict: "bash passes the literal pattern (ls then says No such file). zsh, the macOS default, aborts the command. bash's nullglob option expands it to nothing." },
    { id: "brace", label: "brace", line: "mkdir -p app/{logs,tmp,cache}",
      env: "(no variables needed)",
      steps: [["brace", "mkdir -p app/logs app/tmp app/cache"]],
      argv: ["mkdir", "-p", "app/logs", "app/tmp", "app/cache"],
      verdict: "Brace expansion is first and purely textual: it does not check whether anything exists." },
    { id: "single", label: "single quotes", line: "echo '$HOME is $(whoami)'",
      env: "HOME=/home/dev",
      steps: [["all expansions", "(none: single quotes are literal)"], ["quote removal", "echo | $HOME is $(whoami)"]],
      argv: ["echo", "$HOME is $(whoami)"],
      verdict: "Nothing expands inside single quotes; use them for regexes, awk programs and jq filters." },
    { id: "cmd", label: "command sub", line: "echo \"today: $(date +%F)\"",
      env: "date prints 2026-10-28",
      steps: [["command substitution", "echo \"today: 2026-10-28\""], ["quote removal", "echo | today: 2026-10-28"]],
      argv: ["echo", "today: 2026-10-28"],
      verdict: "$( ) runs in a subshell and its trailing newlines are stripped. Prefer it over backticks; it nests cleanly." }
  ];

  Widgets.shellExpansion = function (mount) {
    shell(mount, "stepper", "Watch the shell expand a line",
      "Pick an example. The panel shows each expansion stage in order and the final argument vector the program receives; | separates the words.");
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var pairs = [];
    for (var i = 0; i < EXP.length; i++) pairs.push([EXP[i].id, EXP[i].label]);
    function paint(id) {
      try {
        var x = EXP[0];
        for (var j = 0; j < EXP.length; j++) if (EXP[j].id === id) x = EXP[j];
        clear(stage);
        stage.appendChild(label("You type"));
        stage.appendChild(term("$ " + x.line + "\n# context: " + x.env));
        stage.appendChild(label("Stages"));
        var lines = [];
        for (var s = 0; s < x.steps.length; s++) lines.push((s + 1) + ". " + x.steps[s][0] + ":  " + x.steps[s][1]);
        stage.appendChild(term(lines.join("\n")));
        stage.appendChild(label("argv the program receives"));
        var av = [];
        for (var a = 0; a < x.argv.length; a++) av.push("argv[" + a + "] = \"" + x.argv[a] + "\"");
        stage.appendChild(term(av.join("\n")));
        clear(readout);
        readout.appendChild(ro("arguments", x.argv.length));
        readout.appendChild(ro("stages applied", x.steps.length));
        readout.appendChild(roLine(x.verdict));
      } catch (e) {
        clear(readout);
        readout.appendChild(roLine("Could not render this example."));
      }
    }
    mount.appendChild(h("div", { class: "widget-controls" }, segment(pairs, 0, paint)));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint("unq");
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "shell-basics": {
      title: "Shell basics checkpoint",
      sub: "Commands, redirection, expansion and quoting.",
      questions: [
        {
          q: "You run `cmd > all.log 2>&1`. Where do error messages go?",
          options: ["To the terminal", "To all.log, together with normal output", "To /dev/null", "To a file named 1"],
          answer: 1,
          explain: "Redirections are processed left to right. First fd 1 is pointed at all.log, then fd 2 is duplicated from fd 1, so it also points at all.log. Reversing the order would leave stderr on the terminal."
        },
        {
          q: "Which command tells you whether `cd` is a builtin, an alias or a program on PATH?",
          options: ["which cd", "type cd", "whereis cd", "file cd"],
          answer: 1,
          explain: "type is a shell builtin that knows about aliases, functions and builtins as well as PATH. which only searches PATH (and on some systems is an external program that cannot see shell aliases), so it can mislead you."
        },
        {
          q: "A variable holds `my file.txt`. Which form passes it to rm as a single argument?",
          options: ["rm $f", "rm '$f'", "rm \"$f\"", "rm ${f}"],
          answer: 2,
          explain: "Double quotes allow the expansion but stop word splitting and globbing on the result. Single quotes stop the expansion entirely, so rm would look for a file literally named $f. Braces only delimit the name; they do not quote."
        },
        {
          q: "In zsh (the macOS default shell) you run `ls *.csv` in a directory with no CSV files. What happens?",
          options: ["ls lists every file", "ls receives the literal *.csv and prints No such file", "zsh reports no matches found and does not run ls", "The shell expands it to an empty argument list"],
          answer: 2,
          explain: "zsh treats an unmatched glob as an error by default and refuses to run the command. bash instead passes the literal pattern through unless nullglob or failglob is set. This difference trips people moving scripts between a Mac and Linux servers."
        },
        {
          q: "`grep -c error app.log | sort` prints the count, but `$?` afterwards reflects which command?",
          options: ["grep", "sort, the last command in the pipeline", "Whichever failed", "The shell itself"],
          answer: 1,
          explain: "Without pipefail, a pipeline's exit status is the status of its last command. A failing grep earlier in the pipe is hidden. set -o pipefail makes the pipeline fail if any stage fails, and bash also records each stage in the PIPESTATUS array."
        },
        {
          q: "What does `echo {01..03}.txt` print in bash?",
          options: ["{01..03}.txt", "01.txt 02.txt 03.txt", "1.txt 2.txt 3.txt", "Only the files that exist"],
          answer: 1,
          explain: "Brace sequence expansion generates words without looking at the filesystem, and zero-padded endpoints keep their padding in bash 4 and later. It is not a glob, so it does not filter to existing files. bash 3.2 on macOS drops the padding, another reason to install a newer bash."
        }
      ]
    },
    "shell-scripting": {
      title: "Scripting safety checkpoint",
      sub: "Strict mode, functions and traps.",
      questions: [
        {
          q: "Your script has `set -e`, yet it continues after `local out=$(failing_cmd)` inside a function. Why?",
          options: ["set -e does not apply inside functions", "The exit status checked is that of the local builtin, which succeeded", "Command substitution always returns 0", "set -e only checks the last line"],
          answer: 1,
          explain: "local is itself a command, and its own status (success) replaces the substitution's status. Declare first and assign separately: local out; out=$(failing_cmd). The same masking happens with export and readonly."
        },
        {
          q: "Which situation does NOT trigger an exit under `set -e`?",
          options: ["A bare failing command on its own line", "A failing command used as an if condition", "A failing command at the end of a pipeline with pipefail", "A failing command substitution assigned with a plain var=$(cmd)"],
          answer: 1,
          explain: "Commands tested by if, while, until, && and || are exempt, because the script is explicitly handling their status. A plain assignment from a failing substitution does exit, which is why splitting local from the assignment fixes the masking problem."
        },
        {
          q: "What is the best way to guarantee a temp directory is removed however the script ends?",
          options: ["rm -rf at the last line", "trap 'rm -rf \"$tmp\"' EXIT right after mktemp -d", "Create it in /tmp so the OS cleans it", "Use set -u"],
          answer: 1,
          explain: "An EXIT trap runs on normal exit, on set -e failures and after handled signals, so cleanup happens on every path except SIGKILL. A last-line rm is skipped on any early exit. Registering the trap immediately after creation avoids a window where it could leak."
        },
        {
          q: "A function needs to return a list of file names to its caller. What is the idiomatic approach?",
          options: ["return the list as the exit status", "Print the names (one per line, or NUL-separated) and capture with $( ) or mapfile", "Set a global array named RETURN", "Write them to /dev/tty"],
          answer: 1,
          explain: "return only carries a status from 0 to 255. Functions hand data back by writing it to stdout, and the caller captures it. For names that may contain spaces or newlines, emit NUL separators and read them with mapfile -d '' or a while read -d '' loop."
        },
        {
          q: "`set -u` makes `echo \"$1\"` fail when no argument is given. How do you provide a default safely?",
          options: ["echo \"${1:-default}\"", "echo \"$1 || default\"", "set +u globally", "echo \"${1=}\""],
          answer: 0,
          explain: "${1:-default} substitutes default when $1 is unset or empty, and is allowed under set -u. Writing || inside quotes just prints the characters. Turning off -u for the whole script throws away the protection against typos in variable names."
        },
        {
          q: "Why should a script start with `#!/usr/bin/env bash` rather than `#!/bin/bash` when it must run on a Mac and on Linux?",
          options: ["env is faster", "It finds the bash first on PATH, such as a newer Homebrew bash, instead of the old system bash 3.2", "/bin/bash does not exist on Linux", "It enables strict mode automatically"],
          answer: 1,
          explain: "macOS ships bash 3.2 at /bin/bash, which lacks associative arrays, mapfile and other bash 4 features. env bash resolves bash through PATH, picking up a newer version if one is installed. The trade-off is that PATH controls which interpreter runs."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.shell = {
    id: "shell",
    name: "Shell & Command Line",
    short: "SHELL",
    tagline: "How the shell turns a line into processes",
    color: "var(--kn-green)",
    blurb: "Build an exact mental model of bash and zsh: how a command is found, how file descriptors and pipes connect programs, the order of expansions, quoting that never surprises you, and scripts that fail loudly and clean up after themselves.",
    modules: [
      {
        id: "basics",
        name: "Shell fundamentals",
        icon: "compass",
        lessons: [
          {
            id: "bash-basics",
            title: "How the shell runs a command",
            summary: "Prompt, PATH lookup, builtins versus programs, exit status, and the bash versus zsh story on a Mac.",
            minutes: 9,
            tags: ["bash", "zsh", "PATH", "exit status"],
            blocks: [
              { t: "p", html: "A shell is an ordinary program that reads a line, splits it into words, expands them, finds what the first word refers to and runs it. Almost every surprise you will hit later comes from one of those steps, so it pays to know them in order." },
              { t: "h", text: "Finding the command" },
              { t: "p", html: "For the first word the shell checks, in order: aliases, shell functions, builtins, then each directory in <code>PATH</code> from left to right. The first hit wins. Programs found on PATH are cached in a hash table, which is why a newly installed binary sometimes needs <code>hash -r</code> (bash) or <code>rehash</code> (zsh)." },
              { t: "code", lang: "bash", code: "type cd ls ll grep\n# cd is a shell builtin\n# ls is /bin/ls\n# ll is aliased to `ls -alF'\n# grep is /usr/bin/grep\n\necho \"$PATH\" | tr ':' '\\n'   # one directory per line" },
              { t: "note", variant: "tip", html: "Prefer <code>type</code> or <code>command -v</code> over <code>which</code>. They are builtins and know about aliases and functions; <code>which</code> only searches PATH." },
              { t: "h", text: "Builtins must be builtins" },
              { t: "p", html: "Commands like <code>cd</code>, <code>export</code>, <code>read</code> and <code>source</code> change the shell's own state: its working directory, its variables. A separate program cannot do that, because a child process can never modify its parent. That is the reason they are built in, and why <code>sudo cd /root</code> makes no sense." },
              { t: "h", text: "Exit status is the real return value" },
              { t: "p", html: "Every command finishes with a number. <code>0</code> means success; anything from 1 to 255 means some kind of failure. <code>$?</code> holds the last one, and the operators <code>&amp;&amp;</code> and <code>||</code> branch on it." },
              { t: "code", lang: "bash", code: "grep -q 'listen 443' /etc/nginx/nginx.conf && echo \"TLS configured\" || echo \"no TLS listener\"\n\nsleep 30   # press Ctrl-C\necho $?    # 130 = 128 + SIGINT (2)" },
              { t: "table", headers: ["Status", "Meaning"], rows: [
                ["0", "Success"],
                ["1", "General failure (grep: no match)"],
                ["2", "Misuse, bad options (many tools)"],
                ["126", "Found but not executable"],
                ["127", "Command not found"],
                ["128 + N", "Killed by signal N (130 Ctrl-C, 137 SIGKILL, 143 SIGTERM)"]
              ] },
              { t: "h", text: "bash and zsh on a Mac" },
              { t: "p", html: "macOS has used zsh as the default login shell for several releases, and the bundled <code>/bin/bash</code> is version 3.2 from 2007 for licensing reasons. Linux servers almost always run bash 5. Interactively the shells feel similar, but scripts differ: zsh does not word-split unquoted variables, arrays start at index 1, and unmatched globs are errors." },
              { t: "compare", bad: { title: "Fragile", items: ["#!/bin/bash on a Mac gives you bash 3.2", "Testing a script interactively in zsh", "Assuming arrays start at 0 in both shells"] }, good: { title: "Portable", items: ["#!/usr/bin/env bash plus brew install bash", "Run scripts with bash script.sh or ./script.sh", "Lint with shellcheck before shipping"] } },
              { t: "cue", html: "<b>In the field:</b> when a command behaves differently on your laptop and the server, check <code>echo $0</code>, <code>bash --version</code> and <code>type &lt;cmd&gt;</code> first. Half the time it is a different shell, version or binary." },
              { t: "note", variant: "key", html: "The shell finds a command (alias, function, builtin, PATH), runs it, and branches on its exit status; know which shell and version you are in." }
            ]
          },
          {
            id: "pipes-redirection",
            title: "File descriptors, pipes and redirection",
            summary: "stdin, stdout and stderr as numbered descriptors, and exactly what >, 2>&1, | and here-docs do to them.",
            minutes: 10,
            tags: ["stdout", "stderr", "pipes", "redirection"],
            blocks: [
              { t: "p", html: "Every process starts with three open <b>file descriptors</b>: 0 (stdin), 1 (stdout) and 2 (stderr). They are just small integers indexing the process's table of open files. Redirection is the shell changing what those integers point to before it runs your program; the program itself never knows." },
              { t: "diagram", id: "fd-pipeline", caption: "grep writes results on fd 1 into the pipe and errors on fd 2 straight to the terminal; wc reads the pipe on fd 0." },
              { t: "h", text: "The redirection operators" },
              { t: "table", headers: ["Syntax", "Effect"], rows: [
                ["<code>&gt; f</code>", "fd 1 to f, truncating it"],
                ["<code>&gt;&gt; f</code>", "fd 1 to f, appending"],
                ["<code>2&gt; f</code>", "fd 2 to f"],
                ["<code>2&gt;&amp;1</code>", "make fd 2 a copy of whatever fd 1 is now"],
                ["<code>&lt; f</code>", "fd 0 from f"],
                ["<code>&amp;&gt; f</code>", "both to f (bash/zsh only, not POSIX sh)"],
                ["<code>a | b</code>", "a's fd 1 into b's fd 0 (stderr is not piped)"]
              ] },
              { t: "widget", id: "shellRedirect" },
              { t: "note", variant: "trap", html: "<code>cmd 2&gt;&amp;1 &gt; file</code> is not the same as <code>cmd &gt; file 2&gt;&amp;1</code>. Redirections apply left to right, so the first form copies stderr to the terminal before stdout moves." },
              { t: "h", text: "Pipes are concurrent" },
              { t: "p", html: "All stages of a pipeline start at the same time, connected by kernel buffers (typically 64 KiB on Linux). A fast producer blocks when the buffer is full; when the reader exits early, the writer gets SIGPIPE. That is why <code>yes | head -3</code> terminates instead of running forever." },
              { t: "code", lang: "bash", code: "# Pipe stderr too (bash 4+ shorthand for 2>&1 |)\nmake 2>&1 | tee build.log\nmake |& tee build.log\n\n# Feed a block of text as stdin\ncat <<'EOF' > nginx-snippet.conf\nlocation /health { return 200 \"ok\"; }\nEOF\n\n# Here-string: one line of stdin\ngrep -c ok <<< \"ok ok fail\"" },
              { t: "note", variant: "tip", html: "Quote the here-doc delimiter (<code>&lt;&lt;'EOF'</code>) to stop variable and command expansion inside it; leave it bare when you want <code>$VAR</code> substituted." },
              { t: "h", text: "Other useful descriptors" },
              { t: "ul", items: [
                "<code>/dev/null</code> discards writes and reads as empty.",
                "<code>exec 3&gt; trace.log</code> opens fd 3 for the rest of the script; write with <code>echo hi &gt;&amp;3</code>.",
                "<code>&lt;(cmd)</code> process substitution gives a command's output a file name: <code>diff &lt;(sort a) &lt;(sort b)</code>."
              ] },
              { t: "cue", html: "<b>In the field:</b> a cron job that \"prints nothing\" usually writes its errors to stderr, which cron mails or drops. Append <code>&gt;&gt; /var/log/job.log 2&gt;&amp;1</code> while you debug." },
              { t: "note", variant: "tip", html: "Redirection syntax is identical in bash and zsh, macOS's default shell. One difference: zsh's <code>MULTIOS</code> lets <code>cmd &gt; a &gt; b</code> write to both files, where bash writes only to the last one. Use <code>tee</code> when you mean it." },
              { t: "note", variant: "key", html: "Redirection rewires numbered descriptors left to right before the program starts; pipes carry stdout only unless you add 2>&1." }
            ]
          },
          {
            id: "globbing-expansion",
            title: "Expansion order and globbing",
            summary: "Brace, tilde, parameter, command and arithmetic expansion, word splitting, then globs, and why order explains every surprise.",
            minutes: 10,
            tags: ["expansion", "globbing", "parameters"],
            blocks: [
              { t: "p", html: "Before a command runs, the shell rewrites the words you typed. The steps always happen in the same order, and knowing that order explains most of the strange things a shell does." },
              { t: "ol", items: [
                "<b>Brace</b>: <code>file{1,2}</code> becomes <code>file1 file2</code>.",
                "<b>Tilde</b>: <code>~</code> becomes your home directory.",
                "<b>Parameter and variable</b>: <code>$HOME</code>, <code>${name:-default}</code>.",
                "<b>Command substitution</b>: <code>$(date +%F)</code>.",
                "<b>Arithmetic</b>: <code>$((n * 2))</code>.",
                "<b>Word splitting</b> on IFS, applied only to unquoted results of the previous three.",
                "<b>Pathname expansion</b> (globbing): <code>*.log</code>.",
                "<b>Quote removal</b>."
              ] },
              { t: "widget", id: "shellExpansion" },
              { t: "h", text: "Glob patterns" },
              { t: "table", headers: ["Pattern", "Matches"], rows: [
                ["<code>*</code>", "any string, but not a leading dot"],
                ["<code>?</code>", "exactly one character"],
                ["<code>[a-c]</code>", "one character from the set"],
                ["<code>**</code>", "any depth of directories (bash with globstar, zsh by default)"],
                ["<code>*.{jpg,png}</code>", "brace first, then two globs"]
              ] },
              { t: "note", variant: "trap", html: "Globs are not regular expressions. <code>*.log</code> in a shell means \"anything ending in .log\"; the same text in grep means \"zero or more of any character followed by log\"." },
              { t: "h", text: "Parameter expansion you will actually use" },
              { t: "code", lang: "bash", code: "path=/var/log/nginx/access.log\necho \"${path##*/}\"     # access.log    (strip longest */ prefix)\necho \"${path%/*}\"      # /var/log/nginx (strip shortest /* suffix)\necho \"${path%.log}.gz\"  # /var/log/nginx/access.gz\necho \"${#path}\"         # 25 (length)\necho \"${DEPLOY_ENV:-staging}\"   # default when unset or empty\n: \"${API_TOKEN:?set API_TOKEN first}\"   # abort with a message if unset" },
              { t: "p", html: "These run inside the shell, so they are far faster than calling <code>basename</code> or <code>sed</code> in a loop over thousands of files." },
              { t: "note", variant: "warn", html: "On macOS, bash 3.2 lacks <code>${var,,}</code> lowercasing, <code>globstar</code> and associative arrays. zsh has its own syntax for many of these. Test scripts with the bash version that will run them in production." },
              { t: "cue", html: "<b>In the field:</b> to see exactly what a line expands to, prefix it with <code>echo</code> or run <code>set -x</code>; bash prints each command after expansion with a leading <code>+</code>." },
              { t: "h", text: "When a glob matches nothing" },
              { t: "code", lang: "bash", code: "for f in /var/log/app/*.gz; do echo \"$f\"; done\n# no matches: bash prints the literal '/var/log/app/*.gz'\n\nshopt -s nullglob            # unmatched glob expands to nothing\nfor f in /var/log/app/*.gz; do gzip -t \"$f\"; done\n\nshopt -s failglob            # or: make an unmatched glob an error\nfiles=(/var/log/app/*.gz); echo \"${#files[@]} archives\"" },
              { t: "note", variant: "trap", html: "zsh, the macOS default shell, behaves the opposite way: an unmatched glob is an error (<code>no matches found</code>) unless you set <code>setopt nullglob</code> or quote the pattern. This is why <code>scp host:*.log .</code> needs quotes in zsh." },
              { t: "note", variant: "key", html: "Expansion runs brace, tilde, variable, command, arithmetic, then splitting and globbing; quoting decides whether the last two happen." }
            ]
          },
          {
            id: "quoting",
            title: "Quoting that never surprises you",
            summary: "Single, double and $'...' quotes, \"$@\", arrays for arguments, and safe handling of awkward file names.",
            minutes: 9,
            tags: ["quoting", "arrays", "IFS"],
            blocks: [
              { t: "p", html: "Quoting tells the shell which characters are data and which are syntax. The rule that prevents most shell bugs fits in one line: <b>double-quote every expansion unless you specifically want splitting and globbing</b>." },
              { t: "table", headers: ["Form", "What expands inside", "Use it for"], rows: [
                ["<code>'...'</code>", "Nothing at all", "Regexes, awk and jq programs, literal $"],
                ["<code>\"...\"</code>", "$var, $(cmd), $((...)), backslash before $ ` \" \\", "Every variable and substitution"],
                ["<code>$'...'</code>", "Backslash escapes like \\n \\t \\x41", "Tabs, newlines, control characters"],
                ["<code>\\x</code>", "Makes one character literal", "Occasional single characters"]
              ] },
              { t: "h", text: "Arguments: \"$@\" and arrays" },
              { t: "p", html: "<code>\"$@\"</code> expands to every positional argument as its own word, exactly as received. <code>$*</code> and unquoted <code>$@</code> re-split them on spaces. When you build a command incrementally, use an array, never a string." },
              { t: "code", lang: "bash", code: "# Wrong: a string loses the boundaries between arguments\nopts=\"-name 'my file.txt'\"\nfind . $opts          # find sees -name, 'my, file.txt'\n\n# Right: an array keeps each argument intact\nopts=(-name 'my file.txt')\nfind . \"${opts[@]}\"\n\n# Forward all arguments to another program\nwrapper() { command curl --fail --silent \"$@\"; }" },
              { t: "note", variant: "trap", html: "Single quotes cannot contain a single quote, even escaped. Close and reopen: <code>'it'\\''s'</code>, or switch to double quotes for that part." },
              { t: "h", text: "File names are hostile input" },
              { t: "p", html: "A file name may contain spaces, tabs, newlines, asterisks and leading dashes. Robust scripts treat it as data at every step." },
              { t: "ul", items: [
                "Iterate with a glob, not with <code>ls</code>: <code>for f in ./*.log; do ... \"$f\"; done</code>.",
                "Prefix with <code>./</code> or pass <code>--</code> so a file named <code>-rf</code> is not read as options.",
                "For a stream of names, use NUL separators: <code>find ... -print0 | xargs -0</code> or <code>while IFS= read -r -d '' f</code>.",
                "Use <code>read -r</code> so backslashes are kept literally."
              ] },
              { t: "compare", bad: { title: "Breaks on 'Q3 report.pdf'", items: ["for f in $(ls *.pdf)", "cp $src $dst", "if [ $name == x ]"] }, good: { title: "Handles any name", items: ["for f in ./*.pdf", "cp -- \"$src\" \"$dst\"", "if [[ $name == x ]] (or quote inside [ ])"] } },
              { t: "note", variant: "tip", html: "Install <code>shellcheck</code> (<code>brew install shellcheck</code> on macOS). It flags missing quotes, useless <code>ls</code> loops and dozens of other classic mistakes in seconds." },
              { t: "cue", html: "<b>In the field:</b> if a script works in your test directory but fails in production, look for a file name with a space or a leading dash in the real data." },
              { t: "quiz", id: "shell-basics" },
              { t: "note", variant: "key", html: "Double-quote every expansion, pass arguments with \"$@\" or arrays, and treat file names as arbitrary bytes." }
            ]
          }
        ]
      },
      {
        id: "scripting",
        name: "Safe scripting",
        icon: "shield",
        lessons: [
          {
            id: "strict-mode",
            title: "set -euo pipefail and its limits",
            summary: "What each strict-mode flag catches, the cases it silently misses, and how to debug with set -x.",
            minutes: 10,
            tags: ["set -e", "pipefail", "debugging"],
            blocks: [
              { t: "p", html: "By default bash keeps going after a command fails, treats unset variables as empty strings and judges a pipeline by its last stage only. That is friendly at the prompt and dangerous in a script that deletes or deploys things." },
              { t: "code", lang: "bash", code: "#!/usr/bin/env bash\nset -euo pipefail\nIFS=$'\\n\\t'   # optional: split only on newline and tab" },
              { t: "table", headers: ["Flag", "Catches", "Example it saves you from"], rows: [
                ["<code>-e</code> (errexit)", "Exit when an unhandled command fails", "cd into a missing dir, then rm -rf * in the wrong place"],
                ["<code>-u</code> (nounset)", "Error on an unset variable", "rm -rf \"$BUILD_DIR/\" with a typo in the name"],
                ["<code>-o pipefail</code>", "Pipeline fails if any stage fails", "curl fails but | jq still exits 0"]
              ] },
              { t: "note", variant: "warn", html: "The classic: <code>rm -rf \"$PREFIX/\"*</code> with <code>PREFIX</code> unset expands to <code>rm -rf /*</code>. <code>set -u</code> or <code>${PREFIX:?}</code> turns that into an error instead." },
              { t: "h", text: "Where -e does not help" },
              { t: "ul", items: [
                "Commands in an <code>if</code>, <code>while</code> or <code>until</code> condition, or on the left of <code>&amp;&amp;</code> / <code>||</code>.",
                "<code>local x=$(cmd)</code>, <code>export x=$(cmd)</code>: the builtin's success masks the failure.",
                "Functions called as a condition: <code>if deploy; then</code> disables -e inside the whole function.",
                "Commands whose failure is \"normal\", like <code>grep</code> finding nothing, need explicit handling: <code>grep pat f || true</code>."
              ] },
              { t: "code", lang: "bash", code: "# Masked: script continues even if fetch fails\nmain() { local body=$(fetch_config); echo \"$body\"; }\n\n# Fixed\nmain() {\n  local body\n  body=$(fetch_config)\n  echo \"$body\"\n}" },
              { t: "h", text: "Debugging a script" },
              { t: "p", html: "<code>set -x</code> prints each command after expansion. Make the trace more useful with a custom prefix showing the file and line number." },
              { t: "code", lang: "bash", code: "export PS4='+ ${BASH_SOURCE##*/}:${LINENO}: '\nbash -x ./deploy.sh staging\n# + deploy.sh:14: rsync -a build/ web1.lab.example:/srv/app/\n\nbash -n ./deploy.sh   # parse only, catch syntax errors without running" },
              { t: "note", variant: "tip", html: "Strict mode is a safety net, not a design. For each command ask: what should happen if this fails? Then write that explicitly with <code>||</code>, <code>if</code> or a trap." },
              { t: "cue", html: "<b>In the field:</b> when a strict script dies silently, add an ERR trap that prints <code>$LINENO</code> and <code>$BASH_COMMAND</code>; you will see the failing line immediately." },
              { t: "h", text: "A safer script skeleton" },
              { t: "code", lang: "bash", code: "#!/usr/bin/env bash\nset -euo pipefail\nshopt -s inherit_errexit 2>/dev/null || true   # bash 4.4+: -e inside $( )\n\nreadonly SCRIPT_DIR=$(cd \"$(dirname \"${BASH_SOURCE[0]}\")\" && pwd)\ntmp=$(mktemp -d)\ntrap 'rm -rf \"$tmp\"' EXIT\ntrap 'echo \"error at line $LINENO: $BASH_COMMAND\" >&2' ERR\n\nusage() { echo \"usage: ${0##*/} <env>\" >&2; exit 2; }\n[ $# -eq 1 ] || usage\nenv=$1\ncase $env in staging|prod) ;; *) usage ;; esac\n\n: \"${DEPLOY_TOKEN:?set DEPLOY_TOKEN in the environment, never in this file}\"" },
              { t: "ul", items: [
                  "Run <code>shellcheck</code> before every commit; it catches unquoted variables, masked return codes and many strict-mode blind spots.",
                  "Validate arguments up front with <code>case</code> and fail with exit code 2 for usage errors.",
                  "Read secrets from the environment or a file with tight permissions, never from a literal in the script."
                ] },
              { t: "note", variant: "warn", html: "macOS ships bash 3.2, which lacks <code>inherit_errexit</code>, associative arrays and <code>mapfile</code>. Install a current bash with Homebrew and use <code>#!/usr/bin/env bash</code> so the script picks it up from PATH." },
              { t: "note", variant: "key", html: "set -euo pipefail turns silent failures into exits, but conditions and local assignments bypass it; handle expected failures explicitly." }
            ]
          },
          {
            id: "functions",
            title: "Functions, scope and arguments",
            summary: "Defining functions, local variables, returning data through stdout, parsing options and structuring a script with main.",
            minutes: 9,
            tags: ["functions", "local", "getopts"],
            blocks: [
              { t: "p", html: "Shell functions behave like small commands: they take positional arguments, write to stdout and stderr, and finish with an exit status. Treat them that way and scripts stay readable." },
              { t: "code", lang: "bash", code: "log()  { printf '%s %s\\n' \"$(date +%H:%M:%S)\" \"$*\" >&2; }\ndie()  { log \"ERROR: $*\"; exit 1; }\n\nlatest_release() {\n  local dir=$1\n  [[ -d $dir ]] || return 2\n  ls -1t -- \"$dir\" | head -n 1    # data goes to stdout\n}\n\nrel=$(latest_release /srv/app/releases) || die \"no releases dir\"\nlog \"current release: $rel\"" },
              { t: "h", text: "Scope rules" },
              { t: "ul", items: [
                "Variables are global unless declared with <code>local</code> inside the function.",
                "bash uses dynamic scoping: a called function sees its caller's locals.",
                "A function run in a pipeline or <code>$( )</code> executes in a subshell, so its variable changes vanish."
              ] },
              { t: "note", variant: "trap", html: "<code>cat list | while read -r x; do count=$((count+1)); done</code> leaves <code>count</code> unchanged afterwards, because the loop ran in a subshell. Use <code>while ...; done &lt; list</code> instead." },
              { t: "h", text: "Returning results" },
              { t: "table", headers: ["Need", "Mechanism"], rows: [
                ["Success or failure", "<code>return 0..255</code>, test with if or ||"],
                ["A value", "Print it, capture with <code>$(fn)</code>"],
                ["Several values", "Print lines, read with <code>mapfile -t arr &lt; &lt;(fn)</code> (bash 4+)"],
                ["Diagnostics", "Write to stderr so captures stay clean"]
              ] },
              { t: "h", text: "Parsing options" },
              { t: "code", lang: "bash", code: "usage() { echo \"usage: ${0##*/} [-n] [-e env] target\" >&2; exit 2; }\ndry_run=0 env=staging\nwhile getopts ':ne:h' opt; do\n  case $opt in\n    n) dry_run=1 ;;\n    e) env=$OPTARG ;;\n    h|*) usage ;;\n  esac\ndone\nshift $((OPTIND - 1))\n(( $# == 1 )) || usage\n\nmain() { log \"deploying $1 to $env (dry run: $dry_run)\"; }\nmain \"$@\"" },
              { t: "note", variant: "tip", html: "<code>getopts</code> handles short options portably. Long options like <code>--dry-run</code> need a manual <code>case</code> loop; GNU <code>getopt</code> supports them but the BSD version on macOS does not." },
              { t: "cue", html: "<b>In the field:</b> wrap the body in a <code>main</code> function called on the last line. A half-downloaded script then fails to parse instead of running its first half." },
              { t: "note", variant: "key", html: "Functions return status with return and data through stdout; use local, keep diagnostics on stderr, and call main \"$@\" last." }
            ]
          },
          {
            id: "traps",
            title: "Traps, cleanup and signals in scripts",
            summary: "EXIT and ERR traps, temp files with mktemp, handling Ctrl-C, and lock files for scripts that must not overlap.",
            minutes: 9,
            tags: ["trap", "mktemp", "flock"],
            blocks: [
              { t: "p", html: "A <b>trap</b> registers code the shell runs when a signal arrives or when a pseudo-event happens. It is how a script leaves the system tidy no matter how it ends." },
              { t: "table", headers: ["Trap", "Fires when"], rows: [
                ["<code>EXIT</code>", "The shell exits for any reason except SIGKILL"],
                ["<code>ERR</code>", "A command fails where set -e would exit (bash)"],
                ["<code>INT</code>", "Ctrl-C (SIGINT)"],
                ["<code>TERM</code>", "Polite stop from kill or systemd"],
                ["<code>HUP</code>", "Terminal closed"]
              ] },
              { t: "code", lang: "bash", code: "#!/usr/bin/env bash\nset -euo pipefail\n\ntmp=$(mktemp -d)\ntrap 'rm -rf -- \"$tmp\"' EXIT\ntrap 'echo \"failed at line $LINENO: $BASH_COMMAND\" >&2' ERR\n\ncurl -fsS https://repo.shop.example/app.tar.gz -o \"$tmp/app.tgz\"\ntar -xzf \"$tmp/app.tgz\" -C \"$tmp\"\n# ... the temp dir disappears on success, failure or Ctrl-C" },
              { t: "note", variant: "tip", html: "Always create temporary files with <code>mktemp</code>. Fixed names like <code>/tmp/out.txt</code> collide between runs and can be pre-created by another user. On macOS, <code>mktemp -d</code> works without a template; BSD <code>mktemp</code> needs <code>-t prefix</code> for named files." },
              { t: "h", text: "Signals and child processes" },
              { t: "p", html: "While the shell waits for a foreground command, it does not run traps until that command finishes. If you need Ctrl-C to stop a long child promptly, run it in the background and <code>wait</code>; <code>wait</code> is interruptible." },
              { t: "code", lang: "bash", code: "trap 'kill \"$pid\" 2>/dev/null; exit 130' INT TERM\nlong_job & pid=$!\nwait \"$pid\"" },
              { t: "h", text: "Preventing overlap" },
              { t: "p", html: "A cron job that sometimes runs longer than its interval will eventually overlap itself. Linux's <code>flock</code> takes a lock on a file descriptor and releases it automatically when the process exits, even on a crash." },
              { t: "code", lang: "bash", code: "exec 9> /run/lock/backup.lock\nflock -n 9 || { echo \"already running\" >&2; exit 0; }\n# ... critical section ...\n\n# or wrap a command directly from cron\nflock -n /run/lock/backup.lock /usr/local/bin/backup.sh" },
              { t: "note", variant: "warn", html: "<code>flock</code> is part of util-linux and is not installed on macOS. There, <code>mkdir</code> on a lock directory is an atomic test-and-set you can pair with an EXIT trap." },
              { t: "quiz", id: "shell-scripting" },
              { t: "note", variant: "key", html: "Create temp files with mktemp, remove them in an EXIT trap, report failures in an ERR trap, and take a lock when a script must not overlap." }
            ]
          }
        ]
      }
    ]
  };
})();

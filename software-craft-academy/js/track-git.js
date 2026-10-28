/* =====================================================================
   CHISEL · Advanced Git
   window.TRACKS.git — modules: model / recover / scale
   ===================================================================== */
(function () {
  "use strict";
  var K = window.ChiselKit;
  var h = K.h, svg = K.svg, clear = K.clear, ro = K.ro;

  var Widgets = {};

  /* gitGraphSim — commit, branch, merge, rebase, cherry-pick on a live graph */
  Widgets.gitGraphSim = function (mount) {
    K.shell(mount, "simulator", "Git graph simulator",
      "A two-branch repository you can operate on. Commit, branch, merge, rebase and cherry-pick, and watch the commit graph change. Rebased-away commits stay visible, faded: they are no longer on any branch but the reflog can still find them.");
    var st;
    var LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    function reset() {
      st = { commits: {}, order: [], branches: {}, head: "main", n: 0, msg: "Fresh repository: two commits on main. HEAD is on main." };
      var a = mk(["main"], [], null);
      var b = mk(["main"], [a], null);
      st.branches.main = b;
    }
    function mk(laneOf, parents, label) {
      var id = "c" + (st.n++);
      var lab = label || LETTERS.charAt((st.order.length) % 26);
      st.commits[id] = { id: id, parents: parents, lane: laneOf[0] === "feature" ? 1 : 0, label: lab, x: st.order.length };
      st.order.push(id);
      return id;
    }
    function ancestors(id) {
      var seen = {}, stack = [id];
      while (stack.length) {
        var c = stack.pop();
        if (!c || seen[c]) continue;
        seen[c] = true;
        st.commits[c].parents.forEach(function (p) { stack.push(p); });
      }
      return seen;
    }
    function reachableAll() {
      var all = {};
      Object.keys(st.branches).forEach(function (b) { Object.assign(all, ancestors(st.branches[b])); });
      return all;
    }
    function other() { return st.head === "main" ? "feature" : "main"; }

    var ops = {
      commit: function () {
        var tip = st.branches[st.head];
        st.branches[st.head] = mk([st.head], [tip], null);
        st.msg = "git commit \u2014 new commit " + st.commits[st.branches[st.head]].label + " on " + st.head + ", parent " + st.commits[tip].label + ".";
      },
      branch: function () {
        if (st.branches.feature) { st.msg = "feature already exists. Use switch."; return; }
        st.branches.feature = st.branches[st.head];
        st.head = "feature";
        st.msg = "git switch -c feature \u2014 a branch is just a new pointer to the same commit. HEAD now follows feature.";
      },
      switchTo: function () {
        if (!st.branches.feature) { st.msg = "Create a feature branch first."; return; }
        st.head = other();
        st.msg = "git switch " + st.head + " \u2014 HEAD moved; no commits changed.";
      },
      merge: function () {
        var src = other();
        if (!st.branches[src]) { st.msg = "Nothing to merge: create a feature branch first."; return; }
        var into = st.branches[st.head], from = st.branches[src];
        if (ancestors(into)[from]) { st.msg = "Already up to date: " + src + " is contained in " + st.head + "."; return; }
        if (ancestors(from)[into]) {
          st.branches[st.head] = from;
          st.msg = "git merge " + src + " \u2014 fast-forward: " + st.head + " simply moved forward to " + st.commits[from].label + ". No merge commit needed.";
          return;
        }
        var m = mk([st.head], [into, from], "M" + st.order.length);
        st.branches[st.head] = m;
        st.msg = "git merge " + src + " \u2014 histories diverged, so a merge commit with two parents ties them together. History is preserved exactly.";
      },
      rebase: function () {
        var onto = other();
        if (!st.branches[onto]) { st.msg = "Nothing to rebase onto: create a feature branch first."; return; }
        var base = ancestors(st.branches[onto]);
        var mine = ancestors(st.branches[st.head]);
        var toReplay = st.order.filter(function (id) { return mine[id] && !base[id] && st.commits[id].parents.length === 1; });
        if (!toReplay.length) {
          if (!base[st.branches[st.head]]) { st.msg = "Nothing to replay."; return; }
          st.branches[st.head] = st.branches[onto];
          st.msg = "git rebase " + onto + " \u2014 nothing of your own to replay; " + st.head + " fast-forwarded.";
          return;
        }
        var tip = st.branches[onto];
        var labels = [];
        toReplay.forEach(function (id) {
          var old = st.commits[id];
          var lab = old.label.replace(/'+$/, "") + "'";
          tip = mk([st.head], [tip], lab);
          labels.push(lab);
        });
        st.branches[st.head] = tip;
        st.msg = "git rebase " + onto + " \u2014 replayed " + toReplay.length + " commit(s) as new commits " + labels.join(", ") + " with new hashes. The originals are now orphaned (faded): only the reflog points at them.";
      },
      pick: function () {
        var src = other();
        if (!st.branches[src]) { st.msg = "Nothing to pick: create a feature branch first."; return; }
        var pickId = st.branches[src];
        if (ancestors(st.branches[st.head])[pickId]) { st.msg = "The tip of " + src + " is already in " + st.head + "."; return; }
        var lab = st.commits[pickId].label.replace(/'+$/, "") + "'";
        st.branches[st.head] = mk([st.head], [st.branches[st.head]], lab);
        st.msg = "git cherry-pick " + st.commits[pickId].label + " \u2014 copied that one change onto " + st.head + " as " + lab + ". Same diff, different commit and hash.";
      }
    };

    var controls = h("div", { class: "widget-controls" });
    [["commit", "Commit"], ["branch", "Branch feature"], ["switchTo", "Switch branch"], ["merge", "Merge other \u2192 HEAD"], ["rebase", "Rebase HEAD onto other"], ["pick", "Cherry-pick other's tip"]].forEach(function (p, i) {
      controls.appendChild(K.btn(p[1], function () { ops[p[0]](); paint(); }, i === 0 ? "primary" : "ghost"));
    });
    controls.appendChild(K.btn("Reset", function () { reset(); paint(); }, "ghost"));
    var stage = h("div", { class: "w-stage", style: "overflow-x:auto" });
    var msg = h("div", { style: "margin-top:10px" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      clear(stage); clear(msg); clear(readout);
      var live = reachableAll();
      var cols = st.order.length;
      var W = Math.max(420, 70 + cols * 52), H = 170;
      var laneY = [60, 120];
      var root = svg("svg", { viewBox: "0 0 " + W + " " + H, width: String(W), height: String(H), role: "img", "aria-label": "Commit graph" });
      root.appendChild(svg("text", { x: "8", y: String(laneY[0] + 4), fill: "var(--text-dim)", "font-size": "11", "font-family": "var(--font-mono)" })).textContent = "main";
      root.appendChild(svg("text", { x: "8", y: String(laneY[1] + 4), fill: "var(--text-dim)", "font-size": "11", "font-family": "var(--font-mono)" })).textContent = "feature";
      function pos(id) { var c = st.commits[id]; return [70 + c.x * 52, laneY[c.lane]]; }
      st.order.forEach(function (id) {
        var c = st.commits[id], p2 = pos(id);
        c.parents.forEach(function (pid) {
          var p1 = pos(pid);
          root.appendChild(svg("line", { x1: String(p1[0]), y1: String(p1[1]), x2: String(p2[0]), y2: String(p2[1]),
            stroke: "var(--text-dim)", "stroke-width": "2", "stroke-dasharray": live[id] ? null : "4 4", opacity: live[id] ? "0.9" : "0.35" }));
        });
      });
      st.order.forEach(function (id) {
        var c = st.commits[id], p = pos(id);
        var g = svg("g", { opacity: live[id] ? "1" : "0.35" });
        g.appendChild(svg("circle", { cx: String(p[0]), cy: String(p[1]), r: "13", fill: "var(--surface-2)", stroke: c.lane ? "#f472b6" : "var(--amber)", "stroke-width": "2.5" }));
        var t = svg("text", { x: String(p[0]), y: String(p[1] + 4), "text-anchor": "middle", fill: "var(--text)", "font-size": "11", "font-family": "var(--font-mono)", "font-weight": "700" });
        t.textContent = c.label;
        g.appendChild(t);
        root.appendChild(g);
      });
      Object.keys(st.branches).forEach(function (b) {
        var p = pos(st.branches[b]);
        var up = b === "main";
        var y = up ? p[1] - 24 : p[1] + 32;
        var t = svg("text", { x: String(p[0]), y: String(y), "text-anchor": "middle", fill: "var(--text)", "font-size": "11", "font-family": "var(--font-mono)" });
        t.textContent = (st.head === b ? "HEAD\u2192" : "") + b;
        root.appendChild(t);
      });
      stage.appendChild(root);
      msg.appendChild(K.para(st.msg));
      var orphans = st.order.filter(function (id) { return !live[id]; }).length;
      readout.appendChild(ro("HEAD", st.head));
      readout.appendChild(ro("main", st.commits[st.branches.main].label));
      readout.appendChild(ro("feature", st.branches.feature ? st.commits[st.branches.feature].label : "\u2014"));
      readout.appendChild(ro("commits", st.order.length));
      readout.appendChild(ro("orphaned (reflog only)", orphans));
    }
    reset();
    mount.appendChild(controls); mount.appendChild(stage); mount.appendChild(msg); mount.appendChild(readout);
    paint();
  };

  /* gitBisectLab — find the first bad commit by halving */
  var BISECT_CASES = [
    { name: "Checkout total off by one cent", bad: 11 },
    { name: "Login page 500s", bad: 4 },
    { name: "Report export slow", bad: 14 }
  ];
  Widgets.gitBisectLab = function (mount) {
    K.shell(mount, "bisect", "Bisect lab",
      "Sixteen commits. The oldest is known good, the newest is known bad. Click a commit to test it (or let bisect pick the midpoint) and narrow down the first bad commit. Halving finds it in about log\u2082(16) = 4 tests.");
    var ci = 0, results, steps;
    function reset() { results = {}; results[0] = "good"; results[15] = "bad"; steps = 0; }
    function bounds() {
      var lo = 0, hi = 15;
      for (var i = 0; i < 16; i++) { if (results[i] === "good") lo = Math.max(lo, i); }
      for (var j = 15; j >= 0; j--) { if (results[j] === "bad") hi = Math.min(hi, j); }
      return [lo, hi];
    }
    function test(i) {
      if (results[i]) return;
      results[i] = i >= BISECT_CASES[ci].bad ? "bad" : "good";
      steps++;
      paint();
    }
    var controls = h("div", { class: "widget-controls" });
    controls.appendChild(K.segment(BISECT_CASES.map(function (c, i) { return [i, c.name]; }), 0, function (i) { ci = i; reset(); paint(); }));
    controls.appendChild(K.btn("Bisect: test midpoint", function () { var b = bounds(); if (b[1] - b[0] > 1) test(Math.floor((b[0] + b[1]) / 2)); }, "primary"));
    controls.appendChild(K.btn("Reset", function () { reset(); paint(); }, "ghost"));
    var stage = h("div", { class: "w-stage", style: "display:grid;gap:10px" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      clear(stage); clear(readout);
      var b = bounds();
      var done = b[1] - b[0] === 1;
      var row = h("div", { style: "display:grid;grid-template-columns:repeat(8,1fr);gap:6px" });
      for (var i = 0; i < 16; i++) {
        (function (i) {
          var r = results[i];
          var inRange = i > b[0] && i < b[1];
          var bg = r === "good" ? K.GOOD_BG : r === "bad" ? K.BAD_BG : inRange ? "var(--surface-2)" : "transparent";
          var btn = h("button", { type: "button", "aria-label": "Commit " + (i + 1) + (r ? " " + r : ""),
            style: "padding:6px 0;border-radius:8px;border:1px solid var(--line);font-family:var(--font-mono);font-size:0.76rem;color:var(--text);cursor:pointer;background:" + bg + ";opacity:" + (inRange || r ? "1" : "0.5") },
            "#" + (i + 1) + (r ? (r === "good" ? " \u2713" : " \u2717") : ""));
          btn.addEventListener("click", function () { if (!done) test(i); });
          row.appendChild(btn);
        })(i);
      }
      stage.appendChild(row);
      stage.appendChild(K.mono(done
        ? "$ git bisect run ./check.sh\n#" + (b[1] + 1) + " is the first bad commit\n$ git bisect reset"
        : "$ git bisect start\n$ git bisect bad          # newest\n$ git bisect good <oldest>\n# suspects remaining: " + (b[1] - b[0] - 1)));
      if (done) stage.appendChild(K.badge("Found in " + steps + " test" + (steps === 1 ? "" : "s") + (steps <= 4 ? " \u2014 as efficient as halving." : " \u2014 halving would take 4."), steps <= 4 ? "good" : "meh"));
      readout.appendChild(ro("tests run", steps));
      readout.appendChild(ro("suspect range", "#" + (b[0] + 2) + "\u2013#" + (b[1] + 1)));
      readout.appendChild(ro("status", done ? "first bad: #" + (b[1] + 1) : "searching"));
    }
    reset();
    mount.appendChild(controls); mount.appendChild(stage); mount.appendChild(readout);
    paint();
  };

  /* gitHookPlacer — where should each check run? */
  Widgets.gitHookPlacer = function (mount) {
    K.choiceDrill(mount, {
      pill: "hooks",
      title: "Where should this check run?",
      desc: "Local hooks give instant feedback but can be skipped; CI is authoritative but slower. Place each check where it gives the best feedback without slowing every commit.",
      choices: ["pre-commit hook", "commit-msg hook", "pre-push hook", "CI only"],
      items: [
        { prompt: "Auto-format the staged files.", answer: 0, why: "Fast and scoped to staged files, so it belongs before the commit is created. CI should still verify formatting, since hooks can be bypassed." },
        { prompt: "Check the message follows Conventional Commits.", answer: 1, why: "The commit-msg hook receives the message file. It is the only hook that can validate the message itself." },
        { prompt: "Scan staged changes for secrets.", answer: 0, why: "A secret must be caught before it enters history; once committed, it must be treated as leaked even if removed later. Run it again in CI as the safety net." },
        { prompt: "Run the unit tests of the packages you changed (about 40 seconds).", answer: 2, why: "Too slow for every commit but cheap compared with a red CI run. pre-push catches it before others see it." },
        { prompt: "Run the full integration and end-to-end suite (25 minutes).", answer: 3, why: "Far too slow locally and needs real infrastructure. CI is the authoritative place." },
        { prompt: "Enforce that main only receives changes through reviewed PRs.", answer: 3, why: "Local hooks are advisory and can be skipped with --no-verify. Branch protection on the server is the only real enforcement." }
      ]
    });
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "git-flow": {
      title: "Branching & automation checkpoint",
      sub: "Trunk-based development, hooks and monorepo tooling.",
      questions: [
        { q: "What characterises trunk-based development?", options: ["Everyone integrates small changes into main at least daily, with unfinished work hidden behind flags", "Long-lived feature branches merged at release time", "No branches at all, ever", "A branch per environment"], answer: 0,
          explain: "Short-lived branches and frequent integration keep merges small and conflicts rare. Feature flags decouple deploying code from releasing features." },
        { q: "Why do long-lived branches hurt?", options: ["Git cannot handle them", "They use more disk", "Divergence grows daily, so integration becomes a large, risky merge and feedback on the combined code arrives late", "They cannot be reviewed"], answer: 2,
          explain: "The cost of merging grows faster than the age of the branch. Integrating continuously turns one huge merge into many trivial ones." },
        { q: "Why must CI repeat checks that pre-commit hooks already run?", options: ["Hooks are slower", "CI cannot run hooks", "It does not need to", "Hooks are local and can be skipped or not installed, so only CI is authoritative"], answer: 3,
          explain: "Hooks are a convenience for fast feedback. Anything that must hold for main must be enforced server-side." },
        { q: "What does 'affected-only' CI in a monorepo do?", options: ["Runs nothing", "Builds and tests only the projects changed by a commit and those depending on them", "Tests only the root", "Skips tests on weekends"], answer: 1,
          explain: "A dependency graph of projects lets CI skip unaffected work. Combined with remote build caching, it keeps monorepo CI fast as the repo grows." },
        { q: "What is the role of a CODEOWNERS file?", options: ["Listing all contributors", "Storing licences", "Mapping paths to owning teams so the right reviewers are requested and, with branch protection, required", "Configuring hooks"], answer: 2,
          explain: "Ownership by path makes responsibility explicit and routes reviews automatically. It is essential in monorepos where many teams share one repository." }
      ]
    },
    "git-model": {
      title: "Git model checkpoint",
      sub: "Objects, refs, merge vs rebase and interactive rebase.",
      questions: [
        { q: "What is a Git branch, technically?", options: ["A movable pointer (ref) to a commit", "A copy of the files", "A folder on the server", "A list of diffs"], answer: 0,
          explain: "A branch is a small file containing a commit hash. Creating one is instant, and commits move it forward; that is why branching in Git is cheap." },
        { q: "What does rebasing a feature branch onto main actually do?", options: ["Moves existing commits without changing them", "Deletes main", "Creates a merge commit", "Replays the branch's commits on top of main as new commits with new hashes"], answer: 3,
          explain: "Rebase creates new commits with the same changes but different parents, so they get new hashes. The old commits become unreachable except through the reflog." },
        { q: "Why should you avoid rebasing commits that others have already pulled?", options: ["Rebase is slow", "It rewrites history they have, forcing them to reconcile duplicated or vanished commits", "It loses your changes", "Git forbids it"], answer: 1,
          explain: "Collaborators' branches are based on the old hashes. Rewriting shared history causes duplicate commits and confusing conflicts; rebase only your own unpublished work, or coordinate." },
        { q: "When does git merge produce a fast-forward?", options: ["When the target branch has no commits that the source lacks, so the pointer can simply move forward", "Always", "When there are conflicts", "Only with --squash"], answer: 0,
          explain: "If main has not moved since the branch was created, there is nothing to combine. Git just advances main's pointer unless you ask for --no-ff." },
        { q: "In an interactive rebase todo list, what does 'fixup' do?", options: ["Fixes merge conflicts automatically", "Deletes the commit", "Melds a commit into the previous one and discards its message", "Edits the commit's files"], answer: 2,
          explain: "fixup is like squash without keeping the message. Combined with commit --fixup and rebase --autosquash it makes tidying a branch before review quick." },
        { q: "What does --force-with-lease protect against compared with --force?", options: ["Nothing", "Large pushes", "Pushing to main", "Overwriting remote commits you have not seen yet"], answer: 3,
          explain: "It refuses the push if the remote branch moved since you last fetched. Plain --force would silently discard a teammate's work." }
      ]
    },
    "git-recover": {
      title: "Recovery checkpoint",
      sub: "Bisect, reflog, worktrees and cherry-pick.",
      questions: [
        { q: "You ran git reset --hard and lost a commit you had not pushed. What should you try first?", options: ["Re-clone the repository", "git reflog to find the commit's hash, then reset or branch to it", "Ask the server admin", "Nothing, it is gone"], answer: 1,
          explain: "The reflog records where HEAD and branches pointed recently. The commit object still exists for a while, so you can point a branch back at it." },
        { q: "Roughly how many test steps does git bisect need across 1,000 commits?", options: ["1,000", "500", "About 10", "100"], answer: 2,
          explain: "Bisect halves the range each step, so it needs about log2(1000), which is about 10. That is why it beats reading history by hand." },
        { q: "What makes git bisect run especially powerful?", options: ["A script's exit code marks each commit good or bad automatically, so the whole search runs unattended", "It runs faster than manual bisect per step", "It fixes the bug", "It works without commits"], answer: 0,
          explain: "Exit 0 means good, a non-zero code means bad, and 125 means skip. A short test script turns hours of hunting into minutes." },
        { q: "What problem do git worktrees solve?", options: ["Large files", "Merge conflicts", "Remote access", "Having several branches checked out at once in separate directories, sharing one repository"], answer: 3,
          explain: "You can review a PR or hotfix in another directory without stashing your current work. Each worktree shares the same object database." },
        { q: "When is cherry-pick the right tool?", options: ["To merge whole feature branches", "To copy a specific fix onto another branch, such as backporting to a release branch", "To rewrite history", "To delete commits"], answer: 1,
          explain: "Cherry-pick applies one commit's change as a new commit elsewhere. Using it instead of merging whole branches creates duplicate changes that make later merges confusing." }
      ]
    },
    "git-scale": {
      title: "Git at scale checkpoint",
      sub: "Commit conventions, monorepos, polyrepos and submodules.",
      questions: [
        { q: "In Conventional Commits, what does 'feat!:' or a BREAKING CHANGE footer signal?", options: ["A breaking change that should trigger a major version bump", "A small feature", "A failed build", "A revert"], answer: 0,
          explain: "Structured messages let tools derive versions and changelogs. The '!' or footer marks API breaks so consumers are warned." },
        { q: "A key advantage of a monorepo is…", options: ["Smaller clones", "No need for CI", "Atomic changes across many projects and one place to enforce tooling", "Independent release cadences by default"], answer: 2,
          explain: "One commit can update a library and every caller together. The cost is tooling for builds, ownership and checkout size at scale." },
        { q: "What does a Git submodule record in the parent repository?", options: ["A copy of the child's files", "The latest branch of the child", "Nothing", "A pointer to one specific commit of another repository"], answer: 3,
          explain: "The parent pins an exact commit. Updating the child requires a deliberate commit in the parent, which is why teams forget to run submodule update." },
        { q: "A good commit message subject line is…", options: ["'fixed stuff'", "A short imperative summary of what the commit does, with the why in the body", "The full diff", "The ticket number only"], answer: 1,
          explain: "Imperative subjects read like instructions ('Add retry to payment capture'). The body explains why, which is the part the diff cannot show." },
        { q: "Why might a team choose polyrepos over a monorepo?", options: ["Atomic cross-project changes", "Simpler dependency upgrades everywhere", "Clear ownership boundaries and independent tooling and release cycles per repo", "Fewer repositories"], answer: 2,
          explain: "Separate repos make ownership and access explicit and let teams move independently. The cost is coordinating cross-repo changes and version drift." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.git = {
    id: "git",
    name: "Advanced Git",
    short: "GIT",
    tagline: "History you can read, change and recover",
    color: "#f472b6",
    blurb: "Understand Git as commits and pointers, choose between merge and rebase deliberately, tidy branches with interactive rebase, hunt regressions with bisect, recover anything with the reflog, and organise repositories with conventional commits, monorepos, polyrepos and submodules.",
    modules: [
      {
        id: "model",
        name: "Model, Merge & Rebase",
        icon: "share",
        lessons: [
          {
            id: "object-model",
            title: "Git's object model: commits, trees and refs",
            summary: "Blobs, trees, commits and refs \u2014 the four ideas that make every Git command predictable.",
            minutes: 10,
            tags: ["git", "internals", "refs", "commits"],
            blocks: [
              { t: "p", html: "Most Git confusion disappears once you see that Git stores <strong>snapshots</strong>, not diffs, and that branches are just <strong>labels</strong> on those snapshots." },
              { t: "table", headers: ["Object", "Contains", "Identified by"], rows: [
                ["Blob", "File contents (no name)", "Hash of the contents"],
                ["Tree", "Names and modes pointing to blobs and subtrees", "Hash of the listing"],
                ["Commit", "One tree, parent commit(s), author, message", "Hash of all of that"],
                ["Ref (branch, tag)", "A name pointing to a commit", "Its name, e.g. refs/heads/main"]
              ] },
              { t: "code", lang: "bash", code:
                "git cat-file -p HEAD          # tree, parent, author, message of the current commit\n" +
                "git cat-file -p HEAD^{tree}   # the snapshot's top-level listing\n" +
                "cat .git/HEAD                 # usually: ref: refs/heads/main\n" +
                "git rev-parse main            # the commit hash main points to"
              },
              { t: "h", text: "Consequences worth remembering" },
              { t: "ul", items: [
                "Changing anything in a commit \u2014 message, parent, content \u2014 changes its hash. That is why rebase and amend create <em>new</em> commits.",
                "Branching is instant: it writes one small file.",
                "A commit nothing points to is not deleted immediately; it is unreachable and will be garbage-collected later. The reflog keeps it findable meanwhile.",
                "HEAD is a pointer to your current branch (or, in 'detached HEAD', directly to a commit)."
              ] },
              { t: "note", variant: "key", html: "<strong>Commits are immutable snapshots; branches are movable labels.</strong> Every Git command either creates commits or moves labels \u2014 ask which, and it stops being magic." }
            ]
          },
          {
            id: "merge-vs-rebase",
            title: "Merge vs rebase",
            summary: "Two ways to integrate work, what each does to history, and a team policy that avoids the usual fights.",
            minutes: 12,
            tags: ["git", "merge", "rebase", "history"],
            blocks: [
              { t: "p", html: "Both commands combine work from two branches. <strong>Merge</strong> records that two lines of history joined, with a merge commit that has two parents. <strong>Rebase</strong> rewrites your branch so it looks like you started from the latest main, producing a straight line." },
              { t: "diagram", id: "merge-vs-rebase", caption: "Merge keeps both lines and joins them with a merge commit; rebase replays the feature commits as new commits on top of main." },
              { t: "widget", id: "gitGraphSim" },
              { t: "table", headers: ["", "Merge", "Rebase"], rows: [
                ["History", "True record, including parallel work", "Linear, as if done sequentially"],
                ["Rewrites commits", "No", "Yes \u2014 new hashes"],
                ["Safe on shared branches", "Yes", "Only for unpublished or coordinated work"],
                ["Conflicts", "Resolved once, in the merge commit", "May be resolved per replayed commit"],
                ["Bisect and blame", "Works; merge commits add noise", "Clean, linear steps"]
              ] },
              { t: "h", text: "A policy most teams can live with" },
              { t: "ol", items: [
                "Rebase your own feature branch onto main freely while it is yours, to stay current and tidy.",
                "Never rewrite main or a branch others have pulled.",
                "Integrate into main via the PR tool, with one consistent strategy (squash, rebase or merge commit) chosen by the team."
              ] },
              { t: "note", variant: "warn", html: "After rebasing a branch you have already pushed, push with <code class='tok'>git push --force-with-lease</code>, never plain <code class='tok'>--force</code>. It refuses if someone else pushed in the meantime." },
              { t: "note", variant: "key", html: "<strong>Merge preserves history; rebase rewrites it into a line.</strong> Rebase what is private, merge what is shared, and agree one integration strategy for main." }
            ]
          },
          {
            id: "interactive-rebase",
            title: "Interactive rebase: tidy before you share",
            summary: "Squash, reorder, reword and split commits so a branch tells a clear story to reviewers.",
            minutes: 11,
            tags: ["git", "interactive-rebase", "squash", "fixup"],
            blocks: [
              { t: "p", html: "Real work produces messy commits: \"wip\", \"fix typo\", \"actually fix it\". Interactive rebase lets you rewrite your <em>unpublished</em> branch into a few meaningful commits before review." },
              { t: "code", lang: "bash", code:
                "git rebase -i main\n\n" +
                "# The todo list Git opens:\n" +
                "pick  a1b2c3  Add rate table for shipping\n" +
                "fixup d4e5f6  fix typo in rate table\n" +
                "pick  0718aa  Extract baseRate()\n" +
                "reword 9b2c1d  wip\n" +
                "drop  33ef01  debug logging"
              },
              { t: "table", headers: ["Command", "Effect"], rows: [
                ["pick", "Keep the commit as is"],
                ["reword", "Keep the change, edit the message"],
                ["edit", "Stop so you can amend or split the commit"],
                ["squash", "Meld into the previous commit, combine messages"],
                ["fixup", "Meld into the previous commit, discard this message"],
                ["drop", "Remove the commit"]
              ] },
              { t: "h", text: "The fixup workflow" },
              { t: "code", lang: "bash", code:
                "git commit --fixup=0718aa          # 'fixup! Extract baseRate()'\n" +
                "git rebase -i --autosquash main    # Git moves and marks it for you"
              },
              { t: "note", variant: "tip", html: "Before a risky rebase, note the current hash or create a backup branch: <code class='tok'>git branch backup/shipping</code>. If anything goes wrong, <code class='tok'>git rebase --abort</code> or reset to the backup." },
              { t: "quiz", id: "git-model" },
              { t: "note", variant: "key", html: "<strong>Commit messily, share cleanly.</strong> Use interactive rebase with fixup and autosquash on private branches so reviewers read a story, not a diary." }
            ]
          }
        ]
      },
      {
        id: "recover",
        name: "Investigate & Recover",
        icon: "wrench",
        lessons: [
          {
            id: "bisect",
            title: "git bisect: binary search for regressions",
            summary: "Find the exact commit that introduced a bug in a handful of steps, by hand or fully automated.",
            minutes: 10,
            tags: ["git", "bisect", "debugging", "regressions"],
            blocks: [
              { t: "p", html: "If you know a commit where things worked and one where they do not, <code class='tok'>git bisect</code> checks out the midpoint, asks you good or bad, and halves the range each time. A thousand commits take about ten steps." },
              { t: "widget", id: "gitBisectLab" },
              { t: "code", lang: "bash", code:
                "git bisect start\n" +
                "git bisect bad                 # current commit is broken\n" +
                "git bisect good v2.3.0         # this release was fine\n" +
                "# ...Git checks out a midpoint; test, then:\n" +
                "git bisect good                # or: git bisect bad\n\n" +
                "# Or automate with a script: exit 0 = good, 1-124 = bad, 125 = skip\n" +
                "git bisect run ./scripts/check-total.sh\n" +
                "git bisect reset               # return to where you started"
              },
              { t: "note", variant: "tip", html: "Bisect works best on history where every commit builds and passes tests. That is a strong practical argument for small, coherent commits and against \"wip\" commits on main." },
              { t: "note", variant: "key", html: "<strong>Know one good and one bad commit, and bisect does the rest.</strong> Automate it with a test script and it will find the culprit while you get coffee." }
            ]
          },
          {
            id: "reflog",
            title: "The reflog: undo almost anything",
            summary: "Git's local journal of where HEAD and branches have been, and how to recover from resets, bad rebases and deleted branches.",
            minutes: 9,
            tags: ["git", "reflog", "recovery", "reset"],
            blocks: [
              { t: "p", html: "The <strong>reflog</strong> records every time HEAD or a branch moved in <em>your</em> clone: commits, resets, rebases, checkouts. Since commits are not deleted immediately, the reflog lets you get back to almost any recent state." },
              { t: "code", lang: "bash", code:
                "git reflog\n" +
                "# 4f1c2ab HEAD@{0}: reset: moving to HEAD~3\n" +
                "# 9e8d7c6 HEAD@{1}: commit: Add MX rate band\n" +
                "# 1a2b3c4 HEAD@{2}: rebase (finish): returning to refs/heads/shipping\n\n" +
                "git branch rescue 9e8d7c6      # safest: put a label on the lost commit\n" +
                "git reset --hard HEAD@{1}      # or move the current branch back"
              },
              { t: "table", headers: ["Accident", "Recovery"], rows: [
                ["reset --hard too far", "Find the previous HEAD in the reflog; reset or branch to it"],
                ["Rebase went wrong", "Find the entry before 'rebase (start)'; reset to it"],
                ["Deleted a branch", "Find its last commit in the reflog; recreate the branch"],
                ["Amended the wrong commit", "HEAD@{1} is the commit before the amend"]
              ] },
              { t: "note", variant: "warn", html: "The reflog is local and expires (by default, unreachable entries after about 30 days). It cannot recover work that was never committed \u2014 commit early, even as wip, if you might need to get back to it. Stashes are commits too." },
              { t: "note", variant: "key", html: "<strong>If it was committed recently, it is almost certainly recoverable.</strong> Read the reflog, put a branch on the lost commit, then decide what to do." }
            ]
          },
          {
            id: "worktrees-cherry",
            title: "Worktrees and cherry-pick",
            summary: "Work on several branches at once without stashing, and move single fixes between branches deliberately.",
            minutes: 9,
            tags: ["git", "worktrees", "cherry-pick", "backports"],
            blocks: [
              { t: "h", text: "Worktrees" },
              { t: "p", html: "A <strong>worktree</strong> is an extra working directory attached to the same repository. You can have your feature branch open in one and a hotfix or a colleague's PR in another, with no stashing and no second clone." },
              { t: "code", lang: "bash", code:
                "git worktree add ../shop-hotfix release/2.4    # check out a branch in a new folder\n" +
                "git worktree add -b review/pr-812 ../shop-pr812 origin/pr-812\n" +
                "git worktree list\n" +
                "git worktree remove ../shop-hotfix"
              },
              { t: "note", variant: "tip", html: "Worktrees are handy for running a long test suite or an AI coding agent on one branch while you keep working on another \u2014 each has its own files, sharing one object database." },
              { t: "h", text: "Cherry-pick" },
              { t: "p", html: "<code class='tok'>git cherry-pick &lt;hash&gt;</code> applies one commit's change on top of your current branch as a <em>new</em> commit. The classic use is a backport: a fix merged to main also needs to go onto a release branch." },
              { t: "code", lang: "bash", code:
                "git switch release/2.4\n" +
                "git cherry-pick -x 9e8d7c6     # -x appends '(cherry picked from commit ...)'"
              },
              { t: "compare",
                bad: { title: "Cherry-pick as a habit", items: ["Moving whole features commit by commit", "Same change exists twice with different hashes", "Later merges conflict confusingly"] },
                good: { title: "Cherry-pick as a tool", items: ["Backport a specific fix to a release branch", "Use -x to record provenance", "Prefer fixing on main first, then picking"] } },
              { t: "quiz", id: "git-recover" },
              { t: "note", variant: "key", html: "<strong>Worktrees give you parallel checkouts; cherry-pick copies one change.</strong> Use worktrees instead of stash juggling, and cherry-pick for backports with -x, not for moving features." }
            ]
          }
        ]
      },
      {
        id: "scale",
        name: "History & Repositories at Scale",
        icon: "blocks",
        lessons: [
          {
            id: "conventional-commits",
            title: "Commit messages and Conventional Commits",
            summary: "Messages that explain why, and a structured format that tools can turn into versions and changelogs.",
            minutes: 9,
            tags: ["git", "commit-messages", "conventional-commits", "semver"],
            blocks: [
              { t: "p", html: "The diff shows <em>what</em> changed. Only the message can say <strong>why</strong>. Six months later, during an incident, that why is the most valuable line in the history." },
              { t: "code", lang: "text", code:
                "fix(checkout): round line totals before summing\n\n" +
                "Summing unrounded line totals and rounding once at the end produced\n" +
                "a one-cent difference from the invoice service, which rounds per line.\n" +
                "Round per line to match the invoice of record.\n\n" +
                "Refs: BILL-482"
              },
              { t: "table", headers: ["Type", "Use for", "Version effect"], rows: [
                ["feat", "A new capability", "Minor bump"],
                ["fix", "A bug fix", "Patch bump"],
                ["refactor, perf, test, docs, build, ci, chore", "Everything else", "None by default"],
                ["feat! or BREAKING CHANGE: footer", "Incompatible API change", "Major bump"]
              ] },
              { t: "ul", items: [
                "Subject in the imperative, about 50 characters: \"Add\", \"Fix\", \"Remove\".",
                "Blank line, then a body that explains the problem and why this approach.",
                "Footers for references and breaking changes.",
                "One logical change per commit, so revert and bisect stay useful."
              ] },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Forge, the DevSecOps atlas, covers turning structured commits into automated releases in its <em>Pipeline Engineering \u203a Git &amp; Source Control</em> module." },
              { t: "note", variant: "key", html: "<strong>The diff says what; the message says why.</strong> Use a consistent structure so humans can scan history and tools can version releases." }
            ]
          },
          {
            id: "mono-poly",
            title: "Monorepo, polyrepo and submodules",
            summary: "How to organise many projects into repositories, the trade-offs of each, and when submodules help or hurt.",
            minutes: 11,
            tags: ["monorepo", "polyrepo", "submodules", "repository-design"],
            blocks: [
              { t: "p", html: "Once a company has more than a handful of services and libraries, it must decide how code maps to repositories. There is no universally right answer \u2014 only different places to pay the cost of coordination." },
              { t: "table", headers: ["", "Monorepo", "Polyrepo"], rows: [
                ["Cross-project change", "One atomic commit and PR", "Coordinated PRs across repos, versioned releases"],
                ["Dependency versions", "Usually one version of everything", "Each repo pins its own; drift happens"],
                ["Tooling", "Needs build caching, affected-only CI, ownership files", "Simple per repo; duplicated across repos"],
                ["Ownership and access", "Via CODEOWNERS and path rules", "Natural per-repo boundaries"],
                ["Clone and CI size", "Grows large; needs sparse checkout", "Small"]
              ] },
              { t: "h", text: "Submodules: pinned pointers to other repositories" },
              { t: "code", lang: "bash", code:
                "git submodule add git@git.example:platform/shared-schemas.git vendor/schemas\n" +
                "git clone --recurse-submodules git@git.example:shop/app.git\n" +
                "git submodule update --init --recursive     # after pulling a new pinned commit\n" +
                "git -C vendor/schemas switch main && git -C vendor/schemas pull\n" +
                "git add vendor/schemas && git commit -m \"build: bump shared-schemas\""
              },
              { t: "p", html: "A submodule records an <strong>exact commit</strong> of another repo. That is reproducible, but it means every update is a deliberate commit in the parent, and anyone who forgets <code class='tok'>submodule update</code> builds against stale code. Package managers are usually a better fit for libraries; submodules suit vendored, slowly changing repos or polyrepo workspaces that need pinned sets." },
              { t: "note", variant: "trap", html: "A detached HEAD inside a submodule is normal \u2014 the parent pins a commit, not a branch. Switch to a branch before committing inside it, or your commits will be hard to find." },
              { t: "quiz", id: "git-scale" },
              { t: "note", variant: "key", html: "<strong>Monorepos pay in tooling, polyrepos pay in coordination.</strong> Choose by how often changes cross project boundaries, and use submodules only when you truly need a pinned commit of another repo." }
            ]
          }
        ]
      },
      {
        id: "flow",
        name: "Branching & Automation",
        icon: "queue",
        lessons: [
          {
            id: "trunk-based",
            title: "Trunk-based development and short-lived branches",
            summary: "Integrate small changes into main every day, and release with flags instead of branches.",
            minutes: 11,
            tags: ["trunk-based-development", "branching", "continuous-integration", "feature-flags"],
            blocks: [
              { t: "p", html: "Branching strategies trade isolation against integration. <strong>Trunk-based development</strong> chooses integration: everyone merges small changes into main (the trunk) at least daily, keeping it releasable at all times." },
              { t: "table", headers: ["", "Long-lived feature branches", "Trunk-based"], rows: [
                ["Branch lifetime", "Weeks", "Hours to a day or two"],
                ["Merge pain", "Large, late, conflict-heavy", "Small, frequent, trivial"],
                ["Unfinished work", "Hidden on the branch", "Hidden behind a flag or not yet wired up"],
                ["Feedback on combined code", "At merge time", "Continuously"],
                ["Needs", "Release managers, merge freezes", "Good tests, fast CI, flags, small PRs"]
              ] },
              { t: "h", text: "How teams make it work" },
              { t: "ul", items: [
                "Short-lived branches with PRs that merge within a day; or direct commits to main for very mature teams.",
                "Release flags for incomplete features; branch by abstraction for big replacements.",
                "A fast, trustworthy CI gate on every merge, and fixing a red main as the top priority.",
                "Release branches, if used, are cut from main and receive only cherry-picked fixes."
              ] },
              { t: "note", variant: "trap", html: "\"Trunk-based with branches that live three weeks\" is not trunk-based. The measure is how often your work integrates with everyone else's, not the name of the branching model." },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Forge, the DevSecOps atlas, covers branch protection and release strategies in its <em>Pipeline Engineering \u203a Git &amp; Source Control</em> module." },
              { t: "note", variant: "key", html: "<strong>Integrate daily, keep main releasable, hide unfinished work behind flags.</strong> Branch age, not branch naming, decides how painful merging is." }
            ]
          },
          {
            id: "hooks-precommit",
            title: "Git hooks and pre-commit checks",
            summary: "Fast local checks before code leaves your machine, and why CI must still be the referee.",
            minutes: 10,
            tags: ["git-hooks", "pre-commit", "automation", "secret-scanning"],
            blocks: [
              { t: "p", html: "Git runs scripts called <strong>hooks</strong> at points in its workflow. Client-side hooks give feedback in seconds instead of waiting for CI, and a shared hook manager makes the same checks run on every developer's machine." },
              { t: "table", headers: ["Hook", "Runs", "Good for"], rows: [
                ["pre-commit", "Before a commit is created", "Formatting, lint on staged files, secret scanning"],
                ["commit-msg", "After the message is written", "Message format, ticket references"],
                ["pre-push", "Before pushing", "Fast tests for changed packages"],
                ["Server-side / branch protection", "On the remote", "Enforcement: required reviews, required checks"]
              ] },
              { t: "code", lang: "text", code:
                "# .pre-commit-config.yaml (hook-manager style; versions pinned)\n" +
                "repos:\n" +
                "  - repo: local\n" +
                "    hooks:\n" +
                "      - id: format\n" +
                "        name: format staged files\n" +
                "        entry: make fmt-staged\n" +
                "        language: system\n" +
                "      - id: secrets\n" +
                "        name: scan staged changes for secrets\n" +
                "        entry: make scan-secrets-staged\n" +
                "        language: system\n" +
                "        stages: [pre-commit]"
              },
              { t: "widget", id: "gitHookPlacer" },
              { t: "note", variant: "warn", html: "Slow hooks get bypassed with <code class='tok'>--no-verify</code> and then ignored. Keep pre-commit under a few seconds by checking only staged files, and move anything slower to pre-push or CI." },
              { t: "note", variant: "key", html: "<strong>Hooks for fast feedback, CI for enforcement.</strong> Format, lint and scan for secrets before commit; run slower checks on push; enforce everything that matters on the server." }
            ]
          },
          {
            id: "monorepo-tooling",
            title: "Monorepo tooling: graphs, caching and ownership",
            summary: "What it takes to keep a large shared repository fast and well-owned.",
            minutes: 11,
            tags: ["monorepo", "build-caching", "codeowners", "sparse-checkout"],
            blocks: [
              { t: "p", html: "A monorepo is only pleasant with tooling that scales with it. Without that tooling, every commit runs every test, clones take minutes, and nobody knows who owns half the folders." },
              { t: "table", headers: ["Problem at scale", "Tooling answer"], rows: [
                ["CI runs everything on every change", "Project dependency graph and affected-only builds"],
                ["Rebuilding the same thing repeatedly", "Content-addressed local and remote build caches"],
                ["Huge clones and checkouts", "Shallow clones, partial clone, sparse checkout"],
                ["Unclear ownership", "CODEOWNERS per path; required owner review"],
                ["Teams coupling to each other's internals", "Visibility rules: only declared public modules can be imported"],
                ["One giant lockfile conflict magnet", "Workspace-aware package manager; automated updates"]
              ] },
              { t: "code", lang: "text", code:
                "# .github/CODEOWNERS style (last matching pattern wins)\n" +
                "*                         @platform-team\n" +
                "/services/orders/         @team-orders\n" +
                "/services/payments/       @team-payments @security-reviewers\n" +
                "/libs/ui-kit/             @team-design-system\n" +
                "/infra/terraform/         @team-platform"
              },
              { t: "code", lang: "bash", code:
                "git clone --filter=blob:none --sparse git@git.example:shop/monorepo.git\n" +
                "cd monorepo && git sparse-checkout set services/orders libs/money\n" +
                "build-tool test --affected --base=origin/main    # only what this branch touched"
              },
              { t: "note", variant: "tip", html: "Start ownership early: a CODEOWNERS file on day one is easy; untangling who owns what after three years is a project." },
              { t: "quiz", id: "git-flow" },
              { t: "note", variant: "key", html: "<strong>Monorepos need a graph, a cache and owners.</strong> Build only what changed, never rebuild what is cached, check out only what you need, and map every path to a team." }
            ]
          }
        ]
      }
    ]
  };
})();

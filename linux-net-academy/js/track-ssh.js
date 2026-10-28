/* =====================================================================
   KERNEL · SSH & Remote Work
   window.TRACKS.ssh — module: remote

   Self-contained: this file registers its own widget, its own quiz,
   and its own track data. Nothing else needs editing to load it.

   Block grammar (rendered by app.js):
     {t:'p', html}              paragraph (inline HTML allowed)
     {t:'h', text}              section heading
     {t:'h2', text}             sub heading
     {t:'ul'|'ol', items:[]}    list (items are inline HTML)
     {t:'code', lang, code}     code card
     {t:'note', variant, html}  callout: tip|key|warn|trap
     {t:'table', headers, rows} data table
     {t:'compare', bad, good}   two-column contrast
     {t:'stat', items}          metric row [{v,k}]
     {t:'cue', html}            "spotting it" callout
     {t:'diagram', id}          inline SVG from app.js DIAGRAMS
     {t:'widget', id}           interactive widget
     {t:'quiz', id}             quiz
   ===================================================================== */
(function () {
  "use strict";

  /* ==================================================================
     0. DOM helpers (local to this file so load order never matters)
  ================================================================== */
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
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, pill),
      h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
  }

  /* A .w-seg group. `pairs` is [[value, label], ...]; onPick gets the value. */
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

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  function roLine(text, color) {
    return h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" + (color ? ";color:" + color : "") }, text);
  }

  function term(text) {
    return h("pre", {
      style: "margin:0;padding:12px 14px;border-radius:10px;background:var(--surface-solid);color:var(--text);" +
        "border:1px solid var(--line);font-family:var(--font-mono);font-size:0.82rem;line-height:1.55;white-space:pre-wrap;overflow-x:auto"
    }, text);
  }

  var Widgets = {};

  /* ==================================================================
     1. sshTunnel — -L / -R / -D command builder and flow diagram
  ================================================================== */
  var HOST_RE = /^[A-Za-z0-9][A-Za-z0-9.\-]{0,252}$/;
  function portOf(s) {
    if (!/^\d{1,5}$/.test(String(s))) return 0;
    var n = parseInt(s, 10);
    return n >= 1 && n <= 65535 ? n : 0;
  }

  var TUNNEL_DEFAULTS = {
    L: { listen: "8080", target: "db.internal.example", tport: "5432", via: "bastion.example" },
    R: { listen: "9000", target: "localhost", tport: "3000", via: "demo.example" },
    D: { listen: "1080", target: "", tport: "", via: "bastion.example" }
  };

  Widgets.sshTunnel = function (mount) {
    shell(mount, "builder", "Build an SSH tunnel",
      "Choose the forwarding mode and fill in the ports and hosts. The panel prints the exact command, draws who listens where and who connects to whom, and checks the ports.");

    var mode = "L";
    var bindAll = false;
    var F = {};
    function loadDefaults() {
      var d = TUNNEL_DEFAULTS[mode];
      F.listen = d.listen; F.target = d.target; F.tport = d.tport; F.via = d.via;
    }
    loadDefaults();

    var fieldsRow = h("div", { class: "widget-controls" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function field(key, label, disabled) {
      var inp = h("input", {
        type: "text", value: F[key], "aria-label": label, spellcheck: "false",
        style: "background:var(--surface-solid);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:6px 8px;font-family:var(--font-mono);font-size:0.8rem;width:" + (key === "listen" || key === "tport" ? "80px" : "170px")
      });
      inp.value = F[key];
      if (disabled) inp.setAttribute("disabled", "disabled");
      inp.addEventListener("input", function () { F[key] = String(inp.value || "").trim(); paint(); });
      return h("label", { class: "w-field" }, label, inp);
    }

    function buildFields() {
      clear(fieldsRow);
      if (mode === "L") {
        fieldsRow.appendChild(field("listen", "local port"));
        fieldsRow.appendChild(field("target", "target host"));
        fieldsRow.appendChild(field("tport", "target port"));
        fieldsRow.appendChild(field("via", "ssh server"));
      } else if (mode === "R") {
        fieldsRow.appendChild(field("listen", "remote port"));
        fieldsRow.appendChild(field("target", "target (laptop side)"));
        fieldsRow.appendChild(field("tport", "target port"));
        fieldsRow.appendChild(field("via", "ssh server"));
      } else {
        fieldsRow.appendChild(field("listen", "SOCKS port"));
        fieldsRow.appendChild(field("via", "ssh server"));
      }
    }

    function box(title, lines, accent) {
      var b = h("div", { style: "flex:1 1 150px;min-width:140px;border:1px solid " + (accent ? "var(--accent)" : "var(--line)") + ";border-radius:12px;padding:10px 12px;background:var(--surface-solid)" },
        h("div", { style: "font-weight:700;font-size:0.86rem;color:var(--text);margin-bottom:4px" }, title));
      for (var i = 0; i < lines.length; i++) b.appendChild(h("div", { style: "font-family:var(--font-mono);font-size:0.76rem;line-height:1.5;color:var(--text-dim)" }, lines[i]));
      return b;
    }
    function arrow(label, sub) {
      return h("div", { style: "flex:0 1 120px;min-width:90px;text-align:center;align-self:center;font-size:0.74rem;color:var(--text-dim)" },
        h("div", { style: "font-family:var(--font-mono);color:var(--accent-ink);font-size:0.95rem" }, "\u2192"),
        h("div", { style: "font-weight:600;color:var(--text)" }, label),
        h("div", {}, sub));
    }

    function paint() {
      try {
        var problems = [], cautions = [];
        var lp = portOf(F.listen);
        if (!lp) problems.push("The " + (mode === "R" ? "remote" : "local") + " port must be a whole number from 1 to 65535.");
        var via = HOST_RE.test(F.via || "") ? F.via : "";
        if (!via) problems.push("Enter a valid ssh server hostname (letters, digits, dots, dashes).");
        var tgt = "", tp = 0;
        if (mode !== "D") {
          tgt = HOST_RE.test(F.target || "") ? F.target : "";
          if (!tgt) problems.push("Enter a valid target hostname.");
          tp = portOf(F.tport);
          if (!tp) problems.push("The target port must be a whole number from 1 to 65535.");
        }
        if (lp && lp < 1024) {
          if (mode === "R") cautions.push("Remote ports below 1024 can only be forwarded when you log in to the server as root; sshd refuses otherwise.");
          else cautions.push("Listening on a local port below 1024 needs root on most systems; use 8080-style ports instead of running ssh with sudo.");
        }
        var bind = bindAll ? "0.0.0.0:" : "";
        if (bindAll && mode === "R") cautions.push("Binding the remote side to all interfaces only works if the server's sshd_config sets GatewayPorts to yes or clientspecified; otherwise it stays on loopback.");
        if (bindAll && mode !== "R") cautions.push("Binding to 0.0.0.0 lets anyone on your network use the tunnel through your laptop.");

        var spec = "", cmd = "";
        var showLp = lp || "<port>", showTgt = tgt || "<target>", showTp = tp || "<port>", showVia = via || "<ssh-server>";
        if (mode === "L") spec = "-L " + bind + showLp + ":" + showTgt + ":" + showTp;
        else if (mode === "R") spec = "-R " + bind + showLp + ":" + showTgt + ":" + showTp;
        else spec = "-D " + bind + showLp;
        cmd = "ssh -N " + spec + " " + showVia;

        clear(stage);
        stage.appendChild(term("$ " + cmd + "\n# -N: no remote command, just forward. Add -f to background it after authentication."));
        var flow = h("div", { style: "display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;align-items:stretch" });
        var listenAddr = (bindAll ? "0.0.0.0" : "127.0.0.1") + ":" + showLp;
        var sentence;
        if (mode === "L") {
          flow.appendChild(box("Your laptop", ["ssh listens on " + listenAddr, "your client connects here"], true));
          flow.appendChild(arrow("SSH, encrypted", "laptop \u2192 " + showVia + ":22"));
          flow.appendChild(box(showVia, ["sshd opens the onward", "connection itself"]));
          flow.appendChild(arrow("plain TCP", showVia + " \u2192 " + showTgt + ":" + showTp));
          flow.appendChild(box(showTgt, ["service on port " + showTp, "sees the connection from " + showVia]));
          sentence = "Connect to localhost:" + showLp + " on your laptop and you reach " + showTgt + ":" + showTp + " via " + showVia + ". The ssh server resolves and dials the target, so the name only has to work from there.";
        } else if (mode === "R") {
          flow.appendChild(box("Your laptop", ["ssh dials " + showTgt + ":" + showTp, "when a tunnel connection arrives"], true));
          flow.appendChild(arrow("SSH, encrypted", "laptop \u2192 " + showVia + ":22 (you dial out)"));
          flow.appendChild(box(showVia, ["sshd listens on " + listenAddr, "clients there connect to it"]));
          flow.appendChild(arrow("back through tunnel", showVia + ":" + showLp + " \u2192 " + showTgt + ":" + showTp));
          flow.appendChild(box(showTgt + " (laptop side)", ["your local app on " + showTp, "resolved from the laptop"]));
          sentence = "Anyone on " + showVia + " who connects to " + (bindAll ? "its port " : "localhost:") + showLp + " reaches " + showTgt + ":" + showTp + " as seen from your laptop. You dialled out, so no inbound firewall hole on the laptop is needed.";
        } else {
          flow.appendChild(box("Your laptop", ["SOCKS proxy on " + listenAddr, "apps send 'connect me to X'"], true));
          flow.appendChild(arrow("SSH, encrypted", "laptop \u2192 " + showVia + ":22"));
          flow.appendChild(box(showVia, ["sshd dials whatever host", "and port each app requests"]));
          flow.appendChild(arrow("plain TCP", showVia + " \u2192 any host:port"));
          flow.appendChild(box("Any destination", ["chosen per connection", "traffic exits from " + showVia]));
          sentence = "Point a SOCKS5 client (browser, curl --socks5-hostname localhost:" + showLp + ") at localhost:" + showLp + " and each connection leaves from " + showVia + " to the host the app asks for.";
        }
        stage.appendChild(flow);

        clear(readout);
        readout.appendChild(ro("mode", mode === "L" ? "-L local" : mode === "R" ? "-R remote" : "-D dynamic"));
        readout.appendChild(ro("listener", (mode === "R" ? showVia : "laptop") + " " + listenAddr));
        readout.appendChild(ro("status", problems.length ? "fix inputs" : "valid"));
        readout.appendChild(roLine(sentence));
        for (var i = 0; i < problems.length; i++) readout.appendChild(roLine("Problem: " + problems[i], "var(--rose-ink)"));
        for (var j = 0; j < cautions.length; j++) readout.appendChild(roLine("Caution: " + cautions[j], "var(--amber-ink)"));
      } catch (e) {
        clear(readout);
        readout.appendChild(roLine("Could not build a tunnel from these inputs."));
      }
    }

    var bindBtn = h("button", { type: "button", class: "w-btn" }, "Bind all interfaces: off");
    bindBtn.addEventListener("click", function () {
      bindAll = !bindAll;
      bindBtn.className = "w-btn" + (bindAll ? " primary" : "");
      bindBtn.textContent = "Bind all interfaces: " + (bindAll ? "on" : "off");
      paint();
    });

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["L", "-L local"], ["R", "-R remote"], ["D", "-D dynamic"]], 0, function (v) { mode = v; loadDefaults(); buildFields(); paint(); }),
      bindBtn
    ));
    mount.appendChild(fieldsRow);
    mount.appendChild(stage);
    mount.appendChild(readout);
    buildFields();
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quiz
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "ssh-remote": {
      title: "SSH and remote work checkpoint",
      sub: "Keys, agents, config, tunnels and file transfer.",
      questions: [
        {
          q: "ssh refuses your key with 'WARNING: UNPROTECTED PRIVATE KEY FILE!' and 'Permissions 0644 ... are too open'. What fixes it?",
          options: ["chmod 644 ~/.ssh/id_ed25519.pub", "Regenerate the key with a longer passphrase", "chmod 600 ~/.ssh/id_ed25519", "Add the key to known_hosts"],
          answer: 2,
          explain: "ssh will not use a private key that other users can read, because anyone who can read it can impersonate you. Restricting it to the owner with mode 600 (and ~/.ssh to 700) satisfies the check. The public key may stay at 644; it is meant to be shared."
        },
        {
          q: "ssh prints 'REMOTE HOST IDENTIFICATION HAS CHANGED!' for a server you use daily. What is the right response?",
          options: ["Run ssh-keygen -R host immediately and reconnect", "Set StrictHostKeyChecking no in ~/.ssh/config", "Ignore it; it happens after every reboot", "Confirm the new fingerprint through a trusted channel (the server owner, a console, published records), then remove the old entry"],
          answer: 3,
          explain: "A changed host key is either a legitimate rebuild or a machine in the middle impersonating the server. Only an out-of-band check of the new SHA256 fingerprint tells them apart. Deleting the entry first or disabling checking accepts whichever key is presented, which is exactly what an attacker hopes for."
        },
        {
          q: "Why is ProxyJump usually preferred over agent forwarding (-A) to reach hosts behind a bastion?",
          options: ["With -A, anyone with root on the bastion can use your forwarded agent to authenticate as you while you are connected; ProxyJump keeps the agent on your laptop", "ProxyJump encrypts traffic and -A does not", "Agent forwarding only works with RSA keys", "ProxyJump does not need any keys"],
          answer: 0,
          explain: "Agent forwarding exposes a socket on the remote host that signs authentication challenges with your keys. Root, or anyone who compromises that host, can use it to log in elsewhere as you. ProxyJump tunnels your SSH connection through the bastion, so authentication to the inner host happens from your laptop and the bastion never touches your agent."
        },
        {
          q: "~/.ssh/config contains 'Host *' with 'User admin' at the top, followed later by 'Host web1' with 'User deploy'. Which user does ssh web1 log in as?",
          options: ["deploy, because the more specific block wins", "admin, because for each option the first value obtained wins", "Both; ssh tries each user in turn", "root, because conflicting values are discarded"],
          answer: 1,
          explain: "ssh reads the config top to bottom and keeps the first value it finds for each option, regardless of how specific the Host pattern is. Since Host * matched first, User is already admin when web1's block is reached. Put specific hosts first and Host * last; ssh -G web1 shows the effective result."
        },
        {
          q: "You run ssh -N -L 8080:db.internal.example:5432 bastion.example. Which machine resolves db.internal.example and opens the TCP connection to port 5432?",
          options: ["Your laptop", "The database server", "bastion.example", "Whichever machine runs the psql client"],
          answer: 2,
          explain: "With local forwarding, your laptop only listens on port 8080 and carries the bytes over SSH. The ssh server at the other end resolves the target name and dials it, so the name and route only need to work from the bastion. That is why internal-only names work in -L targets."
        },
        {
          q: "What does rsync -av src/ backup.example:/data/ do differently from rsync -av src backup.example:/data/?",
          options: ["Nothing; the trailing slash is ignored", "The first deletes files not present in src", "The first copies only top-level files", "The first copies the contents of src into /data/; the second creates /data/src/"],
          answer: 3,
          explain: "A trailing slash on the source means 'the contents of this directory'; without it, rsync copies the directory itself into the destination. Getting this wrong either nests an extra directory or spills files into the parent. Deleting extras only happens with --delete, which you should always preview with --dry-run first."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.ssh = {
    id: "ssh",
    name: "SSH & Remote Work",
    short: "SSH",
    tagline: "Keys, agents, config, tunnels and file sync",
    color: "#a3e635",
    blurb: "Everything you do on remote machines runs over SSH. Learn how host and user keys prove identity, use the agent safely, write a config that removes typing, forward ports through bastions, and move files with scp and rsync, with the macOS differences called out along the way.",
    modules: [
      {
        id: "remote",
        name: "SSH & Remote Work",
        icon: "plug",
        lessons: [
          {
            id: "ssh-keys",
            title: "SSH keys, known_hosts and trust",
            summary: "Two keys, two proofs: the host key proves the server, your key proves you. Generate, install and protect them correctly.",
            minutes: 11,
            tags: ["ssh", "keys", "ed25519", "known-hosts"],
            blocks: [
              { t: "p", html: "Every SSH connection answers two questions. <strong>Is this really the server I meant?</strong> The server proves it with its <em>host key</em>, which your client checks against <code class='tok'>~/.ssh/known_hosts</code>. <strong>Are you really you?</strong> You prove it with your <em>user key</em>, whose public half the server lists in <code class='tok'>~/.ssh/authorized_keys</code>. Neither private key ever crosses the network; each side only signs a challenge." },
              { t: "h", text: "Generate a key" },
              { t: "code", lang: "bash", code:
                "ssh-keygen -t ed25519 -C \"you@laptop\" -f ~/.ssh/id_ed25519\n" +
                "# prompts for a passphrase: use one, and let the agent remember it" },
              { t: "code", lang: "text", code:
                "~/.ssh/id_ed25519        private key: never copy, never share, never commit\n" +
                "~/.ssh/id_ed25519.pub    public key: one line, safe to share\n\n" +
                "$ cat ~/.ssh/id_ed25519.pub\n" +
                "ssh-ed25519 AAAA...<truncated> you@laptop" },
              { t: "p", html: "Ed25519 keys are short, fast and the sensible default today; reach for RSA (3072 bits or more) only for very old servers that lack Ed25519. The <code class='tok'>-C</code> comment is just a label so you can tell keys apart in <code class='tok'>authorized_keys</code>. A passphrase encrypts the private key on disk, so a stolen laptop backup is not an instant compromise." },
              { t: "h", text: "Install it on a server" },
              { t: "code", lang: "bash", code:
                "ssh-copy-id -i ~/.ssh/id_ed25519.pub you@web1.example\n" +
                "# without ssh-copy-id: append the .pub line to ~/.ssh/authorized_keys on the server" },
              { t: "p", html: "Each line in <code class='tok'>authorized_keys</code> can carry options that narrow what the key may do. These turn a deploy or backup key from a full shell into a single-purpose credential:" },
              { t: "code", lang: "text", code:
                "from=\"10.0.0.0/8\",restrict ssh-ed25519 AAAA...<truncated> ci@runner\n" +
                "restrict,command=\"/usr/local/bin/backup-receive\" ssh-ed25519 AAAA...<truncated> backup@nas" },
              { t: "ul", items: [
                "<code class='tok'>from=</code> limits the source addresses that may use the key.",
                "<code class='tok'>restrict</code> turns off port, agent and X11 forwarding and the terminal in one word; re-enable selectively (for example <code class='tok'>restrict,pty</code>).",
                "<code class='tok'>command=</code> forces one program to run, whatever the client asks for."
              ] },
              { t: "h", text: "Permissions ssh insists on" },
              { t: "table", headers: ["Path", "Mode", "Why"], rows: [
                ["<code class='tok'>~/.ssh/</code>", "700", "others must not add or swap files"],
                ["<code class='tok'>~/.ssh/id_ed25519</code>", "600", "only you may read the private key"],
                ["<code class='tok'>~/.ssh/id_ed25519.pub</code>", "644", "public by design"],
                ["<code class='tok'>~/.ssh/authorized_keys</code> (server)", "600", "sshd ignores it if others can write it"],
                ["home directory (server)", "not group/world-writable", "with StrictModes on, sshd rejects keys otherwise"]
              ] },
              { t: "note", variant: "trap", html: "<strong>'UNPROTECTED PRIVATE KEY FILE!'</strong> means the private key is readable by others (often after copying it from a USB stick or a zip). Fix it with <code class='tok'>chmod 600 ~/.ssh/id_ed25519</code>. On the server side, a key that silently fails is very often a group-writable home or <code class='tok'>.ssh</code> directory; the server's auth log says so." },
              { t: "h", text: "known_hosts and trust on first use" },
              { t: "code", lang: "text", code:
                "The authenticity of host 'web1.example (10.0.2.15)' can't be established.\n" +
                "ED25519 key fingerprint is SHA256:<fingerprint>.\n" +
                "Are you sure you want to continue connecting (yes/no/[fingerprint])?" },
              { t: "p", html: "The first connection is <strong>trust on first use</strong>: whatever key you accept is pinned in <code class='tok'>known_hosts</code> and checked on every later connection. To verify, compare against the fingerprint the server owner reads from the server itself:" },
              { t: "code", lang: "bash", code:
                "# on the server (or from its console / build output)\n" +
                "ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub\n" +
                "# 256 SHA256:<fingerprint> root@web1 (ED25519)" },
              { t: "note", variant: "warn", html: "<strong>'REMOTE HOST IDENTIFICATION HAS CHANGED!'</strong> is either a rebuilt server or someone in the middle. Confirm the new fingerprint through a channel you trust first; only then remove the stale entry with <code class='tok'>ssh-keygen -R web1.example</code>. Running that command reflexively, or setting <code class='tok'>StrictHostKeyChecking no</code>, throws away the only protection the warning gives you." },
              { t: "h2", text: "SSH certificates, briefly" },
              { t: "p", html: "At scale, teams replace scattered <code class='tok'>authorized_keys</code> and <code class='tok'>known_hosts</code> entries with an SSH certificate authority. A CA key signs user keys (with a list of allowed principals and an expiry) and host keys; servers trust the CA via <code class='tok'>TrustedUserCAKeys</code>, and clients trust host certificates via a <code class='tok'>@cert-authority</code> line in <code class='tok'>known_hosts</code>. Short-lived user certificates make offboarding automatic." },
              { t: "note", variant: "tip", html: "On macOS, add <code>UseKeychain yes</code> and <code>AddKeysToAgent yes</code> under <code>Host *</code> in <code>~/.ssh/config</code> so the passphrase is unlocked by your login. On Linux desktops, the GNOME or KDE keyring agent plays the same role." },
              { t: "note", variant: "key", html: "<strong>The host key proves the server; your key proves you.</strong> Protect the private key with mode 600 and a passphrase, restrict keys with authorized_keys options, and verify a changed host key before you accept it." }
            ]
          },
          {
            id: "ssh-agent",
            title: "ssh-agent, forwarding and ProxyJump",
            summary: "Unlock a key once, use it everywhere, and reach inner hosts without lending your agent to a bastion.",
            minutes: 9,
            tags: ["ssh-agent", "proxyjump", "macos", "fido2"],
            blocks: [
              { t: "p", html: "Typing a passphrase for every connection gets old fast. <strong>ssh-agent</strong> is a small background process that holds your decrypted private keys in memory and signs authentication challenges on request. Clients find it through the <code class='tok'>SSH_AUTH_SOCK</code> environment variable; the key material itself never leaves the agent." },
              { t: "code", lang: "bash", code:
                "eval \"$(ssh-agent -s)\"           # start an agent and export SSH_AUTH_SOCK (Linux shells)\n" +
                "ssh-add ~/.ssh/id_ed25519         # unlock once; prompts for the passphrase\n" +
                "ssh-add -t 8h ~/.ssh/id_ed25519   # or keep it only for a working day\n" +
                "ssh-add -l                        # list loaded keys (fingerprints)\n" +
                "ssh-add -D                        # forget all keys" },
              { t: "code", lang: "text", code:
                "$ ssh-add -l\n" +
                "256 SHA256:<fingerprint> you@laptop (ED25519)" },
              { t: "p", html: "Most Linux desktops start an agent at login (GNOME Keyring or a systemd user unit), so check <code class='tok'>echo $SSH_AUTH_SOCK</code> before starting a second one. On servers and in tmux sessions you usually start it yourself." },
              { t: "h", text: "macOS: the agent and the Keychain" },
              { t: "p", html: "macOS starts an agent for you through launchd, so <code class='tok'>SSH_AUTH_SOCK</code> is already set in every terminal. Apple's OpenSSH can store the passphrase in your login Keychain so keys unlock automatically after a reboot:" },
              { t: "code", lang: "bash", code:
                "ssh-add --apple-use-keychain ~/.ssh/id_ed25519   # older macOS versions used ssh-add -K\n\n" +
                "# ~/.ssh/config\n" +
                "Host *\n" +
                "  AddKeysToAgent yes\n" +
                "  UseKeychain yes\n" +
                "  IdentityFile ~/.ssh/id_ed25519" },
              { t: "note", variant: "trap", html: "<code class='tok'>UseKeychain</code> is an Apple-only option. A Homebrew OpenSSH, or the same config file copied to Linux, rejects it as unknown. Put <code class='tok'>IgnoreUnknown UseKeychain</code> above it if you share one config across machines." },
              { t: "h", text: "Agent forwarding and its risk" },
              { t: "p", html: "<code class='tok'>ssh -A bastion.example</code> exposes your agent on the bastion, so a second hop from there can authenticate with your keys. It works, but for as long as you stay connected, <strong>anyone with root on the bastion</strong> (or anyone who has compromised it) can use that socket to sign in elsewhere as you. They cannot copy the key, but they do not need to." },
              { t: "compare",
                bad: { title: "ssh -A, then ssh again", items: ["Your agent socket lives on the bastion while connected", "Root there can impersonate you to any host your key opens", "Easy to leave ForwardAgent yes on for Host *"] },
                good: { title: "ProxyJump (-J)", items: ["The bastion only relays an encrypted TCP stream", "Authentication to the inner host happens from your laptop", "Works with one flag or one config line"] } },
              { t: "code", lang: "bash", code:
                "ssh -J bastion.example app1.internal.example\n" +
                "ssh -J bastion.example,jump2.example db1.internal.example   # chain several hops" },
              { t: "note", variant: "tip", html: "If you truly need forwarding (for example, git over SSH on a remote dev box), enable it only for that host in your config, and use <code class='tok'>ssh-add -c</code> so the agent asks you to confirm each use." },
              { t: "h2", text: "Hardware-backed keys" },
              { t: "p", html: "<code class='tok'>ssh-keygen -t ed25519-sk</code> creates a key whose private half lives on a FIDO2 security key; every login needs a physical touch, so malware on your laptop cannot use it silently. The file in <code class='tok'>~/.ssh</code> is only a handle. Support depends on the OpenSSH build and the server version, and the stock macOS client may need a Homebrew OpenSSH for it." },
              { t: "note", variant: "key", html: "<strong>Let the agent hold your keys, and keep the agent on your laptop.</strong> Use ProxyJump to reach inner hosts; forward the agent only to a host you trust as much as your own machine." }
            ]
          },
          {
            id: "ssh-config",
            title: "~/.ssh/config and sshd hardening",
            summary: "Name your hosts, pin the right key, reuse connections, debug with -G and -v, and lock down the server side safely.",
            minutes: 11,
            tags: ["ssh-config", "multiplexing", "sshd", "hardening"],
            blocks: [
              { t: "p", html: "A good <code class='tok'>~/.ssh/config</code> turns <code class='tok'>ssh -i ~/.ssh/work_ed25519 -p 2222 deploy@10.0.4.17</code> into <code class='tok'>ssh web1</code>, and the same names then work for scp, rsync, git and any tool built on ssh." },
              { t: "code", lang: "text", code:
                "# ~/.ssh/config: specific hosts first, Host * last\n" +
                "Include ~/.ssh/config.d/*\n\n" +
                "Host bastion\n" +
                "  HostName bastion.example\n" +
                "  User you\n\n" +
                "Host web1\n" +
                "  HostName 10.0.4.17\n" +
                "  User deploy\n" +
                "  Port 2222\n" +
                "  IdentityFile ~/.ssh/work_ed25519\n" +
                "  IdentitiesOnly yes\n" +
                "  ProxyJump bastion\n\n" +
                "Host *.internal.example\n" +
                "  ProxyJump bastion\n\n" +
                "Host *\n" +
                "  ServerAliveInterval 30\n" +
                "  ControlMaster auto\n" +
                "  ControlPath ~/.ssh/cm-%r@%h:%p\n" +
                "  ControlPersist 10m" },
              { t: "table", headers: ["Option", "Does", "Why you want it"], rows: [
                ["<code class='tok'>HostName</code>", "the real address behind the alias", "short names, one place to change"],
                ["<code class='tok'>User</code> / <code class='tok'>Port</code>", "login name and port", "no more <code class='tok'>-p 2222 deploy@</code>"],
                ["<code class='tok'>IdentityFile</code> + <code class='tok'>IdentitiesOnly yes</code>", "offer only this key", "avoids 'Too many authentication failures' when the agent holds many keys"],
                ["<code class='tok'>ProxyJump</code>", "hop through a bastion", "inner hosts feel direct"],
                ["<code class='tok'>ControlMaster</code> / <code class='tok'>ControlPath</code> / <code class='tok'>ControlPersist</code>", "share one TCP+auth session across many ssh commands", "second and later connections open almost instantly"],
                ["<code class='tok'>ServerAliveInterval 30</code>", "keepalive every 30 s", "stops NAT and firewalls from silently dropping idle sessions"],
                ["<code class='tok'>Include</code>", "pull in more files", "per-client or per-team snippets"]
              ] },
              { t: "note", variant: "trap", html: "<strong>First value wins, per option.</strong> ssh reads top to bottom and keeps the first value it finds for each setting, however specific a later Host line is. A <code class='tok'>Host *</code> block with <code class='tok'>User admin</code> at the top beats every later <code class='tok'>User</code>. Keep specific hosts first, wildcards after, and <code class='tok'>Host *</code> at the very end. An <code class='tok'>Include</code> placed inside a Host block only applies under that block, so put global ones at the top." },
              { t: "h", text: "See what ssh will actually do" },
              { t: "code", lang: "bash", code:
                "ssh -G web1 | grep -Ei '^(hostname|user|port|identityfile|proxyjump) '\n" +
                "ssh -v web1        # -vv / -vvv for more\n" +
                "ssh -O check web1  # is a multiplexed master running?\n" +
                "ssh -O exit web1   # close it (after changing config, for example)" },
              { t: "code", lang: "text", code:
                "$ ssh -v web1\n" +
                "debug1: Reading configuration data /Users/you/.ssh/config\n" +
                "debug1: Setting implicit ProxyCommand from ProxyJump: ssh -W '[%h]:%p' bastion\n" +
                "debug1: Authenticating to 10.0.4.17:2222 as 'deploy'\n" +
                "debug1: Offering public key: /Users/you/.ssh/work_ed25519 ED25519 SHA256:<fingerprint> explicit\n" +
                "debug1: Server accepts key: /Users/you/.ssh/work_ed25519 ED25519 SHA256:<fingerprint> explicit\n" +
                "debug1: Authenticated to 10.0.4.17 ([10.0.4.17]:2222) using \"publickey\"." },
              { t: "p", html: "In <code class='tok'>-v</code> output, read the <em>Offering public key</em> lines: they show which keys ssh tried, in which order, and whether the server accepted any. A host that rejects every key usually has the wrong <code class='tok'>authorized_keys</code>, permissions, or user." },
              { t: "h", text: "Server side: sshd_config basics" },
              { t: "code", lang: "text", code:
                "# /etc/ssh/sshd_config (or a drop-in under /etc/ssh/sshd_config.d/)\n" +
                "PasswordAuthentication no\n" +
                "KbdInteractiveAuthentication no\n" +
                "PermitRootLogin prohibit-password     # or no\n" +
                "AllowUsers deploy you\n" +
                "AllowTcpForwarding no                  # unless this host is a bastion" },
              { t: "code", lang: "bash", code:
                "sudo sshd -t && sudo systemctl reload ssh    # unit is 'sshd' on RHEL-family systems\n" +
                "# keep your current session open and test a NEW login before logging out" },
              { t: "note", variant: "warn", html: "Always run <code class='tok'>sshd -t</code> before reloading: a syntax error can stop the daemon from accepting new logins. Disable passwords only after confirming key login works for every account that needs it. On macOS, the SSH server is 'Remote Login' in System Settings and is managed by launchd, not systemctl." },
              { t: "note", variant: "key", html: "<strong>Specific hosts first, Host * last, and ask ssh -G when in doubt.</strong> Pin keys with IdentitiesOnly, reuse connections with ControlMaster, and validate sshd_config with sshd -t before every reload." }
            ]
          },
          {
            id: "ssh-tunnels",
            title: "Port forwarding: -L, -R and -D",
            summary: "Reach a service behind a bastion, expose a laptop port to a remote host, or run a SOCKS proxy, and know who listens where.",
            minutes: 11,
            tags: ["ssh", "tunnels", "port-forwarding", "socks"],
            blocks: [
              { t: "p", html: "An SSH connection can carry more than a shell. Port forwarding opens a listener on one end and, for every connection to it, has the <em>other</em> end dial a target, with the bytes riding inside the encrypted session. The only question that matters for each mode is: <strong>who listens, and who dials?</strong>" },
              { t: "diagram", id: "ssh-tunnels", caption: "Local (-L), remote (-R) and dynamic (-D) forwarding: where the listener sits and which side opens the onward connection." },
              { t: "table", headers: ["Mode", "Listener on", "Dialled by", "Typical use"], rows: [
                ["<code class='tok'>-L 8080:db.internal.example:5432</code>", "your laptop, 127.0.0.1:8080", "the ssh server", "reach a database or admin UI behind a bastion"],
                ["<code class='tok'>-R 9000:localhost:3000</code>", "the ssh server, 127.0.0.1:9000", "your laptop", "show a local web app to someone on the remote side"],
                ["<code class='tok'>-D 1080</code>", "your laptop, SOCKS on 127.0.0.1:1080", "the ssh server, to any host the app asks for", "browse an internal network through a bastion"]
              ] },
              { t: "h", text: "Local forwarding: the bastion pattern" },
              { t: "code", lang: "bash", code:
                "ssh -N -L 8080:db.internal.example:5432 bastion.example\n" +
                "# in another terminal\n" +
                "psql -h localhost -p 8080 -U app appdb" },
              { t: "p", html: "Your laptop never resolves <code class='tok'>db.internal.example</code>: the bastion does, then dials it. That is why internal names work in the target, and why the database sees the connection coming from the bastion. <code class='tok'>-N</code> means 'no remote command'; add <code class='tok'>-f</code> to drop into the background after authentication." },
              { t: "widget", id: "sshTunnel" },
              { t: "h", text: "Remote and dynamic forwarding" },
              { t: "code", lang: "bash", code:
                "ssh -N -R 9000:localhost:3000 demo.example        # demo.example:9000 -> your laptop:3000\n" +
                "ssh -N -D 1080 bastion.example                    # SOCKS proxy on localhost:1080\n" +
                "curl --socks5-hostname localhost:1080 https://wiki.internal.example/" },
              { t: "p", html: "With <code class='tok'>-R</code> you dial out, so the laptop needs no inbound firewall opening; the remote host gets a port that leads back to you. With <code class='tok'>-D</code>, ssh speaks SOCKS, so each app connection names its own destination. Use <code class='tok'>--socks5-hostname</code> (not plain <code class='tok'>--socks5</code>) so names are resolved at the far end, where internal DNS works." },
              { t: "h", text: "Bind addresses and GatewayPorts" },
              { t: "ul", items: [
                "By default forwarded ports bind to <strong>loopback</strong> only, so just the machine holding the listener can use them.",
                "<code class='tok'>-L 0.0.0.0:8080:db.internal.example:5432</code> binds on all laptop interfaces: now anyone on your Wi-Fi can reach the database through you.",
                "For <code class='tok'>-R</code>, the server decides: sshd's <code class='tok'>GatewayPorts</code> must be <code class='tok'>yes</code> or <code class='tok'>clientspecified</code> before a remote listener can bind beyond loopback.",
                "Listening on ports below 1024 needs root on that side; pick high ports instead of running ssh with sudo."
              ] },
              { t: "note", variant: "warn", html: "<strong>Tunnels bypass network controls by design.</strong> A <code class='tok'>-R</code> from inside a company network to an outside host creates an inbound path no firewall rule approved. Server owners restrict this with <code class='tok'>AllowTcpForwarding</code>, <code class='tok'>PermitOpen</code> and <code class='tok'>PermitListen</code> in sshd_config, and with <code class='tok'>restrict</code> on individual keys. Use tunnels for access you are allowed to have, and close them when done." },
              { t: "note", variant: "tip", html: "Put long-lived tunnels in your config so they are named and repeatable: <code class='tok'>LocalForward 8080 db.internal.example:5432</code> under a <code class='tok'>Host db-tunnel</code> block, then <code class='tok'>ssh -N db-tunnel</code>." },
              { t: "cue", html: "<strong>In the field:</strong> when a tunnel 'connects but nothing works', test each leg separately: <code class='tok'>nc -zv localhost 8080</code> on the laptop proves the listener; <code class='tok'>nc -zv db.internal.example 5432</code> run on the bastion proves the onward hop. ssh also prints <em>channel open failed</em> when the far side cannot dial the target." },
              { t: "table", headers: ["Flag", "Direction", "Typical use"], rows: [
                  ["<code>-L 5433:db.internal:5432</code>", "Local port to a remote target", "Reach a private database from your laptop"],
                  ["<code>-R 8080:localhost:3000</code>", "Remote port back to you", "Show a local dev server to a remote host"],
                  ["<code>-D 1080</code>", "Dynamic SOCKS proxy", "Browse an internal network through a bastion"],
                  ["<code>-J bastion.lab.example</code>", "Jump through a host", "Reach private hosts without agent forwarding"]
                ] },
              { t: "note", variant: "tip", html: "OpenSSH behaves the same on macOS and Linux. On macOS, binding a local port below 1024 needs sudo just as on Linux, and <code>ssh-add --apple-use-keychain</code> stores key passphrases in the Keychain." },
              { t: "note", variant: "key", html: "<strong>-L listens on your side and the server dials; -R listens on the server and you dial; -D lets each app choose.</strong> Keep listeners on loopback unless you mean to share them." }
            ]
          },
          {
            id: "scp-rsync",
            title: "scp, sftp and rsync",
            summary: "Copy files over SSH, sync directories without surprises, and avoid the trailing-slash and --delete traps.",
            minutes: 10,
            tags: ["scp", "sftp", "rsync", "macos"],
            blocks: [
              { t: "p", html: "All three tools ride on SSH, so your config, keys, ProxyJump and multiplexing apply automatically. Pick by job: <strong>scp</strong> for a quick one-off copy, <strong>sftp</strong> for interactive browsing, <strong>rsync</strong> for anything you will repeat or anything large." },
              { t: "code", lang: "bash", code:
                "scp report.pdf web1:/tmp/                  # one file up\n" +
                "scp -r web1:/var/log/app ./app-logs        # a directory down\n" +
                "sftp web1                                  # interactive: ls, cd, get, put, exit" },
              { t: "p", html: "Recent OpenSSH releases (from 9.0) run <code class='tok'>scp</code> over the SFTP protocol instead of the legacy scp protocol, which removes a class of quoting and filename-injection problems. A few wildcard and quoting behaviours changed with it; <code class='tok'>scp -O</code> forces the old protocol for ancient servers that lack SFTP." },
              { t: "h", text: "rsync: only what changed" },
              { t: "code", lang: "bash", code:
                "rsync -avz --progress ./site/ web1:/srv/site/\n" +
                "rsync -avz -e 'ssh -p 2222' ./site/ deploy@10.0.4.17:/srv/site/\n" +
                "rsync -av --exclude '.git/' --exclude 'node_modules/' ./app/ web1:/srv/app/\n" +
                "rsync -av --partial --progress big.iso web1:/data/      # resume after a dropped link" },
              { t: "table", headers: ["Flag", "Meaning"], rows: [
                ["<code class='tok'>-a</code>", "archive: recurse and keep permissions, times, symlinks, owner and group where allowed"],
                ["<code class='tok'>-v</code> / <code class='tok'>--progress</code>", "list files / show per-file progress (<code class='tok'>-P</code> = <code class='tok'>--partial --progress</code>)"],
                ["<code class='tok'>-z</code>", "compress in transit: helps on slow links, wastes CPU on fast ones or with already-compressed files"],
                ["<code class='tok'>-n</code> / <code class='tok'>--dry-run</code>", "show what would happen, change nothing"],
                ["<code class='tok'>--delete</code>", "remove files on the destination that are not in the source"],
                ["<code class='tok'>-c</code> / <code class='tok'>--checksum</code>", "compare by checksum instead of size and modification time (slower, reads everything)"],
                ["<code class='tok'>-e 'ssh -p 2222'</code>", "custom remote shell command; usually better expressed in ~/.ssh/config"]
              ] },
              { t: "h", text: "The trailing-slash rule" },
              { t: "compare",
                bad: { title: "rsync -av site web1:/srv/", items: ["Copies the directory itself", "Result: /srv/site/index.html", "Run it against /srv/site/ and you get /srv/site/site/"] },
                good: { title: "rsync -av site/ web1:/srv/site/", items: ["Copies the contents of site", "Result: /srv/site/index.html", "Slash on the source means 'what is inside'"] } },
              { t: "note", variant: "trap", html: "<strong>Preview every --delete.</strong> A wrong slash or a swapped source and destination with <code class='tok'>--delete</code> wipes real data. Run the exact command with <code class='tok'>--dry-run</code> first, read the <em>deleting</em> lines, then remove the flag." },
              { t: "code", lang: "text", code:
                "$ rsync -av --delete --dry-run ./site/ web1:/srv/site/\n" +
                "sending incremental file list\n" +
                "deleting old-banner.png\n" +
                "index.html\n" +
                "css/app.css\n\n" +
                "sent 412 bytes  received 61 bytes  946.00 bytes/sec\n" +
                "total size is 48,211  speedup is 101.93 (DRY RUN)" },
              { t: "p", html: "By default rsync's quick check skips files whose size and modification time match, then transfers only changed blocks of the rest. That is fast, but a tool that rewrites files while preserving timestamps can fool it; <code class='tok'>--checksum</code> trades time for certainty." },
              { t: "h2", text: "macOS rsync is not the rsync you think" },
              { t: "p", html: "For years macOS shipped rsync 2.6.9, which is very old and lacks newer options such as <code class='tok'>--info=progress2</code>; recent macOS versions replace it with <em>openrsync</em>, a separate implementation that supports a smaller set of flags. Check with <code class='tok'>rsync --version</code>, and install current rsync with <code class='tok'>brew install rsync</code> when you need modern behaviour. The server side runs its own rsync, so both ends matter." },
              { t: "quiz", id: "ssh-remote" },
              { t: "note", variant: "key", html: "<strong>scp for one-offs, rsync for everything you repeat.</strong> Mind the trailing slash, dry-run every --delete, and check which rsync your Mac is actually running." }
            ]
          }
        ]
      }
    ]
  };
})();

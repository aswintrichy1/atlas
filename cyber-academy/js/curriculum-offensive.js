/* =====================================================================
   CITADEL · Offensive Security curriculum
   window.TRACKS.offensive  ·  block grammar documented in curriculum-core.js
   Framing is strictly ethical & defensive: authorized testing only, no
   weaponized payloads. The goal is to understand attacker methodology so
   you can defend, and to test your OWN systems with permission.
   ===================================================================== */
window.TRACKS = window.TRACKS || {};
window.TRACKS.offensive = {
  id: "offensive",
  name: "Offensive Security",
  short: "OFFENSE",
  tagline: "Think like an attacker — legally",
  color: "#fb923c",
  blurb: "The attacker's methodology, taught for defenders: ethics and the law, the penetration-testing lifecycle, reconnaissance and OSINT, scanning and enumeration, the CVE/CVSS vulnerability ecosystem, what exploits and payloads really are, coordinated disclosure, a web-app testing method, and how findings become a report that gets things fixed.",
  modules: [
    /* ============================ METHODOLOGY ============================ */
    {
      id: "methodology",
      name: "Ethical hacking",
      icon: "target",
      lessons: [
        {
          id: "ethics-law",
          title: "Ethics, law & authorization",
          summary: "The single thing that separates a security professional from a criminal is permission. Start here, always.",
          minutes: 7,
          tags: ["ethics", "legal", "intro"],
          blocks: [
            { t: "p", html: "Every technique in this track is dual-use. The same port scan that helps a defender find exposed services is, run against a system you don't own, potentially a crime. <strong>Authorization is the line</strong> — and it is bright, not blurry." },
            { t: "note", variant: "warn", html: "Accessing a computer system without authorization is illegal in most of the world (the US <strong>CFAA</strong>, the UK <strong>Computer Misuse Act</strong>, and equivalents elsewhere). \u201cI was just learning\u201d is not a defense. Practice only on systems you own or are explicitly permitted to test." },
            { t: "h", text: "The hats, honestly" },
            {
              t: "table",
              headers: ["Type", "Authorization", "Intent"],
              rows: [
                ["<strong>White hat</strong>", "Explicit, written", "Improve security"],
                ["<strong>Black hat</strong>", "None", "Personal gain / harm"],
                ["<strong>Grey hat</strong>", "None, but \u201cgood\u201d intent", "Murky \u2014 still usually illegal"]
              ]
            },
            { t: "p", html: "The grey-hat middle is a trap: probing a stranger's site \u201cto help\u201d is still unauthorized access, however good your intentions. The legitimate route to test systems you don't own is a <strong>bug bounty</strong> or a <strong>vulnerability disclosure program (VDP)</strong>, which grant permission within a defined scope." },
            { t: "h", text: "What authorization actually looks like" },
            {
              t: "ul", items: [
                "<strong>Scope</strong> \u2014 exactly which IPs, domains, and apps are in play (and which are off-limits).",
                "<strong>Rules of engagement (RoE)</strong> \u2014 allowed techniques, timing windows, who to call if something breaks.",
                "<strong>Written permission</strong> \u2014 a signed contract or a published bug-bounty policy. Verbal \u201csure, go ahead\u201d is not enough.",
                "<strong>Data handling</strong> \u2014 what you may access, how you store findings, and how you destroy them after."
              ]
            },
            { t: "note", variant: "key", html: "A professional's first deliverable is not a finding \u2014 it's a clear scope and signed authorization. If you can't point to written permission for a target, you do not have permission." },
            { t: "note", variant: "tip", html: "Build your skills in places designed for it: your own home lab, intentionally vulnerable practice apps you run locally, and capture-the-flag events. You never need someone else's production system to learn." }
          ]
        },
        {
          id: "pentest-lifecycle",
          title: "The penetration-testing lifecycle",
          summary: "A real engagement is a disciplined process, not a smash-and-grab. Seven phases turn chaos into a repeatable method.",
          minutes: 8,
          tags: ["pentest", "methodology"],
          blocks: [
            { t: "p", html: "A <strong>penetration test</strong> is an authorized, simulated attack that measures how far a real adversary could get. The value is not \u201cwe got in\u201d \u2014 it's a prioritized, reproducible list of what to fix. Professionals follow a lifecycle so nothing is missed and everything is repeatable." },
            { t: "p", html: "Step through the phases below to see how an engagement actually flows from a signed contract to a retest." },
            { t: "widget", id: "pentest" },
            { t: "h", text: "Box colors: how much you're told" },
            {
              t: "table",
              headers: ["Style", "Tester knows", "Simulates"],
              rows: [
                ["<strong>Black box</strong>", "Nothing (just a target)", "An external attacker from scratch"],
                ["<strong>Grey box</strong>", "Some access / docs", "A user or partner with a foothold"],
                ["<strong>White box</strong>", "Full source & architecture", "A thorough, efficient audit"]
              ]
            },
            { t: "note", variant: "key", html: "Grey box is often the best value: giving the tester a normal user account skips weeks of brute-forcing the front door and spends the budget on the deeper flaws an insider or a phished employee could reach." },
            { t: "h", text: "Pentest vs the neighbors" },
            {
              t: "ul", items: [
                "<strong>Vulnerability scan</strong> \u2014 automated, broad, finds known issues. Cheap, noisy, no exploitation.",
                "<strong>Penetration test</strong> \u2014 human-driven, proves real impact by chaining flaws within a scope.",
                "<strong>Red team</strong> \u2014 goal-driven, stealthy, tests detection & response over weeks (not just \u201cfind all bugs\u201d).",
                "<strong>Purple team</strong> \u2014 red and blue working together live to improve detection."
              ]
            },
            { t: "note", variant: "trap", html: "A clean pentest report doesn't mean \u201cunhackable.\u201d It means \u201cno one found these things in this scope, in this timebox.\u201d Security is a continuous practice, not a certificate." }
          ]
        },
        {
          id: "recon-osint",
          title: "Reconnaissance & OSINT",
          summary: "Attacks begin with research. Most of it is passive, public, and invisible to the target — which is exactly why defenders must know their own footprint.",
          minutes: 8,
          tags: ["recon", "osint"],
          blocks: [
            { t: "p", html: "<strong>Reconnaissance</strong> is the homework phase. <strong>Passive recon</strong> gathers information without touching the target \u2014 search engines, DNS records, certificate logs, public code, social media, breach dumps. <strong>Active recon</strong> interacts with the target (scanning) and can be detected." },
            { t: "p", html: "<strong>OSINT</strong> (open-source intelligence) is the craft of turning scattered public data into a map of the target. The unsettling part: a thorough OSINT profile can be built without sending the target a single packet." },
            { t: "p", html: "Explore what public sources quietly reveal about an organization \u2014 then read it as the defender whose attack surface that is." },
            { t: "widget", id: "osint" },
            { t: "h", text: "Where the footprint leaks" },
            {
              t: "table",
              headers: ["Source", "Exposes"],
              rows: [
                ["DNS & certificate logs", "Subdomains, mail servers, internal naming"],
                ["WHOIS / registration", "Owners, emails, infrastructure"],
                ["Job postings", "Exact tech stack (\u201cmust know Django + Okta\u201d)"],
                ["Public code & docs", "API keys, internal URLs, logic"],
                ["Social media", "Names, roles, org chart, phishing pretexts"],
                ["Breach databases", "Reused passwords, valid emails"],
                ["File metadata", "Usernames, software versions, paths"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>Defense is reducing your own footprint.</strong> Scrub metadata from published files, keep internal hostnames out of public DNS, monitor certificate-transparency logs for surprise subdomains, and assume anything an employee posts is recon fuel." },
            { t: "note", variant: "trap", html: "OSINT is also the engine of social engineering. The org chart someone posts on LinkedIn becomes the \u201cHi, it's your CFO\u201d pretext. Security awareness is part of your recon defense." },
            { t: "quiz", id: "offensive-methodology" }
          ]
        }
      ]
    },
    /* ============================ FINDING FLAWS ============================ */
    {
      id: "findingflaws",
      name: "Finding the flaws",
      icon: "search",
      lessons: [
        {
          id: "scanning-enum",
          title: "Scanning & enumeration",
          summary: "Turn a list of hosts into a map of services, versions, and the soft spots — and understand what that looks like from the blue side.",
          minutes: 8,
          tags: ["scanning", "enumeration"],
          blocks: [
            { t: "p", html: "Once a target is in scope, the attacker builds a map: which hosts are alive, which <strong>ports</strong> are open, which <strong>services</strong> and <strong>versions</strong> run on them, and what each reveals. This is <strong>scanning</strong> (is it there?) followed by <strong>enumeration</strong> (what exactly is it?)." },
            { t: "h", text: "The scanning ladder" },
            {
              t: "ol", items: [
                "<strong>Host discovery</strong> \u2014 which IPs respond at all (ping sweeps, ARP).",
                "<strong>Port scanning</strong> \u2014 which TCP/UDP ports are open, closed, or filtered.",
                "<strong>Service & version detection</strong> \u2014 banner grabbing to learn \u201cnginx 1.18\u201d not just \u201cport 80.\u201d",
                "<strong>Enumeration</strong> \u2014 pulling users, shares, directories, endpoints from those services."
              ]
            },
            { t: "p", html: "Knowing the well-known ports by heart speeds all of this up. A handful map to most of what you'll meet:" },
            {
              t: "table",
              headers: ["Port", "Service", "Why it matters"],
              rows: [
                ["22", "SSH", "Remote admin \u2014 prime brute-force target"],
                ["80 / 443", "HTTP / HTTPS", "Web apps \u2014 the biggest attack surface"],
                ["53", "DNS", "Enumeration goldmine"],
                ["445", "SMB", "File shares, lateral movement"],
                ["3389", "RDP", "Remote desktop \u2014 ransomware's favorite door"],
                ["3306 / 5432", "MySQL / Postgres", "Databases that should never face the internet"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>The defender's mirror image:</strong> every scan leaves traces. A burst of connections across many ports is exactly what your IDS and firewall logs should flag. Reducing attack surface (close unused ports, segment, rate-limit) is how you make enumeration expensive." },
            { t: "compare",
              bad: { title: "Wide-open host", items: ["Dozens of ports listening", "Verbose version banners", "Default credentials on services", "Databases exposed to the internet"] },
              good: { title: "Hardened host", items: ["Only required ports open", "Banners minimized", "Strong, unique credentials + MFA", "Data tier reachable only from app tier"] }
            },
            { t: "note", variant: "trap", html: "Aggressive scans can crash fragile services (old printers, industrial gear, IoT). On a real engagement, the rules of engagement dictate scan intensity \u2014 \u201cwe took down the warehouse\u201d is a career-limiting move." }
          ]
        },
        {
          id: "vulns-cve-cvss",
          title: "Vulnerabilities, CVE & CVSS",
          summary: "The shared language of 'what's wrong and how bad': CVE identifiers, CVSS scores, and the signals that say 'patch this first.'",
          minutes: 8,
          tags: ["vulnerabilities", "cvss", "cve"],
          blocks: [
            { t: "p", html: "When a weakness is discovered, the world needs to talk about it precisely. The <strong>CVE</strong> (Common Vulnerabilities and Exposures) system gives each public vulnerability a unique id like <code>CVE-2021-44228</code>, so everyone means the same bug. <strong>CVSS</strong> then scores its severity 0\u201310." },
            { t: "h", text: "Score a vulnerability yourself" },
            { t: "p", html: "CVSS turns the character of a flaw \u2014 how it's reached, how hard it is, what it harms \u2014 into a number. Move the controls and watch the base score and severity change." },
            { t: "widget", id: "cvss" },
            { t: "h", text: "Severity isn't the whole story" },
            {
              t: "ul", items: [
                "<strong>CVSS base score</strong> \u2014 intrinsic technical severity (the number everyone quotes).",
                "<strong>EPSS</strong> \u2014 the probability the flaw will be exploited in the wild soon. Great for prioritization.",
                "<strong>CISA KEV</strong> \u2014 vulnerabilities <em>known to be actively exploited</em>. If it's on KEV, it jumps the queue.",
                "<strong>Context</strong> \u2014 is the asset internet-facing? Does it hold crown-jewel data? A 9.8 on an isolated box may matter less than a 6 on your login."
              ]
            },
            { t: "note", variant: "key", html: "<strong>Risk = severity \u00d7 exposure \u00d7 asset value.</strong> Patch by real-world risk, not by CVSS alone. A scanner that sorts only by CVSS will have you fixing unreachable criticals while an exploited medium burns." },
            { t: "h", text: "The vulnerability-management loop" },
            {
              t: "ol", items: [
                "<strong>Discover</strong> \u2014 scan and inventory (you can't patch what you don't know you run).",
                "<strong>Prioritize</strong> \u2014 combine CVSS, EPSS, KEV, and exposure.",
                "<strong>Remediate</strong> \u2014 patch, mitigate, or accept with sign-off.",
                "<strong>Verify</strong> \u2014 rescan to confirm the fix actually closed it."
              ]
            },
            { t: "note", variant: "tip", html: "Log4Shell (<code>CVE-2021-44228</code>) was a CVSS 10.0 in a logging library buried inside thousands of apps. It's the textbook case for why a software inventory (SBOM) turns \u201care we affected?\u201d from days of panic into a single query." }
          ]
        },
        {
          id: "exploits-disclosure",
          title: "Exploits, payloads & disclosure",
          summary: "What an exploit and a payload actually are, conceptually — and the responsible path from 'I found a bug' to 'it's fixed.'",
          minutes: 7,
          tags: ["exploits", "disclosure", "ethics"],
          blocks: [
            { t: "p", html: "Two words get thrown around loosely. An <strong>exploit</strong> is the technique that turns a vulnerability into actual unintended behavior. A <strong>payload</strong> is what runs once the exploit succeeds \u2014 the \u201cnow do this\u201d part. We cover these <em>conceptually</em>, as a defender must understand them, not as a how-to." },
            {
              t: "table",
              headers: ["Term", "Plain meaning"],
              rows: [
                ["<strong>Vulnerability</strong>", "The weakness (an unlocked window)"],
                ["<strong>Exploit</strong>", "The method of using it (climbing through)"],
                ["<strong>Payload</strong>", "What you do once inside (the action)"],
                ["<strong>Zero-day</strong>", "A vuln with no patch available yet"],
                ["<strong>N-day</strong>", "A known, patched vuln \u2014 still works on the unpatched"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>Most real attacks use n-days, not zero-days.</strong> Defenders sometimes obsess over exotic zero-days while last quarter's patched CVE sits unapplied on an internet-facing server. Patch hygiene beats exotic fears." },
            { t: "h", text: "Coordinated disclosure: the honorable path" },
            { t: "p", html: "Found a real flaw in someone else's product? The professional route is <strong>coordinated (responsible) disclosure</strong>: report privately, give the vendor reasonable time to fix, then (often) publish once a patch exists." },
            {
              t: "ol", items: [
                "<strong>Report privately</strong> via the vendor's security contact, VDP, or bug-bounty platform.",
                "<strong>Provide detail</strong> \u2014 clear reproduction steps and impact, no drama.",
                "<strong>Agree a timeline</strong> \u2014 commonly ~90 days before public details.",
                "<strong>Coordinate the release</strong> \u2014 publish once users can protect themselves."
              ]
            },
            { t: "compare",
              bad: { title: "Full drop / extortion", items: ["Publish a working exploit with no warning", "Demand payment to stay quiet", "Test the bug on the live site without permission"], },
              good: { title: "Coordinated disclosure", items: ["Private report first, within scope", "Reasonable time to patch", "Public write-up after the fix \u2014 credit, not chaos"] }
            },
            { t: "note", variant: "warn", html: "Selling exploits to the highest bidder or extorting a vendor crosses from research into crime. A bug-bounty program is the legal, paid, and reputation-building way to be rewarded for finding flaws." },
            { t: "quiz", id: "offensive-findingflaws" }
          ]
        }
      ]
    },
    /* ============================ WEB HACKING ============================ */
    {
      id: "webhacking",
      name: "Web hacking & beyond",
      icon: "globe",
      lessons: [
        {
          id: "web-methodology",
          title: "A web-application testing method",
          summary: "Where the bugs actually live, and a repeatable way to walk an app from map to findings.",
          minutes: 8,
          tags: ["web", "methodology"],
          blocks: [
            { t: "p", html: "Web apps are the biggest attack surface most organizations have, so testers need a system. The method is always the same shape: <strong>map</strong> the app, <strong>discover</strong> inputs and trust boundaries, then <strong>test</strong> each category methodically. The AppSec track covered the flaws in depth; here is the map a tester carries." },
            { t: "h", text: "The big categories, by where they live" },
            {
              t: "table",
              headers: ["Layer", "Classic flaws"],
              rows: [
                ["<strong>Server-side</strong>", "SQL & command injection, path traversal, file upload, SSRF, deserialization, business-logic abuse"],
                ["<strong>Client-side</strong>", "XSS, CSRF, CORS misconfig, clickjacking, DOM issues"],
                ["<strong>Auth & session</strong>", "Broken access control, weak auth, JWT/OAuth flaws, fixation"],
                ["<strong>Config & supply chain</strong>", "Misconfiguration, exposed secrets, vulnerable dependencies"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>Access control is consistently #1.</strong> The highest-value test is rarely an exotic injection \u2014 it's logging in as a low-privilege user and methodically trying to reach data and actions that should be off-limits (change an id, replay an admin request)." },
            { t: "h", text: "How a tester walks an app" },
            {
              t: "ol", items: [
                "<strong>Map</strong> \u2014 crawl every page, endpoint, and parameter; note roles and trust boundaries.",
                "<strong>Discover inputs</strong> \u2014 every place user data enters: forms, headers, cookies, APIs, file uploads.",
                "<strong>Test per category</strong> \u2014 walk the list above against each input, on the server side.",
                "<strong>Chain</strong> \u2014 combine small issues (info leak + weak check) into real impact.",
                "<strong>Document</strong> \u2014 capture reproduction the moment it works."
              ]
            },
            { t: "note", variant: "tip", html: "An intercepting proxy (a tool that sits between browser and server so you can inspect and modify every request) is the web tester's core instrument. Conceptually, it makes the client-side trust boundary visible \u2014 and reminds you why the server must re-check everything." },
            { t: "note", variant: "trap", html: "Automated scanners find the easy, known categories. The high-severity findings \u2014 broken access control and business-logic flaws \u2014 almost always need a human who understands what the app is <em>supposed</em> to allow." }
          ]
        },
        {
          id: "privesc-postex",
          title: "Privilege escalation & post-exploitation",
          summary: "A foothold is the beginning, not the end. Understanding what comes next is what makes least privilege and segmentation feel urgent.",
          minutes: 7,
          tags: ["privilege-escalation", "lateral-movement"],
          blocks: [
            { t: "p", html: "Getting a single low-privilege foothold is rarely the goal. What turns a minor breach into a catastrophe is everything <em>after</em>: escalating privileges, moving laterally, establishing persistence, and reaching the crown jewels. Knowing this chain is what makes defensive controls feel concrete." },
            { t: "h", text: "The post-exploitation chain (defender's view)" },
            {
              t: "table",
              headers: ["Attacker step", "What stops it"],
              rows: [
                ["<strong>Privilege escalation</strong> \u2014 user \u2192 admin/root", "Patching, least privilege, no risky SUID/sudo"],
                ["<strong>Credential access</strong> \u2014 dump passwords/tokens", "Credential hygiene, no plaintext secrets, MFA"],
                ["<strong>Lateral movement</strong> \u2014 hop to other hosts", "Network segmentation, unique local creds"],
                ["<strong>Persistence</strong> \u2014 survive reboots", "Integrity monitoring, EDR, baselining"],
                ["<strong>Exfiltration / impact</strong>", "DLP, egress filtering, backups, alerting"]
              ]
            },
            { t: "note", variant: "key", html: "Every defensive idea from the other tracks has its purpose here. <strong>Least privilege</strong> blunts escalation; <strong>segmentation</strong> blunts lateral movement; <strong>credential hygiene</strong> blunts the pivot. The attack chain is the argument for all of them." },
            { t: "p", html: "These steps map directly onto the later stages of the kill chain and the MITRE ATT&CK tactics \u2014 the same vocabulary defenders use to describe what they're watching for. We go deep on ATT&CK in the Threats track." },
            { t: "note", variant: "trap", html: "\u201cAssume breach\u201d exists because of this lesson. Design as if an attacker already holds one valid account, then ask how far they get. If the answer is \u201ceverywhere,\u201d your network is flat and your privileges are too broad." }
          ]
        },
        {
          id: "reporting",
          title: "Reporting & remediation",
          summary: "The deliverable that actually improves security isn't the shell — it's a clear report that gets the flaw fixed and verified.",
          minutes: 6,
          tags: ["reporting", "process"],
          blocks: [
            { t: "p", html: "An engagement that finds ten criticals but produces a report no one can act on has failed. The <strong>report is the product</strong>. A good finding is reproducible, risk-rated, and paired with a concrete fix \u2014 written so both an engineer and an executive can use it." },
            { t: "h", text: "What every finding needs" },
            {
              t: "ul", items: [
                "<strong>Title & severity</strong> \u2014 plain-language name plus a risk rating (with CVSS where useful).",
                "<strong>Impact</strong> \u2014 what an attacker could actually do, in business terms.",
                "<strong>Reproduction</strong> \u2014 exact, ordered steps so the team can see it themselves.",
                "<strong>Evidence</strong> \u2014 screenshots/requests, with sensitive data handled carefully.",
                "<strong>Remediation</strong> \u2014 a specific, actionable fix, not \u201cvalidate input.\u201d"
              ]
            },
            { t: "note", variant: "key", html: "Pair every finding with a <strong>fix</strong> and a <strong>retest</strong>. The loop only closes when a remediated issue is rescanned and confirmed gone. \u201cReported\u201d is not \u201cresolved.\u201d" },
            { t: "h", text: "Writing for two audiences" },
            { t: "compare",
              bad: { title: "A report that gathers dust", items: ["Raw tool output dumped in", "No business impact", "Vague fixes (\u201cbe more secure\u201d)", "No prioritization \u2014 everything's \u201chigh\u201d"] },
              good: { title: "A report that drives change", items: ["Executive summary + technical detail", "Impact in money/trust terms", "Specific, testable remediation", "Ranked by real risk, with a retest plan"] }
            },
            { t: "note", variant: "tip", html: "The best testers are valued for their writing as much as their hacking. Translating \u201cI chained an IDOR with a weak token\u201d into \u201ca logged-in customer can read any other customer's invoices\u201d is the skill that gets things fixed." },
            { t: "quiz", id: "offensive-webhacking" }
          ]
        }
      ]
    }
  ]
};

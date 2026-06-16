/* =====================================================================
   CITADEL · Domains & Practice curriculum
   window.TRACKS.domains  ·  block grammar documented in curriculum-core.js
   Breadth topics + a practical, ethical path to keep learning by doing.
   ===================================================================== */
window.TRACKS = window.TRACKS || {};
window.TRACKS.domains = {
  id: "domains",
  name: "Domains & Practice",
  short: "DOMAINS",
  tagline: "Breadth, infrastructure & a path forward",
  color: "#38bdf8",
  blurb: "The specialized domains and the practical path: networking and protocols, Linux security and permissions, wireless security from WEP to WPA3, cloud and the shared-responsibility model, containers and DevSecOps, the security-tooling landscape, and how to keep growing through CTFs, a safe home lab, certifications and community.",
  modules: [
    /* ============================ INFRASTRUCTURE ============================ */
    {
      id: "infra",
      name: "Infrastructure security",
      icon: "share",
      lessons: [
        {
          id: "networking",
          title: "Networking & protocols, fast",
          summary: "You can't secure what you can't trace. The minimum networking every defender and tester needs in their bones.",
          minutes: 8,
          tags: ["networking", "protocols"],
          blocks: [
            { t: "p", html: "Security lives on the network, so a working model of how packets move is non-negotiable. The <strong>TCP/IP</strong> layers are the mental model: each adds an envelope around the one above, and attacks and defenses live at every layer." },
            {
              t: "table",
              headers: ["Layer", "Unit", "Examples", "Security touchpoint"],
              rows: [
                ["Application", "Data", "HTTP, DNS, TLS, SSH", "App attacks, encryption"],
                ["Transport", "Segment", "TCP, UDP", "Ports, firewalls, scanning"],
                ["Internet", "Packet", "IP, ICMP", "Routing, IP spoofing"],
                ["Link", "Frame", "Ethernet, ARP, Wi-Fi", "ARP spoofing, LAN attacks"]
              ]
            },
            { t: "h", text: "Addresses, ports & subnets" },
            { t: "p", html: "An <strong>IP address</strong> identifies a host; a <strong>port</strong> identifies a service on it. A <strong>subnet</strong> (written in CIDR like <code>192.168.1.0/24</code>) groups addresses so you can route and, crucially, <em>segment</em> them. Compute a subnet's range below \u2014 the same math that decides what a firewall rule covers." },
            { t: "widget", id: "subnet" },
            { t: "h", text: "Protocols worth knowing cold" },
            {
              t: "ul", items: [
                "<strong>DNS</strong> \u2014 names \u2192 addresses; a recon goldmine and a covert-channel risk.",
                "<strong>HTTP/HTTPS</strong> \u2014 the web; TLS makes it private and authenticated.",
                "<strong>TCP vs UDP</strong> \u2014 reliable, connection-oriented vs fast, connectionless.",
                "<strong>ARP / DHCP</strong> \u2014 local-network glue, and classic spoofing targets.",
                "<strong>NAT</strong> \u2014 many private hosts behind one public IP; not a security control by itself."
              ]
            },
            { t: "note", variant: "key", html: "<strong>Segmentation is applied subnetting.</strong> Put the database in its own subnet that only the app subnet can reach, and a foothold on a laptop can't talk to it. The CIDR math above is literally how you write that boundary." },
            { t: "note", variant: "trap", html: "NAT and private IPs are not a firewall. Hosts behind NAT can still be reached through port forwards, SSRF, and outbound-initiated tunnels. \u201cIt's on a private IP\u201d is not the same as \u201cit's protected.\u201d" }
          ]
        },
        {
          id: "linux-security",
          title: "Linux security & permissions",
          summary: "Most servers run Linux, and most Linux compromise is about permissions. Learn the model that controls who can do what.",
          minutes: 8,
          tags: ["linux", "hardening"],
          blocks: [
            { t: "p", html: "The internet runs on Linux, so defenders and testers alike must speak it. The heart of Linux security is its <strong>permission model</strong> \u2014 a simple owner/group/other scheme that, misconfigured, is a top cause of privilege escalation." },
            { t: "h", text: "Read, write, execute \u2014 for owner, group, other" },
            { t: "p", html: "Every file grants <strong>r</strong>ead, <strong>w</strong>rite, and e<strong>x</strong>ecute independently to its owner, its group, and everyone else. Toggle the bits below to see the symbolic and octal forms together (the <code>chmod 755</code> you'll type for the rest of your life)." },
            { t: "widget", id: "permissions" },
            { t: "h", text: "Where Linux privilege escalation comes from" },
            {
              t: "table",
              headers: ["Surface", "Risk", "Defense"],
              rows: [
                ["<strong>sudo</strong> misconfig", "User runs commands as root", "Least-privilege sudoers, audit it"],
                ["<strong>SUID</strong> binaries", "Run as the file's owner (often root)", "Inventory & minimize SUID bits"],
                ["World-writable files", "Anyone edits a privileged script", "Tight permissions, no <code>777</code>"],
                ["Weak service accounts", "Cracked/!reused credentials", "Unique creds, keys over passwords"],
                ["Unpatched kernel/pkgs", "Known local exploits", "Patch; minimize installed software"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>The root account is the prize.</strong> Most Linux attacks chain a normal-user foothold into root via one of the rows above. Least privilege, a minimal SUID set, and patching close the common paths \u2014 the same principles, made concrete." },
            { t: "note", variant: "tip", html: "Hardening baselines (like the CIS Benchmarks) turn this into a checklist: disable root SSH login, enforce key-based auth, remove unused packages and services, enable the firewall, and ship logs off the box. Boring, and hugely effective." }
          ]
        },
        {
          id: "wireless",
          title: "Wireless security",
          summary: "Wi-Fi puts your network in the air for anyone nearby. The encryption standard you choose decides whether that matters.",
          minutes: 7,
          tags: ["wireless", "wifi"],
          blocks: [
            { t: "p", html: "Wireless removes the wire \u2014 and with it the physical control that protected the LAN. Anyone in range can hear the radio, so <strong>Wi-Fi security is entirely about the encryption standard</strong> and how keys are handled. The history here is a clear march from broken to solid." },
            { t: "p", html: "Compare the generations and see why only the last two belong on a modern network." },
            { t: "widget", id: "wifi" },
            { t: "h", text: "PSK vs Enterprise" },
            {
              t: "ul", items: [
                "<strong>Personal (PSK)</strong> \u2014 one shared passphrase for everyone. Simple; the whole network's safety rests on one secret.",
                "<strong>Enterprise (802.1X)</strong> \u2014 each user authenticates individually against a server (RADIUS). Revoke one person without changing everyone's key.",
                "Enterprise is the right call for organizations; PSK is fine for home if the passphrase is long and unique."
              ]
            },
            { t: "h", text: "Common wireless attacks (and the defense)" },
            {
              t: "table",
              headers: ["Attack", "Idea", "Defense"],
              rows: [
                ["<strong>Evil twin</strong>", "Fake AP impersonating yours", "Verify networks; WPA3; 802.1X"],
                ["<strong>Deauth</strong>", "Force clients to disconnect", "WPA3 protected management frames"],
                ["<strong>Handshake capture</strong>", "Grab + crack the PSK offline", "Long, random passphrase; WPA3"],
                ["<strong>Rogue AP</strong>", "Unauthorized AP on your LAN", "Wireless monitoring; port security"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>Use WPA3 where you can, WPA2 at minimum.</strong> WEP and the original WPA are broken \u2014 treat them as plaintext. A long, unique passphrase (or Enterprise auth) is what stands between your traffic and anyone with an antenna." },
            { t: "quiz", id: "domains-infra" }
          ]
        }
      ]
    },
    /* ============================ CLOUD & MODERN ============================ */
    {
      id: "modern",
      name: "Cloud & modern",
      icon: "globe",
      lessons: [
        {
          id: "cloud-security",
          title: "Cloud security & shared responsibility",
          summary: "The cloud didn't delete your security work — it moved the line. Knowing where that line sits prevents most cloud breaches.",
          minutes: 8,
          tags: ["cloud", "shared-responsibility"],
          blocks: [
            { t: "p", html: "Moving to the cloud changes <em>who</em> secures <em>what</em>, not whether security is needed. The <strong>shared responsibility model</strong> is the contract: the provider secures the cloud's infrastructure; <strong>you</strong> secure what you put in it \u2014 your data, identities, and configuration." },
            {
              t: "table",
              headers: ["", "Provider secures", "You secure"],
              rows: [
                ["<strong>IaaS</strong>", "Physical, hypervisor, network", "OS, apps, data, access, config"],
                ["<strong>PaaS</strong>", "+ OS & runtime", "Apps, data, access, config"],
                ["<strong>SaaS</strong>", "+ the application", "Your data & who can access it"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>Almost every cloud breach is a customer-side misconfiguration</strong> \u2014 a public storage bucket, an over-permissive IAM role, an open security group. The provider's data center is rarely the problem; your settings are." },
            { t: "h", text: "Where cloud breaches actually come from" },
            {
              t: "ul", items: [
                "<strong>Public storage</strong> \u2014 buckets set to world-readable.",
                "<strong>Over-broad IAM</strong> \u2014 wildcard permissions, long-lived keys, no MFA.",
                "<strong>Exposed services</strong> \u2014 databases and dashboards open to the internet.",
                "<strong>Leaked keys</strong> \u2014 cloud credentials committed to a public repo.",
                "<strong>Metadata abuse</strong> \u2014 SSRF reaching the instance metadata service for credentials."
              ]
            },
            { t: "note", variant: "tip", html: "Identity is the new perimeter in cloud. <strong>Least-privilege IAM, MFA everywhere, short-lived credentials</strong>, and automated config checks (CSPM) prevent the large majority of incidents. The principles are familiar; the surface is new." },
            { t: "note", variant: "trap", html: "\u201cThe cloud is automatically secure\u201d is the costliest myth in the field. The provider gives you secure <em>building blocks</em>; stacking them safely \u2014 and not leaving the door open \u2014 is still entirely your job." }
          ]
        },
        {
          id: "containers-devsecops",
          title: "Containers & DevSecOps",
          summary: "Ship fast without shipping holes: securing images, pipelines, and infrastructure as code by building security in.",
          minutes: 7,
          tags: ["containers", "devsecops"],
          blocks: [
            { t: "p", html: "Modern delivery is containers and automated pipelines. <strong>DevSecOps</strong> is the idea that security must be built <em>into</em> that flow \u2014 not bolted on at the end \u2014 so it moves at the same speed as everything else. The slogan is <strong>shift left</strong>: catch issues during development, where they're cheapest." },
            { t: "h", text: "Securing the container life cycle" },
            {
              t: "ul", items: [
                "<strong>Images</strong> \u2014 start from minimal, trusted base images; scan for known-vulnerable packages.",
                "<strong>Secrets</strong> \u2014 inject at runtime from a vault; never bake them into an image layer.",
                "<strong>Isolation</strong> \u2014 don't run as root in the container; drop capabilities; limit resources.",
                "<strong>Registry</strong> \u2014 sign images and verify signatures before deploy.",
                "<strong>Runtime</strong> \u2014 watch for containers doing things their image never should."
              ]
            },
            { t: "note", variant: "key", html: "<strong>A container is isolation, not a security boundary as strong as a VM.</strong> They share the host kernel, so a kernel exploit or a misconfigured privileged container can break out. Keep hosts patched and containers unprivileged." },
            { t: "h", text: "Pipeline & infrastructure as code" },
            {
              t: "ul", items: [
                "<strong>SAST/DAST/SCA</strong> in CI \u2014 scan code, running apps, and dependencies automatically.",
                "<strong>IaC scanning</strong> \u2014 catch an insecure cloud config (a public bucket) before it's ever deployed.",
                "<strong>Locked pipelines</strong> \u2014 a poisoned build step ships to everyone, so guard CI/CD like production."
              ]
            },
            { t: "note", variant: "trap", html: "The pipeline is a high-value target precisely because it's trusted to deploy. Supply-chain attacks aim at the build system, not the app \u2014 so least privilege, signed artifacts, and integrity checks apply to your tooling too." }
          ]
        },
        {
          id: "tooling",
          title: "The security tooling landscape",
          summary: "A map of the categories of tools you'll meet — so the names in job posts and write-ups stop being a blur.",
          minutes: 6,
          tags: ["tools", "overview"],
          blocks: [
            { t: "p", html: "Security has a vast tool ecosystem, and the names can overwhelm. What matters first is the <strong>category</strong> \u2014 what job a class of tool does. The specific product is interchangeable; the role it plays is what you reason about." },
            {
              t: "table",
              headers: ["Category", "Job it does", "Used by"],
              rows: [
                ["Recon / scanning", "Map hosts, ports, services", "Testers, defenders"],
                ["Vulnerability scanners", "Find known weaknesses at scale", "Both"],
                ["Web proxies", "Inspect & modify web traffic", "Web testers"],
                ["Exploitation frameworks", "Validate impact (authorized)", "Pentesters / red team"],
                ["SIEM", "Centralize & correlate logs", "Blue team / SOC"],
                ["EDR / XDR", "Detect & respond on endpoints", "Blue team"],
                ["Forensics suites", "Acquire & analyze evidence", "DFIR"],
                ["Packet analyzers", "Inspect network traffic", "Everyone"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>Tools don't make you a defender or a tester \u2014 methodology does.</strong> A scanner in untrained hands produces noise; in skilled hands it confirms a hypothesis. Learn the concepts first; the tools are just faster ways to apply them." },
            { t: "note", variant: "tip", html: "A whole family of security-focused operating systems bundles these categories together so you don't assemble them by hand. The value is the curated toolset and a safe, disposable environment to learn in \u2014 ideally inside a VM you can snapshot and revert." },
            { t: "quiz", id: "domains-modern" }
          ]
        }
      ]
    },
    /* ============================ YOUR PATH ============================ */
    {
      id: "path",
      name: "Your path",
      icon: "map",
      lessons: [
        {
          id: "ctf-practice",
          title: "CTFs & deliberate practice",
          summary: "Reading about security gets you started; doing it makes you dangerous. CTFs are the safe, legal gym.",
          minutes: 6,
          tags: ["ctf", "practice"],
          blocks: [
            { t: "p", html: "Security is a contact sport \u2014 you learn it by doing, safely and legally. <strong>Capture the Flag (CTF)</strong> events are purpose-built playgrounds where finding the hidden \u201cflag\u201d proves you solved a security challenge. No real victims, full permission, instant feedback." },
            {
              t: "table",
              headers: ["CTF format", "How it works"],
              rows: [
                ["<strong>Jeopardy</strong>", "Standalone challenges by category & points"],
                ["<strong>Attack\u2013defense</strong>", "Teams patch their own services while attacking others'"],
                ["<strong>King of the hill</strong>", "Hold a target against everyone else"]
              ]
            },
            { t: "h", text: "The classic categories" },
            {
              t: "ul", items: [
                "<strong>Web</strong> \u2014 the app flaws from the AppSec and Offense tracks.",
                "<strong>Pwn (binary exploitation)</strong> \u2014 memory-corruption puzzles.",
                "<strong>Crypto</strong> \u2014 break the weak scheme, recover the key.",
                "<strong>Forensics</strong> \u2014 dig the answer out of a capture or disk image.",
                "<strong>Reverse engineering</strong> \u2014 understand a binary to defeat it.",
                "<strong>OSINT</strong> \u2014 find what's hidden in plain sight."
              ]
            },
            { t: "note", variant: "key", html: "Notice the categories <em>are</em> this atlas: web, crypto, forensics, reversing, OSINT. A CTF is where the separate tracks you've studied combine into one problem \u2014 which is exactly how real security works." },
            { t: "note", variant: "tip", html: "Don't fear getting stuck \u2014 that's the training. Read write-ups <em>after</em> you've struggled, keep notes of techniques, and revisit. Struggle-then-explanation is the loop that actually builds skill." }
          ]
        },
        {
          id: "homelab",
          title: "Building a safe home lab",
          summary: "Practice attacking and defending without breaking the law or your laptop — an isolated lab is your sandbox.",
          minutes: 6,
          tags: ["homelab", "practice"],
          blocks: [
            { t: "p", html: "To practice the hands-on skills safely, you build a <strong>home lab</strong>: an isolated environment you fully own, where you can attack and defend deliberately vulnerable targets without ever touching someone else's system or the wider internet." },
            { t: "h", text: "The ingredients" },
            {
              t: "ul", items: [
                "<strong>A hypervisor</strong> \u2014 run multiple VMs on one machine.",
                "<strong>An attacker VM</strong> \u2014 a security-focused OS with the tool categories preloaded.",
                "<strong>Target VMs</strong> \u2014 intentionally vulnerable practice machines and apps.",
                "<strong>An isolated network</strong> \u2014 host-only/internal, so nothing leaks out.",
                "<strong>Snapshots</strong> \u2014 revert to clean state after each experiment."
              ]
            },
            { t: "note", variant: "warn", html: "<strong>Isolate the lab.</strong> Vulnerable-by-design machines must never sit on a network that can reach the internet or your real devices \u2014 they're magnets for actual malware. A host-only network with snapshots is the safe default." },
            { t: "note", variant: "key", html: "The home lab makes the ethics lesson real: you get unlimited, consequence-free practice on systems you own. There is never a need to point real tools at someone else's property to learn \u2014 the lab gives you everything." },
            { t: "note", variant: "tip", html: "Build both sides. Don't just attack the target \u2014 turn on its logging and watch your own attack light up the SIEM. Seeing offense and defense from both chairs is the fastest way to internalize either." }
          ]
        },
        {
          id: "career-certs",
          title: "Careers, certs & community",
          summary: "The field is huge and welcoming. A quick map of the roles, the certifications that signal them, and how to keep growing.",
          minutes: 7,
          tags: ["career", "community"],
          blocks: [
            { t: "p", html: "\u201cCybersecurity\u201d is not one job \u2014 it's a dozen specialties. Knowing the map helps you aim. Most people enter through an adjacent role (IT, dev, networking) and specialize as they find what they enjoy." },
            {
              t: "table",
              headers: ["Path", "You'd spend your days\u2026"],
              rows: [
                ["<strong>Blue team / SOC</strong>", "Monitoring, detecting, responding"],
                ["<strong>Red team / pentest</strong>", "Authorized attacking, reporting"],
                ["<strong>AppSec</strong>", "Securing software & code"],
                ["<strong>DFIR</strong>", "Investigating incidents & evidence"],
                ["<strong>GRC</strong>", "Governance, risk & compliance"],
                ["<strong>Cloud / infra security</strong>", "Securing platforms at scale"]
              ]
            },
            { t: "h", text: "Certifications, in plain terms" },
            { t: "p", html: "Certs are <em>signals</em>, not substitutes for skill. Foundational ones (like Security+) prove breadth; hands-on ones (like the OSCP) prove you can actually do the work; management ones (like the CISSP) signal experience and governance knowledge. Pick the one that matches the door you're knocking on." },
            { t: "note", variant: "key", html: "Skills first, certs as proof. A home lab, CTF results, and a portfolio of write-ups often speak louder than an acronym \u2014 and they're what make the cert exam easy when you do take it." },
            { t: "h", text: "Grow with the community \u2014 and keep the ethics" },
            {
              t: "ul", items: [
                "Read write-ups and post-mortems; the field shares generously.",
                "Practice continuously \u2014 CTFs, labs, bug-bounty programs (with permission).",
                "Find people: local meetups, online communities, mentors.",
                "Always operate ethically and within authorization \u2014 your reputation is your career."
              ]
            },
            { t: "note", variant: "tip", html: "You've now toured the whole atlas \u2014 foundations, crypto, application security, defense, offense, threats and forensics, and the wider domains. The field rewards the curious and the principled. Keep building, keep defending, and always get permission first." },
            { t: "quiz", id: "domains-path" }
          ]
        }
      ]
    }
  ]
};

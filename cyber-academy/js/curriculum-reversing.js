/* =====================================================================
   CITADEL · Reverse Engineering & Binary Exploitation curriculum
   window.TRACKS.reversing  ·  block grammar mirrors curriculum-offensive.js
   Framing is strictly educational & defensive: understand how programs are
   built and analyzed, and study memory-corruption ONLY through the modern
   defenses that stop it. No weaponized exploits, shellcode, or step-by-step
   attacks. Authorized labs, crackmes, and CTFs only \u2014 in isolated VMs.
   ===================================================================== */
window.TRACKS = window.TRACKS || {};
window.TRACKS.reversing = {
  id: "reversing",
  name: "Reverse Engineering",
  short: "REVERSE",
  tagline: "Read the machine \u2014 to defend it",
  color: "#ef4444",
  blurb: "Follow code from source to silicon, learn how analysts read a compiled program, and understand memory-corruption bugs through the modern defenses that stop them. Strictly educational and defensive \u2014 concepts, mitigations, and the authorized-lab and CTF context, never weaponized exploits.",
  modules: [
    /* ============================ INTERNALS ============================ */
    {
      id: "internals",
      name: "How programs run",
      icon: "cube",
      lessons: [
        {
          id: "compilation-pipeline",
          title: "From source to machine code",
          summary: "Reverse engineering walks the build backward. To read a binary, first understand how source becomes the bytes a CPU runs.",
          minutes: 7,
          tags: ["compilers", "internals", "intro"],
          blocks: [
            { t: "p", html: "Humans write <strong>source code</strong>; CPUs execute <strong>machine code</strong> \u2014 raw numeric instructions. A toolchain bridges the gap, and <strong>reverse engineering</strong> is the craft of walking that bridge backward: from a compiled program back to an understanding of what it does." },
            { t: "h", text: "The build pipeline" },
            {
              t: "ol", items: [
                "<strong>Preprocess</strong> \u2014 expand macros and includes into one translation unit (in C-family languages).",
                "<strong>Compile</strong> \u2014 translate the source into <strong>assembly</strong>, a human-readable form of the CPU's instructions.",
                "<strong>Assemble</strong> \u2014 turn assembly into <strong>machine code</strong> packed into object files.",
                "<strong>Link</strong> \u2014 stitch object files and libraries into a single runnable executable, resolving every symbol."
              ]
            },
            { t: "code", lang: "c", code: "int add(int a, int b) {\n    return a + b;\n}" },
            { t: "code", lang: "asm", code: "add:\n    push rbp\n    mov  rbp, rsp\n    mov  [rbp-4], edi      ; a\n    mov  [rbp-8], esi      ; b\n    mov  eax, [rbp-8]\n    add  eax, [rbp-4]\n    pop  rbp\n    ret" },
            { t: "note", variant: "key", html: "Compilation is <strong>lossy</strong>. Variable names, comments, and most type information are discarded \u2014 only the instructions survive. That loss is exactly why reading a release binary is hard, and why analysts rebuild meaning from structure and behavior." },
            { t: "h", text: "Why this matters for defense" },
            {
              t: "ul", items: [
                "<strong>Debug symbols</strong> map addresses back to names; a <strong>stripped</strong> release build removes them, slowing an adversary's analysis.",
                "<strong>Optimization</strong> reshapes code \u2014 inlining and reordering make the binary even further from the source.",
                "<strong>Reproducible builds</strong> let defenders verify a binary was built from the source it claims, with nothing slipped in."
              ]
            },
            { t: "note", variant: "tip", html: "Ship stripped, optimized release builds and keep the matching debug symbols private. Defenders get full diagnostics; an attacker who only has the shipped binary gets far less to work with." },
            { t: "note", variant: "warn", html: "Only build, run, or analyze software you are authorized to. Treat any unknown or untrusted binary as hostile and examine it in an <strong>isolated virtual machine</strong>, never on your day-to-day host." }
          ]
        },
        {
          id: "memory-layout",
          title: "How a process lays out memory",
          summary: "When a program runs, the OS hands it a virtual address space split into regions. Knowing the map is the foundation for everything that follows.",
          minutes: 8,
          tags: ["memory", "internals"],
          blocks: [
            { t: "p", html: "A running program is a <strong>process</strong>, and the OS gives it a private <strong>virtual address space</strong>. That space is divided into regions with different jobs and different permissions \u2014 and the boundaries between them are security boundaries." },
            { t: "p", html: "Click through the regions below to see what each one holds, which way it grows, and the defense tied to it." },
            { t: "widget", id: "memorylayout" },
            { t: "h", text: "The regions, low to high" },
            {
              t: "table",
              headers: ["Region", "Holds", "Permissions"],
              rows: [
                ["<strong>Text / code</strong>", "Machine instructions, read-only constants", "Read + execute, not writable"],
                ["<strong>Data</strong>", "Initialized global / static variables", "Read + write"],
                ["<strong>BSS</strong>", "Zero-initialized globals / statics", "Read + write"],
                ["<strong>Heap</strong>", "Dynamic allocations (grows up \u2191)", "Read + write, not executable"],
                ["<strong>Stack</strong>", "Locals, arguments, return addresses (grows down \u2193)", "Read + write, not executable"]
              ]
            },
            { t: "note", variant: "key", html: "Keeping <strong>code</strong> and <strong>data</strong> apart is a defense. Code is mapped executable-but-not-writable; data is writable-but-not-executable. This <strong>W^X</strong> (\u201cwrite XOR execute\u201d) rule means bytes an attacker writes as data cannot later run as instructions." },
            { t: "h", text: "Where the bugs live" },
            {
              t: "ul", items: [
                "<strong>Stack</strong> \u2014 holds saved return addresses, so a stack overflow can corrupt control flow. Defended by stack canaries (later in this track).",
                "<strong>Heap</strong> \u2014 holds allocator metadata and freed chunks, the home of use-after-free and double-free bugs.",
                "<strong>Globals</strong> \u2014 a linear overflow can spill into adjacent variables, including ones that gate decisions."
              ]
            },
            { t: "note", variant: "warn", html: "Inspecting how a real, unknown process uses memory is a job for a sandboxed lab VM with controlled networking \u2014 never a production system or your own workstation." }
          ]
        },
        {
          id: "cpu-assembly",
          title: "Registers, the stack & calling conventions",
          summary: "Reading a binary means reading assembly. A small mental model of registers, the call stack, and byte order takes you a long way.",
          minutes: 9,
          tags: ["assembly", "cpu", "internals"],
          blocks: [
            { t: "p", html: "A CPU is a fast loop: fetch an instruction, execute it over a handful of ultra-fast storage slots called <strong>registers</strong>, repeat. Assembly is just a readable spelling of those instructions, and it is what every disassembler shows you." },
            { t: "h", text: "Registers, briefly" },
            {
              t: "ul", items: [
                "<strong>General-purpose registers</strong> hold operands and results being worked on right now.",
                "<strong>Instruction pointer</strong> (RIP/EIP) \u2014 the address of the next instruction to run.",
                "<strong>Stack pointer</strong> (RSP/ESP) \u2014 the top of the call stack; a <strong>base pointer</strong> (RBP) often anchors the current frame.",
                "<strong>Flags</strong> \u2014 single bits set by operations (zero, carry, sign) that drive conditional jumps."
              ]
            },
            { t: "h", text: "The call stack" },
            { t: "p", html: "Each function call pushes a <strong>stack frame</strong>: the arguments, a saved return address, and space for local variables. <code>call</code> pushes the return address and jumps; <code>ret</code> pops it and jumps back. That saved return address is the hinge of program control \u2014 remember it." },
            { t: "code", lang: "asm", code: "; System V x86-64: first integer args go in rdi, rsi, rdx ...\n    mov  edi, 2        ; arg a = 2\n    mov  esi, 3        ; arg b = 3\n    call add           ; push return address, jump into add\n    ; result comes back in eax" },
            { t: "note", variant: "key", html: "Because the saved <strong>return address</strong> sits on the stack next to local buffers, a buffer that writes past its bounds can overwrite it. That single fact is the reason <strong>stack canaries</strong> exist \u2014 we cover the defense in Module 3." },
            { t: "h", text: "Endianness: byte order matters" },
            { t: "p", html: "A multi-byte value can be stored most-significant-byte-first (<strong>big-endian</strong>, the traditional \u201cnetwork byte order\u201d) or least-significant-byte-first (<strong>little-endian</strong>, what x86 and most ARM use). Misreading byte order is a classic source of confusion when reading memory dumps." },
            { t: "widget", id: "endianness" },
            { t: "note", variant: "tip", html: "A <strong>calling convention</strong> (System V on Linux/macOS, the Microsoft x64 ABI on Windows) is the agreed contract for where arguments and return values live. Knowing it turns a wall of <code>mov</code> instructions into a readable function call." },
            { t: "quiz", id: "reversing-internals" }
          ]
        }
      ]
    },
    /* ====================== REVERSE ENGINEERING ======================= */
    {
      id: "re",
      name: "Reverse engineering",
      icon: "wrench",
      lessons: [
        {
          id: "static-dynamic-re",
          title: "Static vs dynamic analysis",
          summary: "Two complementary lenses: read the program at rest, or run it and watch. Strong analysis uses both.",
          minutes: 8,
          tags: ["re", "analysis"],
          blocks: [
            { t: "p", html: "There are two ways to understand a compiled program. <strong>Static analysis</strong> examines it at rest \u2014 no execution. <strong>Dynamic analysis</strong> runs it under observation and watches what it actually does. Each catches what the other misses." },
            {
              t: "table",
              headers: ["Aspect", "Static analysis", "Dynamic analysis"],
              rows: [
                ["Program runs?", "No \u2014 read at rest", "Yes \u2014 observed while running"],
                ["Typical tools", "Disassembler, decompiler, <code>strings</code>", "Debugger, tracer, sandbox"],
                ["Strengths", "Full coverage, safe, no triggers", "Sees real behavior, resolves obfuscation"],
                ["Limits", "Packing / obfuscation hides code", "Only sees the paths you actually hit"]
              ]
            },
            { t: "h", text: "Disassembly vs decompilation" },
            {
              t: "ul", items: [
                "A <strong>disassembler</strong> turns machine code back into assembly \u2014 faithful, but verbose.",
                "A <strong>decompiler</strong> goes further, reconstructing C-like pseudo-code. It is a best-effort <em>guess</em>, not ground truth.",
                "A <strong>debugger</strong> steps through execution live, letting you inspect registers and memory at each instruction."
              ]
            },
            { t: "code", lang: "asm", code: "; disassembly (what the bytes really are)\n  cmp  dword [rbp-4], 0\n  jle  .skip\n  lea  rdi, [rip+msg]      ; \"ok\"\n  call puts\n.skip:" },
            { t: "code", lang: "c", code: "// decompiler's reconstruction (a readable best-effort)\nif (x > 0) {\n    puts(\"ok\");\n}" },
            { t: "note", variant: "key", html: "Neither view is automatically correct. A decompiler can mislabel types or miss a jump; the disassembly can hide intent behind optimization. Cross-check static reading against <strong>dynamic</strong> observation before you trust a conclusion." },
            { t: "note", variant: "warn", html: "Run an unknown sample <strong>only</strong> inside an isolated VM or sandbox with controlled (often no) networking and a snapshot you can roll back. Dynamic analysis means executing untrusted code \u2014 contain it completely." },
            { t: "note", variant: "tip", html: "The professional loop is static-then-dynamic: map the program statically to form a hypothesis, then run it to confirm or refute what you read." }
          ]
        },
        {
          id: "file-formats",
          title: "Executable & object file formats",
          summary: "Every OS wraps code in a container that tells the loader how to run it. The header is the analyst's table of contents.",
          minutes: 8,
          tags: ["re", "file-formats"],
          blocks: [
            { t: "p", html: "A program on disk is not just raw instructions \u2014 it is a structured file that tells the operating-system <strong>loader</strong> where the code is, what libraries it needs, and where to begin. Each platform has its own container format." },
            {
              t: "table",
              headers: ["Format", "Platform", "Notable parts"],
              rows: [
                ["<strong>ELF</strong>", "Linux, BSD", "ELF header, program & section headers, symbol table"],
                ["<strong>PE</strong>", "Windows", "DOS stub, COFF header, import / export tables"],
                ["<strong>Mach-O</strong>", "macOS, iOS", "Mach header, load commands, segments"]
              ]
            },
            { t: "h", text: "What the header reveals" },
            {
              t: "ul", items: [
                "<strong>Entry point</strong> \u2014 the address execution starts from.",
                "<strong>Architecture</strong> \u2014 x86-64, ARM64, and so on.",
                "<strong>Sections / segments</strong> \u2014 where code, data, and constants live, and their permissions.",
                "<strong>Imports</strong> \u2014 the external library functions the program calls, a quick map of its capabilities.",
                "<strong>Symbols</strong> \u2014 names that survived (if any), an instant head start for the analyst."
              ]
            },
            { t: "code", lang: "text", code: "ELF Header:\n  Magic:    7f 45 4c 46 02 01 01 00 ...\n  Class:                             ELF64\n  Data:                              little endian\n  Type:                              DYN (Position-Independent Executable)\n  Machine:                           Advanced Micro Devices X86-64\n  Entry point address:               0x1060\n  Number of section headers:         29" },
            { t: "h", text: "Strings & symbols: the first foothold" },
            { t: "p", html: "Before any disassembly, analysts dump the printable <strong>strings</strong> and read the <strong>symbol table</strong>. Error messages, URLs, format strings, and leftover function names often reveal a program's purpose in seconds." },
            { t: "note", variant: "key", html: "For defenders, these same structures are an integrity target. <strong>Code signing</strong> and hash-based verification detect tampering with headers, imports, or sections \u2014 so a modified binary fails to load or is flagged." },
            { t: "note", variant: "tip", html: "Read-only first steps like listing strings, symbols, and headers are safe even on suspicious files because they never execute the program \u2014 they only parse the container." }
          ]
        },
        {
          id: "anti-re-patching",
          title: "Obfuscation, packing & crackmes",
          summary: "Software can resist analysis. Defenders meet these techniques in malware; learners meet them in purpose-built puzzle binaries.",
          minutes: 9,
          tags: ["re", "obfuscation", "malware"],
          blocks: [
            { t: "p", html: "Not every program wants to be read. Software \u2014 especially malware, but also some commercial code \u2014 uses <strong>anti-reverse-engineering</strong> tricks to slow analysis. Recognizing them is a core defensive skill." },
            { t: "h", text: "Common techniques" },
            {
              t: "table",
              headers: ["Technique", "What it does", "Analyst's response"],
              rows: [
                ["<strong>Obfuscation</strong>", "Rewrites code to be confusing while behaving the same", "Lean on dynamic analysis and pattern recognition"],
                ["<strong>Packing</strong>", "Compresses / encrypts code, unpacking it in memory at runtime", "Let it unpack in a sandbox, then inspect memory"],
                ["<strong>Anti-debug</strong>", "Detects a debugger and changes behavior or bails", "Use stealthier tracing; note the check as a signal"],
                ["<strong>Anti-VM</strong>", "Detects a virtual machine and hides", "Harden the lab; the evasion itself is intelligence"]
              ]
            },
            { t: "note", variant: "key", html: "Packing raises a file's <strong>entropy</strong> (its randomness) because compressed or encrypted data looks random. A high-entropy section is a fast triage signal that real code is hidden until runtime \u2014 a flag, not a verdict." },
            { t: "h", text: "Crackmes & patching \u2014 the legal way to learn" },
            { t: "p", html: "A <strong>crackme</strong> is a small program made <em>specifically</em> to be reverse-engineered as a puzzle \u2014 the author consents and that is the whole point. <strong>Patching</strong> means changing a binary's logic, and as a methodology it is studied on these consenting targets." },
            {
              t: "ol", items: [
                "<strong>Locate</strong> the decision \u2014 find where the program checks a condition.",
                "<strong>Understand</strong> it \u2014 read the surrounding logic until you know <em>why</em> it branches.",
                "<strong>Demonstrate</strong> \u2014 in an authorized crackme, redirect the control flow to prove you understood the check."
              ]
            },
            { t: "note", variant: "warn", html: "Circumventing protections on software you do not own or license can violate the law (anti-circumvention statutes such as the DMCA) and the product's license terms. Practice patching and unpacking <strong>only</strong> on crackmes, your own code, or explicitly authorized lab targets." },
            { t: "note", variant: "trap", html: "Malware piles on anti-RE precisely to waste your time and trip you into running it carelessly. Analyze it only in a snapshotted, network-controlled sandbox \u2014 and assume it is trying to escape." },
            { t: "quiz", id: "reversing-re" }
          ]
        }
      ]
    },
    /* ================= BINARY EXPLOITATION & DEFENSES ================= */
    {
      id: "pwn",
      name: "Binary exploitation & defenses",
      icon: "shield",
      lessons: [
        {
          id: "memory-corruption",
          title: "Memory-corruption bugs, conceptually",
          summary: "What goes wrong when a program writes outside the lines — and why memory safety and bounds checking are the real fix.",
          minutes: 9,
          tags: ["pwn", "memory", "secure-coding"],
          blocks: [
            { t: "p", html: "<strong>Memory corruption</strong> happens when a program reads or writes memory outside what it intended. It is overwhelmingly a problem of <strong>memory-unsafe</strong> languages (C and C++), where bounds are not checked for you. We study what breaks \u2014 and how to prevent it. No exploits here, just the bug classes and their fixes." },
            { t: "h", text: "The classic bug classes" },
            {
              t: "table",
              headers: ["Bug class", "What goes wrong"],
              rows: [
                ["<strong>Buffer overflow</strong>", "Writing past the end of a buffer into neighboring memory"],
                ["<strong>Use-after-free</strong>", "Using a pointer to memory that was already freed"],
                ["<strong>Double-free</strong>", "Freeing the same allocation twice, corrupting allocator state"],
                ["<strong>Out-of-bounds read</strong>", "Reading beyond a buffer, leaking adjacent data"],
                ["<strong>Integer overflow</strong>", "A size calculation wraps, producing an undersized allocation"]
              ]
            },
            { t: "h", text: "Why it is dangerous" },
            { t: "p", html: "Memory holds more than your data \u2014 it holds the values that steer the program: saved return addresses, function pointers, allocator bookkeeping. Corrupting those can turn a simple input-handling bug into a loss of control over the program. The details of <em>how</em> are exactly what mitigations (next lesson) are designed to block." },
            { t: "compare",
              bad: { title: "Patterns that invite corruption", items: ["<code>gets()</code> \u2014 no way to bound the input at all", "<code>strcpy</code> / <code>strcat</code> into a fixed buffer", "Copying a length the caller controls without checking it", "Using a pointer after <code>free()</code>"] },
              good: { title: "Patterns that prevent it", items: ["Bounded calls like <code>snprintf</code> / <code>fgets</code>", "Always check sizes against the destination", "Set pointers to <code>NULL</code> after freeing", "Prefer a memory-safe language where you can"] }
            },
            { t: "code", lang: "c", code: "// UNSAFE: copies until a NUL byte, with no bound on the destination\nvoid greet(const char *name) {\n    char buf[64];\n    strcpy(buf, name);              // overflows buf when name is too long\n    printf(\"Hi, %s\\n\", buf);\n}\n\n// SAFER: bound every write to the size of the destination\nvoid greet_safe(const char *name) {\n    char buf[64];\n    snprintf(buf, sizeof(buf), \"Hi, %s\", name);  // never writes past buf\n    fputs(buf, stdout);\n}" },
            { t: "note", variant: "key", html: "The durable fix is <strong>memory safety</strong>. Managed and safe languages \u2014 Rust, Go, Java, C#, Python \u2014 check bounds and manage lifetimes for you, eliminating whole classes of these bugs. When you must use C/C++, treat every buffer size as sacred." },
            { t: "note", variant: "tip", html: "Find these before anyone else does: <strong>fuzzing</strong> throws malformed inputs at the program, and sanitizers like <strong>AddressSanitizer</strong> turn silent corruption into a loud, immediate crash during testing." },
            { t: "note", variant: "warn", html: "Study these bug classes only in authorized labs or CTFs against targets built for it. Never probe software or systems you do not own or have written permission to test." }
          ]
        },
        {
          id: "mitigations",
          title: "Exploit mitigations & hardening",
          summary: "Even when a bug exists, layered mitigations make turning it into a working exploit expensive or impractical. This is defense-in-depth, in the binary.",
          minutes: 9,
          tags: ["pwn", "defense", "hardening"],
          blocks: [
            { t: "p", html: "A bug is not automatically a usable exploit. Modern systems stack <strong>mitigations</strong> that each remove a technique an attacker would need, raising the cost and lowering the reliability of exploitation. Together they are defense-in-depth at the binary level." },
            { t: "p", html: "Explore the core protections below \u2014 each shows what it raises the cost of and how it works, defensively." },
            { t: "widget", id: "mitigations" },
            { t: "h", text: "The core mitigations" },
            {
              t: "table",
              headers: ["Mitigation", "Raises the cost of"],
              rows: [
                ["<strong>NX / DEP</strong>", "Running attacker-supplied data as code (W^X)"],
                ["<strong>ASLR</strong>", "Relying on fixed, predictable addresses"],
                ["<strong>Stack canary</strong>", "Overwriting the saved return address linearly"],
                ["<strong>PIE</strong>", "Hardcoding addresses in the program's own code"],
                ["<strong>RELRO</strong>", "Overwriting the GOT to hijack function pointers"],
                ["<strong>CFG / CFI</strong>", "Diverting execution to arbitrary addresses"]
              ]
            },
            { t: "h", text: "Turn them on at build time" },
            { t: "code", lang: "bash", code: "# Defensive build hardening (gcc / clang) \u2014 enable these in CI\ngcc main.c -o app \\\n  -fstack-protector-strong \\   # stack canaries\n  -D_FORTIFY_SOURCE=2 -O2 \\     # bounds-checked libc variants\n  -fPIE -pie \\                  # position independent => ASLR covers the exe\n  -Wl,-z,relro,-z,now \\         # full RELRO: make the GOT read-only\n  -fcf-protection=full \\        # Intel CET / control-flow integrity\n  -fstack-clash-protection\n# NX is on by default; never link with -z execstack" },
            { t: "note", variant: "key", html: "Mitigations <strong>stack</strong>. NX alone, or ASLR alone, can often be worked around; together \u2014 NX + ASLR + canaries + PIE + RELRO + CFI \u2014 they remove technique after technique until a bug that would have been trivial becomes a research project." },
            { t: "note", variant: "tip", html: "Verify, don't assume. A <code>checksec</code>-style tool reports which mitigations a binary actually has; enforce a minimum in your build pipeline so a careless flag can't silently ship an unhardened release." },
            { t: "note", variant: "warn", html: "Mitigations reduce risk \u2014 they do not fix the bug. Always patch the root-cause vulnerability as well; hardening buys time and raises cost, it is not a substitute for correctness." }
          ]
        },
        {
          id: "ethics-ctf",
          title: "Ethics, authorized labs & CTF pwn",
          summary: "The line between a researcher and a criminal is authorization. Build the skill on systems made for it.",
          minutes: 7,
          tags: ["pwn", "ethics", "ctf"],
          blocks: [
            { t: "p", html: "Every concept in this track is dual-use, and one rule makes the difference: <strong>authorization</strong>. You never need someone else's system to learn binary exploitation \u2014 the entire skill can be built on targets that exist to be practiced on." },
            { t: "note", variant: "warn", html: "Do not run, attack, or even analyze binaries against systems you do not own or are not explicitly authorized to test. Detonate unknown code only in <strong>isolated virtual machines</strong> with controlled networking and rollback snapshots." },
            { t: "h", text: "Where to practice, legally" },
            {
              t: "ul", items: [
                "Your own <strong>home lab</strong> \u2014 VMs you own, snapshot, and reset freely.",
                "Intentionally <strong>vulnerable practice binaries</strong> you download and run locally for learning.",
                "The <strong>pwn category</strong> in capture-the-flag (CTF) events \u2014 consenting, scored, sandboxed challenges.",
                "Vetted <strong>wargames</strong> and course labs designed for exploitation practice."
              ]
            },
            { t: "h", text: "What CTF pwn actually is" },
            { t: "p", html: "In a CTF, the <strong>pwn</strong> category gives you a deliberately vulnerable program and asks you to demonstrate control by capturing a flag \u2014 all on infrastructure the organizers set up <em>for exactly that</em>. It is the consenting, legal, scored way to practice everything in this track." },
            { t: "stat", items: [
              { v: "VM", k: "isolate every unknown binary" },
              { v: "0", k: "systems attacked without permission" },
              { v: "CTF", k: "consenting, scored, legal practice" }
            ] },
            { t: "h", text: "When you find a real bug" },
            { t: "p", html: "If your skills turn up a genuine vulnerability in real software, the responsible path is <strong>coordinated disclosure</strong>: report it privately through the vendor's security contact or bug-bounty program, allow reasonable time to fix, and only then discuss it publicly." },
            { t: "compare",
              bad: { title: "Crossing the line", items: ["Testing production systems you don't own", "Dropping a working exploit with no warning", "\u201cJust trying it\u201d on a live target", "Skipping the lab and using real victims"] },
              good: { title: "Staying on the right side", items: ["Authorized scope and written permission", "An isolated lab for every experiment", "Coordinated, private disclosure", "Consenting CTFs and crackmes to practice"] }
            },
            { t: "note", variant: "tip", html: "Keep a lab notebook that records, for every exercise, <em>what</em> you were authorized to do and <em>where</em> it ran. Good documentation is both a learning aid and your proof that you stayed inside the lines." },
            { t: "quiz", id: "reversing-pwn" }
          ]
        }
      ]
    }
  ]
};

/* =====================================================================
   CITADEL · Quiz bank — Reverse Engineering pack
   Merged into window.QUIZZES (loaded after quizzes.js, before app.js).
   Three module checkpoints. Answers hand-verified, original questions.
   ===================================================================== */
window.QUIZZES = Object.assign(window.QUIZZES || {}, {
  /* ---------------- INTERNALS ---------------- */
  "reversing-internals": {
    title: "How programs run checkpoint",
    sub: "Compilation, process memory, and the CPU.",
    questions: [
      {
        q: "A compiler and linker turn readable source into a runnable program. Why is reverse-engineering a released binary hard?",
        options: [
          "The CPU encrypts all machine code",
          "Compilation discards names, comments, and most types, leaving only instructions",
          "Binaries delete their own code after running once",
          "Assembly cannot be read by humans at all"
        ],
        answer: 1,
        explain: "Compilation is lossy: variable names, comments, and most type information are thrown away. Only the machine instructions survive, so analysts must rebuild meaning from structure and behavior."
      },
      {
        q: "In a typical process address space, which direction does the stack usually grow?",
        options: [
          "Upward, toward higher addresses",
          "Downward, toward lower addresses",
          "It never moves once the process starts",
          "Outward in both directions at once"
        ],
        answer: 1,
        explain: "The stack conventionally grows downward (toward lower addresses) as calls nest, while the heap grows upward. They expand toward each other across the address space."
      },
      {
        q: "The .text (code) region is mapped read-and-execute but never writable, and data regions are writable but not executable. Which protection is this?",
        options: [
          "ASLR",
          "NX / W^X — write XOR execute",
          "TLS encryption",
          "Garbage collection"
        ],
        answer: 1,
        explain: "Separating code and data so memory is either writable or executable but not both is the W^X (NX) rule. Bytes an attacker writes as data therefore cannot later run as instructions."
      },
      {
        q: "The 32-bit value 0x12345678 is stored on a little-endian CPU. Which byte sits at the lowest memory address?",
        options: ["0x12", "0x34", "0x56", "0x78"],
        answer: 3,
        explain: "Little-endian stores the least-significant byte first (at the lowest address). For 0x12345678 that least-significant byte is 0x78. Big-endian would place 0x12 there instead."
      }
    ]
  },

  /* ---------------- REVERSE ENGINEERING ---------------- */
  "reversing-re": {
    title: "Reverse engineering checkpoint",
    sub: "Static vs dynamic, file formats, and anti-RE.",
    questions: [
      {
        q: "What is the key difference between static and dynamic analysis of a binary?",
        options: [
          "Static runs the program; dynamic only reads it at rest",
          "Static reads the program at rest; dynamic runs it and observes its behavior",
          "They are two names for the same thing",
          "Dynamic analysis only works on source code"
        ],
        answer: 1,
        explain: "Static analysis examines the program at rest with no execution. Dynamic analysis runs it under observation to see real behavior. Strong work uses both, since each catches what the other misses."
      },
      {
        q: "A decompiler differs from a disassembler in that a decompiler",
        options: [
          "outputs raw machine bytes",
          "reconstructs higher-level pseudo-code as a best-effort guess, not ground truth",
          "encrypts the binary before analysis",
          "is always 100% accurate"
        ],
        answer: 1,
        explain: "A disassembler shows faithful assembly; a decompiler goes further and reconstructs C-like pseudo-code. That reconstruction is a best-effort guess that should be cross-checked, not trusted blindly."
      },
      {
        q: "Executables on Linux, Windows, and macOS use which container formats, respectively?",
        options: [
          "PE, ELF, Mach-O",
          "ELF, PE, Mach-O",
          "Mach-O, ELF, PE",
          "ELF, Mach-O, PE"
        ],
        answer: 1,
        explain: "Linux uses ELF, Windows uses PE, and macOS uses Mach-O. Each header tells the loader the entry point, architecture, sections, and imports."
      },
      {
        q: "Why is a high-entropy section a useful triage signal in an unknown binary?",
        options: [
          "It proves the file is safe to run",
          "It often indicates packing or encryption, suggesting the real code is hidden until runtime",
          "It means the file is definitely corrupt",
          "High entropy turns off ASLR"
        ],
        answer: 1,
        explain: "Compressed or encrypted data looks random, so packing raises entropy. A high-entropy section is a fast flag that code may be unpacked in memory at runtime — a signal to analyze dynamically, not a verdict."
      }
    ]
  },

  /* ---------------- BINARY EXPLOITATION & DEFENSES ---------------- */
  "reversing-pwn": {
    title: "Exploitation & defenses checkpoint",
    sub: "Memory corruption, mitigations, and ethics.",
    questions: [
      {
        q: "Memory-corruption bugs like buffer overflows and use-after-free are most associated with",
        options: [
          "memory-safe managed languages such as Java or Go",
          "memory-unsafe languages such as C and C++, where bounds aren't checked for you",
          "HTML and CSS",
          "SQL query strings"
        ],
        answer: 1,
        explain: "These bugs live in memory-unsafe languages (C/C++) that don't check bounds or lifetimes automatically. Memory-safe languages eliminate whole classes of them, which is the durable fix."
      },
      {
        q: "A stack canary defends against a stack buffer overflow by",
        options: [
          "encrypting the entire stack",
          "placing a random value before the saved return address and checking it before returning",
          "making the stack executable",
          "removing the return address entirely"
        ],
        answer: 1,
        explain: "The compiler inserts a random canary between local buffers and the saved return address. A linear overflow corrupts the canary first, the check fails, and the program aborts safely instead of returning into attacker-controlled data."
      },
      {
        q: "ASLR raises the cost of exploitation primarily because it",
        options: [
          "fixes every memory bug automatically",
          "randomizes memory addresses each run, so attackers can't rely on hardcoded locations",
          "disables all networking",
          "encrypts every function pointer"
        ],
        answer: 1,
        explain: "Address Space Layout Randomization places the stack, heap, libraries, and (with PIE) the executable at random bases each run. Techniques that need fixed addresses now require an information leak first."
      },
      {
        q: "What single thing separates legal binary-exploitation practice from a crime?",
        options: [
          "Using a debugger",
          "Explicit authorization — your own labs, consenting CTFs, or written permission",
          "Only working at night",
          "Wearing a particular colored hat"
        ],
        answer: 1,
        explain: "Authorization is the bright line. Practice on systems built for it — your own VMs, consenting CTF pwn challenges, crackmes, or targets you have written permission to test — and contain everything in an isolated lab."
      }
    ]
  }
});

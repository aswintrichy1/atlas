/* =====================================================================
   CITADEL · Cryptography curriculum
   window.TRACKS.crypto  ·  block grammar documented in curriculum-core.js
   ===================================================================== */
window.TRACKS = window.TRACKS || {};
window.TRACKS.crypto = {
  id: "crypto",
  name: "Cryptography",
  short: "CRYPTO",
  tagline: "Protect data in motion and at rest",
  color: "#a78bfa",
  blurb: "The math that keeps secrets: encoding vs encryption, symmetric ciphers like AES, cryptographic hashing, public-key crypto (RSA & elliptic curves), key exchange, digital signatures, TLS, certificates and the right way to store passwords.",
  modules: [
    /* ============================ PRIMITIVES ============================ */
    {
      id: "primitives",
      name: "Primitives",
      icon: "cube",
      lessons: [
        {
          id: "encoding-vs-encryption",
          title: "Encoding, encryption & hashing",
          summary: "Three things constantly confused. Only one keeps a secret, only one is reversible with a key, only one is one-way.",
          minutes: 7,
          tags: ["fundamentals", "vocabulary"],
          blocks: [
            { t: "p", html: "If you remember one thing from this track: <strong>Base64 is not encryption.</strong> Encoding, encryption and hashing solve different problems, and mixing them up is the source of a startling number of real vulnerabilities." },
            {
              t: "table",
              headers: ["", "Purpose", "Reversible?", "Needs a key?"],
              rows: [
                ["<strong>Encoding</strong> (Base64, URL)", "Represent data safely in transit", "Yes, by anyone", "No"],
                ["<strong>Encryption</strong> (AES, RSA)", "Keep data confidential", "Yes, with the key", "Yes"],
                ["<strong>Hashing</strong> (SHA-256)", "Verify integrity / fingerprint", "No (one-way)", "No"]
              ]
            },
            { t: "note", variant: "trap", html: "\u201cWe obscured the token with Base64\u201d protects nothing — anyone can decode it instantly. Encoding is about <em>format</em>, never secrecy." },
            { t: "h", text: "Kerckhoffs's principle" },
            { t: "p", html: "A cryptosystem should be secure even if everything about it is public <em>except the key</em>. The corollary: never invent your own cipher and never rely on the algorithm being secret. Strength must live entirely in the key." },
            { t: "note", variant: "key", html: "<strong>Don't roll your own crypto.</strong> Use vetted, standard libraries and algorithms. Cryptography fails in subtle ways that look fine in testing and shatter under an expert's analysis." },
            { t: "h", text: "Substitution: where it began" },
            { t: "p", html: "Classical ciphers like Caesar (shift each letter) and Vig\u00e8nere (shift by a repeating keyword) show the <em>idea</em> of encryption — and why simple schemes fall to frequency analysis. Play with one to feel how a key changes the output." },
            { t: "widget", id: "caesar" },
            { t: "note", variant: "warn", html: "These classical ciphers are <strong>educational only</strong>. A Caesar cipher has 25 keys; a computer breaks it instantly. They illustrate concepts — never protect real data with them." }
          ]
        },
        {
          id: "symmetric",
          title: "Symmetric encryption: AES",
          summary: "One shared key encrypts and decrypts. Fast, everywhere — and entirely dependent on getting the key to both sides safely.",
          minutes: 8,
          tags: ["symmetric", "aes"],
          blocks: [
            { t: "p", html: "In <strong>symmetric</strong> cryptography both parties share one secret key, used to encrypt and decrypt. <strong>AES</strong> (Advanced Encryption Standard) is the workhorse — fast, hardware-accelerated, and trusted for everything from disk encryption to TLS bulk data." },
            { t: "h", text: "Block ciphers and modes" },
            { t: "p", html: "AES encrypts fixed 128-bit blocks. A <strong>mode of operation</strong> decides how blocks chain together — and the mode matters as much as the cipher." },
            {
              t: "table",
              headers: ["Mode", "Property", "Use it?"],
              rows: [
                ["ECB", "Each block encrypted independently", "Never — leaks patterns"],
                ["CBC", "Blocks chained with an IV", "Legacy; needs separate integrity"],
                ["CTR", "Turns the block cipher into a stream", "Good, but no built-in integrity"],
                ["<strong>GCM</strong>", "CTR + built-in authentication tag", "Yes — authenticated encryption"]
              ]
            },
            { t: "note", variant: "trap", html: "<strong>ECB mode</strong> encrypts identical plaintext blocks to identical ciphertext — the infamous \u201cECB penguin\u201d is still visible after encryption. Always use an authenticated mode like <strong>AES-GCM</strong>." },
            { t: "h", text: "Authenticated encryption (AEAD)" },
            { t: "p", html: "You almost always want <strong>confidentiality and integrity together</strong>. AEAD modes (AES-GCM, ChaCha20-Poly1305) encrypt <em>and</em> produce an authentication tag, so tampering is detected on decrypt." },
            {
              t: "code", lang: "python", code:
"from cryptography.hazmat.primitives.ciphers.aead import AESGCM\n" +
"import os\n\n" +
"key   = AESGCM.generate_key(bit_length=256)   # keep this secret\n" +
"nonce = os.urandom(12)                         # unique per message!\n" +
"aes   = AESGCM(key)\n\n" +
"ct = aes.encrypt(nonce, b'transfer $100', b'acct-42')  # data + AAD\n" +
"pt = aes.decrypt(nonce, ct, b'acct-42')        # raises if tampered\n"
            },
            { t: "note", variant: "key", html: "<strong>Never reuse a nonce/IV with the same key.</strong> In GCM, nonce reuse is catastrophic — it can leak the authentication key. Generate a fresh random nonce (or a counter) for every single message." },
            { t: "h", text: "The hard part isn't the cipher" },
            { t: "p", html: "Symmetric crypto is fast and strong. Its one problem is the <strong>key distribution problem</strong>: how do two parties that have never met agree on a shared secret over a hostile network? That question is what invented public-key cryptography." }
          ]
        },
        {
          id: "hashing",
          title: "Cryptographic hashing",
          summary: "A one-way fingerprint of any input. The backbone of integrity, signatures, and password storage.",
          minutes: 7,
          tags: ["hashing", "integrity"],
          blocks: [
            { t: "p", html: "A <strong>cryptographic hash</strong> maps any input to a fixed-size fingerprint (SHA-256 \u2192 256 bits). It's the silent foundation under signatures, certificates, blockchains, file-integrity checks and password storage." },
            { t: "h", text: "The properties that make it useful" },
            {
              t: "ul", items: [
                "<strong>Deterministic</strong> — same input always gives the same digest.",
                "<strong>One-way (pre-image resistant)</strong> — you can't reverse the digest to the input.",
                "<strong>Collision resistant</strong> — infeasible to find two inputs with the same digest.",
                "<strong>Avalanche effect</strong> — flip one bit of input and ~half the output bits flip."
              ]
            },
            { t: "p", html: "That last property is striking in person. Change a single character below and watch the SHA-256 digest change completely — there's no partial similarity to exploit." },
            { t: "widget", id: "avalanche" },
            { t: "note", variant: "warn", html: "<strong>MD5 and SHA-1 are broken</strong> for security use — practical collisions exist. Use SHA-256 / SHA-3 for integrity. (You'll still see MD5 used as a non-security checksum; that's a different, lower bar.)" },
            { t: "h", text: "Hash vs MAC — a crucial difference" },
            { t: "p", html: "A bare hash proves integrity only if the attacker can't also replace the hash. To prove integrity <em>and</em> authenticity, you need a key: a <strong>MAC</strong> (e.g. HMAC) mixes a secret key into the hash, so only key-holders can produce a valid tag." },
            { t: "note", variant: "key", html: "Integrity from a plain hash assumes the digest is delivered over a trusted channel. If the attacker controls both data and digest, swap to an <strong>HMAC</strong> or a signature, which bind the value to a secret or a private key." },
            { t: "quiz", id: "crypto-primitives" }
          ]
        }
      ]
    },
    /* ============================ KEYS ============================ */
    {
      id: "keys",
      name: "Public-key crypto",
      icon: "diamond",
      lessons: [
        {
          id: "asymmetric",
          title: "Asymmetric encryption: RSA & ECC",
          summary: "Two mathematically linked keys — one public, one private — solve the key-distribution problem.",
          minutes: 8,
          tags: ["asymmetric", "rsa", "ecc"],
          blocks: [
            { t: "p", html: "<strong>Asymmetric</strong> (public-key) cryptography uses a <em>pair</em> of keys: a <strong>public key</strong> you share freely and a <strong>private key</strong> you guard. What one key locks, only the other unlocks. Suddenly strangers can communicate securely without a pre-shared secret." },
            {
              t: "table",
              headers: ["Goal", "Encrypt with", "Decrypt/verify with"],
              rows: [
                ["<strong>Confidentiality</strong>", "Recipient's public key", "Recipient's private key"],
                ["<strong>Authenticity</strong> (signing)", "Sender's private key", "Sender's public key"]
              ]
            },
            { t: "note", variant: "key", html: "Encrypt <em>to</em> someone with their <strong>public</strong> key (only they can read it). Sign <em>as</em> yourself with your <strong>private</strong> key (anyone can verify it's you). Swapping these is the most common conceptual mistake." },
            { t: "h", text: "RSA vs elliptic curves" },
            {
              t: "table",
              headers: ["", "RSA", "ECC"],
              rows: [
                ["Based on", "Factoring large numbers", "Elliptic-curve discrete log"],
                ["Key size for ~128-bit security", "3072 bits", "256 bits"],
                ["Speed / size", "Larger, slower", "Smaller, faster"],
                ["Today", "Still common", "Preferred for new systems"]
              ]
            },
            { t: "note", variant: "tip", html: "Asymmetric crypto is slow, so we rarely encrypt bulk data with it. Instead we use it to exchange or wrap a <strong>symmetric</strong> key, then switch to fast AES. This hybrid is exactly how TLS works." },
            { t: "note", variant: "warn", html: "<strong>Post-quantum on the horizon:</strong> a large quantum computer would break RSA and ECC via Shor's algorithm. NIST has standardized post-quantum algorithms (e.g. ML-KEM); long-lived secrets are starting to migrate now." }
          ]
        },
        {
          id: "key-exchange",
          title: "Key exchange: Diffie–Hellman",
          summary: "Two parties derive a shared secret over a public channel — without ever transmitting it. It feels like magic; it's modular arithmetic.",
          minutes: 7,
          tags: ["key-exchange", "diffie-hellman"],
          blocks: [
            { t: "p", html: "<strong>Diffie\u2013Hellman (DH)</strong> lets two parties agree on a shared secret while an eavesdropper watches every byte — and still can't compute it. It's the breakthrough that makes modern secure channels possible." },
            { t: "h", text: "The paint-mixing analogy" },
            { t: "p", html: "Each side starts with a public colour, mixes in a private colour, and swaps the mixtures. Each then adds their private colour again. Both reach the <em>same</em> final mix; an observer who saw the swapped mixtures can't \u201cun-mix\u201d to find the private colours. Try it with small numbers below." },
            { t: "widget", id: "diffie" },
            { t: "note", variant: "key", html: "The eavesdropper sees the public base, the modulus, and both public values — yet computing the shared secret requires solving the <strong>discrete logarithm</strong> problem, which is infeasible for large parameters." },
            { t: "h", text: "Ephemeral keys & forward secrecy" },
            { t: "p", html: "Modern TLS uses <strong>ephemeral</strong> DH (ECDHE): a fresh key pair per session. This gives <strong>forward secrecy</strong> — even if the server's long-term private key is stolen later, past recorded sessions stay safe, because their keys existed only in memory and are gone." },
            { t: "note", variant: "trap", html: "Without forward secrecy, an attacker can record encrypted traffic today and decrypt all of it the day they steal the private key (\u201charvest now, decrypt later\u201d). Ephemeral key exchange is why that doesn't work." }
          ]
        },
        {
          id: "signatures",
          title: "Digital signatures",
          summary: "Prove who wrote something and that it wasn't changed — the integrity + authenticity + non-repudiation combo.",
          minutes: 6,
          tags: ["signatures", "integrity"],
          blocks: [
            { t: "p", html: "A <strong>digital signature</strong> binds a message to its author. The signer hashes the message and encrypts that hash with their <strong>private</strong> key; anyone can verify with the matching <strong>public</strong> key. It delivers integrity, authenticity, and non-repudiation at once." },
            {
              t: "ol", items: [
                "<strong>Sign:</strong> hash the message \u2192 transform the hash with the private key \u2192 attach as the signature.",
                "<strong>Verify:</strong> hash the received message \u2192 check it against the signature using the public key.",
                "If they match, the message is authentic and untampered; if not, reject it."
              ]
            },
            { t: "note", variant: "key", html: "We sign the <em>hash</em>, not the whole message, for speed — and because the hash's collision resistance is what makes the signature meaningful. A broken hash (MD5/SHA-1) breaks the signature too." },
            { t: "h", text: "MAC vs signature" },
            {
              t: "table",
              headers: ["", "MAC (HMAC)", "Digital signature"],
              rows: [
                ["Key type", "Shared symmetric secret", "Private/public key pair"],
                ["Who can verify", "Anyone with the shared key", "Anyone with the public key"],
                ["Non-repudiation", "No (both sides hold the key)", "Yes (only signer has private key)"],
                ["Speed", "Very fast", "Slower"]
              ]
            },
            { t: "note", variant: "tip", html: "Need non-repudiation (\u201cthey can't deny signing\u201d)? You need a signature, not a MAC — because with a shared MAC key, either party could have produced the tag." },
            { t: "quiz", id: "crypto-keys" }
          ]
        }
      ]
    },
    /* ============================ APPLIED ============================ */
    {
      id: "applied",
      name: "Applied crypto",
      icon: "plug",
      lessons: [
        {
          id: "tls",
          title: "TLS: putting it together",
          summary: "How a browser and server go from plaintext to a private, authenticated channel in a few round trips.",
          minutes: 8,
          tags: ["tls", "protocols"],
          blocks: [
            { t: "p", html: "<strong>TLS</strong> (the S in HTTPS) is where every primitive in this track meets. It uses asymmetric crypto to authenticate the server and agree on keys, then fast symmetric crypto for the actual data — the hybrid model in action." },
            { t: "diagram", id: "tls-handshake", caption: "A simplified TLS 1.3 handshake: agree, authenticate, derive keys, then encrypt." },
            { t: "h", text: "What the handshake achieves" },
            {
              t: "ul", items: [
                "<strong>Authentication</strong> — the server proves its identity with a certificate (the client checks the signature chain).",
                "<strong>Key agreement</strong> — ephemeral Diffie\u2013Hellman derives a fresh shared secret (forward secrecy).",
                "<strong>Confidentiality + integrity</strong> — application data flows under AEAD (e.g. AES-GCM)."
              ]
            },
            { t: "p", html: "Step through the exchange yourself — see which message does what, and where the switch from asymmetric to symmetric happens." },
            { t: "widget", id: "tlsflow" },
            { t: "note", variant: "key", html: "TLS 1.3 (2018) stripped out legacy, vulnerable options, made forward secrecy mandatory, and cut the handshake to a single round trip. <strong>Disable TLS 1.0/1.1 and SSL entirely.</strong>" },
            { t: "note", variant: "trap", html: "A valid certificate proves <em>identity</em>, not <em>safety</em>: a phishing site can have a perfectly valid TLS cert. The padlock means \u201cencrypted to whoever this is,\u201d not \u201ctrustworthy.\u201d" }
          ]
        },
        {
          id: "pki-certificates",
          title: "Certificates & PKI",
          summary: "Public keys are useless if you can't trust whose they are. PKI is the chain of trust that vouches for them.",
          minutes: 7,
          tags: ["pki", "certificates"],
          blocks: [
            { t: "p", html: "A public key alone doesn't say <em>whose</em> it is. <strong>Public Key Infrastructure (PKI)</strong> solves this: a <strong>Certificate Authority (CA)</strong> signs a certificate binding a public key to an identity (a domain). Your device trusts a set of root CAs, and trust flows down from them." },
            { t: "h", text: "The chain of trust" },
            {
              t: "ul", items: [
                "<strong>Root CA</strong> — a self-signed certificate pre-installed in your OS/browser trust store.",
                "<strong>Intermediate CA</strong> — signed by the root; does the day-to-day issuing.",
                "<strong>Leaf certificate</strong> — your site's cert, signed by an intermediate.",
                "Verification walks leaf \u2192 intermediate \u2192 root, checking each signature."
              ]
            },
            { t: "note", variant: "key", html: "Trust is transitive and anchored: you trust the leaf because you trust the chain up to a root your device already trusts. Break or distrust any link and the whole chain fails — which is exactly how a misbehaving CA gets removed." },
            { t: "h", text: "When certificates go wrong" },
            {
              t: "table",
              headers: ["Problem", "What the browser does"],
              rows: [
                ["Expired certificate", "Hard error — refuse or warn"],
                ["Name mismatch", "Reject — cert isn't for this domain"],
                ["Untrusted issuer", "Reject — chain doesn't reach a trusted root"],
                ["Revoked (CRL/OCSP)", "Reject — key was compromised"]
              ]
            },
            { t: "note", variant: "tip", html: "<strong>Let's Encrypt</strong> made free, automated 90-day certificates the norm. Short lifetimes plus automated renewal (ACME) mean a leaked key is exposed for weeks, not years." }
          ]
        },
        {
          id: "password-storage",
          title: "Storing passwords & entropy",
          summary: "Never store passwords you can read. Hash them slowly, salt them uniquely — and understand what makes one strong.",
          minutes: 8,
          tags: ["passwords", "hashing"],
          blocks: [
            { t: "p", html: "When a database leaks — and they do — the difference between a shrug and a catastrophe is how the passwords were stored. The rules are well known, and breaking them is negligence." },
            { t: "compare",
              bad: { title: "How breaches become disasters", items: ["Plaintext passwords", "Encrypted (reversible) passwords", "Fast hash: MD5/SHA-256 alone", "No salt \u2192 rainbow tables work", "Same hash for identical passwords"] },
              good: { title: "How to do it", items: ["Slow, memory-hard hash", "<strong>Argon2id</strong>, scrypt or bcrypt", "Unique random <strong>salt</strong> per user", "A <strong>pepper</strong> in an HSM/secret store", "Re-hash as hardware gets faster"] }
            },
            { t: "h", text: "Why slow and salted?" },
            {
              t: "ul", items: [
                "<strong>Salt</strong> — a unique random value per password, so identical passwords hash differently and precomputed (rainbow) tables are useless.",
                "<strong>Slow / memory-hard</strong> — bcrypt/scrypt/Argon2 are deliberately expensive, so an attacker manages thousands of guesses/sec, not billions.",
                "<strong>Pepper</strong> — a secret added to every hash, stored separately from the database, so a DB dump alone isn't enough."
              ]
            },
            {
              t: "code", lang: "python", code:
"# Argon2id via passlib — slow + salted + memory-hard\n" +
"from passlib.hash import argon2\n\n" +
"stored = argon2.hash('correct horse battery staple')  # salt auto-generated\n" +
"# stored: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>\n\n" +
"argon2.verify('correct horse battery staple', stored)  # True\n" +
"argon2.verify('hunter2', stored)                         # False\n"
            },
            { t: "h", text: "What makes a password strong: entropy" },
            { t: "p", html: "Strength is measured in <strong>entropy bits</strong> \u2014 how unpredictable a password is, not whether it has a special character. Length and unpredictability beat complexity rules. Test a few below (don't use a real one)." },
            { t: "widget", id: "entropy" },
            { t: "note", variant: "key", html: "A long passphrase of random words can have far more entropy than <code>P@ss1!</code>. Modern guidance (NIST): favor length, screen against breached-password lists, and drop forced periodic resets and arbitrary composition rules." },
            { t: "quiz", id: "crypto-applied" }
          ]
        }
      ]
    }
  ]
};

/* =====================================================================
   BLUEPRINT · Data Structures & Algorithms curriculum
   window.TRACKS.dsa
   Self-contained: every lesson teaches the topic from first principles.
   Same block grammar as the HLD/LLD tracks.
   ===================================================================== */
(function () {
  window.TRACKS = window.TRACKS || {};

  window.TRACKS.dsa = {
    id: "dsa",
    name: "Data Structures & Algorithms",
    short: "DSA",
    tagline: "The ground both halves stand on",
    color: "#a78bfa",
    blurb: "The pre-requisite knowledge most engineers skip. Arrays, hashing, linked lists, sorting, heaps, tries, graphs, recursion and backtracking — built from first principles, with interactive labs you can step through line by line.",
    modules: [
      /* ===================== FOUNDATIONS ===================== */
      {
        id: "foundations",
        name: "Foundations",
        icon: "compass",
        lessons: [
          {
            id: "arrays",
            title: "Arrays: the bedrock",
            summary: "Contiguous memory, O(1) indexing, and the dynamic array that powers every list, vector and stack you use.",
            minutes: 8,
            tags: ["array", "memory", "amortized"],
            blocks: [
              { t: "p", html: "Almost every other data structure is built on top of the <strong>array</strong>: a block of <em>contiguous</em> memory holding equal-sized slots. Because the slots are contiguous and equal-sized, the address of element <code>i</code> is just <code>base + i × size</code> — a single multiply-and-add. That is why array indexing is <strong>O(1)</strong>." },
              { t: "note", variant: "key", html: "DSA feels hard not because you lack talent, but because the prerequisites are skipped. This whole track rebuilds them from the ground up — and the array is step one." },
              { t: "h", text: "Static vs. dynamic arrays" },
              { t: "p", html: "A <strong>static</strong> array has a fixed capacity. A <strong>dynamic</strong> array (Python <code>list</code>, Java <code>ArrayList</code>, C++ <code>vector</code>, Go <code>slice</code>) grows automatically: when it fills up, it allocates a bigger block (usually 2×) and copies everything over." },
              {
                t: "table",
                headers: ["Operation", "Cost", "Why"],
                rows: [
                  ["Index <code>a[i]</code>", "O(1)", "Direct address arithmetic"],
                  ["Update <code>a[i]=x</code>", "O(1)", "Write to a known address"],
                  ["Append (amortized)", "O(1)", "Doubling makes copies rare"],
                  ["Append (worst case)", "O(n)", "The resize that copies all n"],
                  ["Insert / delete in middle", "O(n)", "Shift everything after it"],
                  ["Search (unsorted)", "O(n)", "Must scan"]
                ]
              },
              { t: "note", variant: "tip", html: "<strong>Amortized O(1):</strong> doubling means that across n appends you do at most ~2n copies total, so the <em>average</em> append is constant even though one in a while is expensive. Amortized analysis is why \u201cappend is O(1)\u201d is a fair claim." },
              { t: "h", text: "Multidimensional arrays" },
              { t: "p", html: "A 2-D array is stored as one long 1-D array in <em>row-major</em> order (C, Python NumPy) or column-major (Fortran, MATLAB). Walking memory in storage order is dramatically faster thanks to CPU cache lines — a real performance lever, not just trivia." },
              { t: "code", lang: "python", code:
                "# Row-major address of grid[r][c] in an R x C matrix:\n" +
                "#   index = r * C + c\n" +
                "grid = [[0] * C for _ in range(R)]   # R rows, C cols\n\n" +
                "# Cache-friendly: iterate rows in the outer loop\n" +
                "for r in range(R):\n" +
                "    for c in range(C):\n" +
                "        total += grid[r][c]   # walks memory sequentially"
              }
            ]
          },
          {
            id: "complexity",
            title: "Big-O, time & space",
            summary: "How to reason about cost as input grows — and the time/space trade-offs that recursion quietly makes for you.",
            minutes: 9,
            tags: ["big-o", "complexity", "recursion"],
            blocks: [
              { t: "p", html: "<strong>Big-O</strong> describes how the work an algorithm does grows as the input size <code>n</code> grows, ignoring constants and lower-order terms. It is an upper bound on the growth <em>rate</em> — the shape of the curve, not the exact number of operations." },
              { t: "widget", id: "bigo" },
              { t: "h", text: "The hierarchy you must know cold" },
              {
                t: "ul", items: [
                  "<strong>O(1)</strong> constant — hash lookup, array index.",
                  "<strong>O(log n)</strong> logarithmic — binary search, balanced-tree ops.",
                  "<strong>O(n)</strong> linear — a single scan.",
                  "<strong>O(n log n)</strong> — the best comparison sorts; divide-and-conquer.",
                  "<strong>O(n\u00b2)</strong> quadratic — nested loops over the same data.",
                  "<strong>O(2\u207f)</strong> / <strong>O(n!)</strong> — brute-force subsets / permutations; only tiny n."
                ]
              },
              { t: "note", variant: "trap", html: "Big-O hides constants, but constants matter in the real world. An O(n) algorithm with a huge constant can lose to an O(n log n) one for realistic n. Big-O tells you how things <em>scale</em>; benchmarks tell you what's fast <em>today</em>." },
              { t: "h", text: "Space complexity & the recursion tax" },
              { t: "p", html: "Space complexity counts the <em>extra</em> memory an algorithm needs beyond its input. Recursion is the sneaky one: every pending call sits on the <strong>call stack</strong>, so a recursion that goes <code>d</code> deep uses <strong>O(d)</strong> space even if it allocates nothing else." },
              { t: "code", lang: "python", code:
                "# This looks free, but it costs O(n) STACK space:\n" +
                "def sum_to(n):\n" +
                "    if n == 0:\n" +
                "        return 0\n" +
                "    return n + sum_to(n - 1)   # n frames pile up\n\n" +
                "# The iterative version is O(1) space:\n" +
                "def sum_to_iter(n):\n" +
                "    total = 0\n" +
                "    for i in range(1, n + 1):\n" +
                "        total += i\n" +
                "    return total"
              },
              { t: "note", variant: "key", html: "<strong>Time\u2013space trade-off:</strong> you can often buy speed with memory (memoization, prefix sums, hash tables) or save memory by recomputing. Naming which one you're choosing is a senior move." }
            ]
          },
          {
            id: "hashing",
            title: "Sets & hash tables",
            summary: "O(1) average lookup, the trick behind half of all interview solutions — and when hashing quietly degrades.",
            minutes: 8,
            tags: ["hash", "set", "map"],
            blocks: [
              { t: "p", html: "A <strong>hash table</strong> turns a key into an array index by running it through a <em>hash function</em>, giving <strong>O(1) average</strong> insert, lookup and delete. A <strong>set</strong> is just a hash table that stores keys without values. If you remember one interview tool, make it this one." },
              { t: "h", text: "How it works" },
              {
                t: "ul", items: [
                  "<strong>Hash function</strong> maps a key to a bucket index: <code>h(key) % capacity</code>.",
                  "<strong>Collisions</strong> (two keys, same bucket) are resolved by <em>chaining</em> (a list per bucket) or <em>open addressing</em> (probe for the next free slot).",
                  "<strong>Load factor</strong> = entries / buckets. When it gets high, the table <em>resizes</em> and rehashes — amortized O(1) still holds.",
                  "<strong>Worst case is O(n)</strong> when many keys collide (bad hash or adversarial input)."
                ]
              },
              { t: "code", lang: "python", code:
                "# The canonical hash-table move: two-sum in O(n)\n" +
                "def two_sum(nums, target):\n" +
                "    seen = {}                 # value -> index\n" +
                "    for i, x in enumerate(nums):\n" +
                "        if target - x in seen:   # O(1) average lookup\n" +
                "            return [seen[target - x], i]\n" +
                "        seen[x] = i\n" +
                "    return []"
              },
              { t: "compare", bad: { title: "Brute force", items: ["Two nested loops", "O(n\u00b2) time", "Re-checks every pair"] }, good: { title: "Hash table", items: ["One pass, remember what you've seen", "O(n) time, O(n) space", "Lookup is O(1) average"] } },
              { t: "note", variant: "tip", html: "Reach for a hash set/map when a problem says \u201chave I seen this before?\u201d, \u201ccount occurrences\u201d, \u201cfind duplicates\u201d, or \u201cgroup by\u201d. It usually collapses an O(n\u00b2) scan into O(n)." },
              { t: "quiz", id: "dsa-foundations" }
            ]
          }
        ]
      },

      /* ===================== LINEAR ===================== */
      {
        id: "linear",
        name: "Linear Structures & Techniques",
        icon: "queue",
        lessons: [
          {
            id: "linked-lists",
            title: "Linked lists: traverse & reverse",
            summary: "Pointers instead of contiguous memory — O(1) splicing, no random access, and the reversal every interviewer loves.",
            minutes: 8,
            tags: ["linked-list", "pointers"],
            blocks: [
              { t: "p", html: "A <strong>linked list</strong> stores each element in a <em>node</em> that also holds a pointer to the next node. Nodes can live anywhere in memory, so there is no index arithmetic: you reach element <code>i</code> by following <code>i</code> pointers — <strong>O(n)</strong>. In exchange, inserting or deleting once you hold a node is <strong>O(1)</strong>." },
              {
                t: "table",
                headers: ["", "Array", "Linked list"],
                rows: [
                  ["Random access <code>a[i]</code>", "O(1)", "O(n)"],
                  ["Insert/delete at a held node", "O(n) (shift)", "O(1) (re-point)"],
                  ["Memory layout", "Contiguous, cache-friendly", "Scattered, pointer-chasing"],
                  ["Extra memory", "None", "A pointer per node"]
                ]
              },
              { t: "h", text: "The two techniques that solve most problems" },
              { t: "p", html: "<strong>Reversal</strong> (re-point each <code>next</code> backwards) and the <strong>fast/slow pointer</strong> (one hops 2, one hops 1) cover a huge share of linked-list questions: find the middle, detect a cycle, find the cycle's start, check a palindrome." },
              { t: "code", lang: "python", code:
                "# Iterative reversal — the one to memorize\n" +
                "def reverse(head):\n" +
                "    prev = None\n" +
                "    cur = head\n" +
                "    while cur:\n" +
                "        nxt = cur.next   # remember the rest\n" +
                "        cur.next = prev  # flip the link\n" +
                "        prev = cur       # advance prev\n" +
                "        cur = nxt        # advance cur\n" +
                "    return prev          # new head\n\n" +
                "# Floyd's cycle detection (fast & slow)\n" +
                "def has_cycle(head):\n" +
                "    slow = fast = head\n" +
                "    while fast and fast.next:\n" +
                "        slow = slow.next\n" +
                "        fast = fast.next.next\n" +
                "        if slow is fast:\n" +
                "            return True\n" +
                "    return False"
              },
              { t: "note", variant: "trap", html: "Always guard <code>fast and fast.next</code> before hopping two steps, and don't lose the <code>next</code> pointer before you overwrite it. Most linked-list bugs are a dropped or null pointer." },
            ]
          },
          {
            id: "two-pointer",
            title: "The two-pointer technique",
            summary: "Two indices that move toward or with each other to turn an O(n²) scan into a single O(n) pass.",
            minutes: 7,
            tags: ["two-pointer", "technique"],
            blocks: [
              { t: "p", html: "The <strong>two-pointer</strong> technique uses two indices that move through the data in a coordinated way. The classic form: on a <em>sorted</em> array, start one pointer at each end and move them inward based on whether their combination is too small or too big." },
              { t: "widget", id: "twopointer" },
              { t: "h", text: "The three common shapes" },
              {
                t: "ul", items: [
                  "<strong>Opposite ends</strong> \u2192 converging: pair-sum on a sorted array, container-with-most-water, valid palindrome.",
                  "<strong>Same direction</strong> \u2192 fast/slow: remove duplicates in place, the sliding-window family.",
                  "<strong>Two sequences</strong>: merge two sorted lists, intersection of sorted arrays."
                ]
              },
              { t: "code", lang: "python", code:
                "# Pair that sums to target on a SORTED array — O(n), O(1) space\n" +
                "def pair_sum(arr, target):\n" +
                "    lo, hi = 0, len(arr) - 1\n" +
                "    while lo < hi:\n" +
                "        s = arr[lo] + arr[hi]\n" +
                "        if s == target:\n" +
                "            return (lo, hi)\n" +
                "        if s < target:\n" +
                "            lo += 1     # need a bigger sum\n" +
                "        else:\n" +
                "            hi -= 1     # need a smaller sum\n" +
                "    return None"
              },
              { t: "note", variant: "key", html: "Two pointers only works when moving a pointer changes the answer <em>monotonically</em>. On a sorted array, moving <code>lo</code> right can only increase the sum and <code>hi</code> left can only decrease it — that's what lets you safely discard half the search at each step." },
            ]
          },
          {
            id: "prefix-sum",
            title: "Prefix sums & range queries",
            summary: "Pre-compute once, then answer any range-sum in O(1) — and meet sparse tables for range min/max.",
            minutes: 7,
            tags: ["prefix-sum", "range-query"],
            blocks: [
              { t: "p", html: "If you'll be asked for the sum of many sub-ranges of a fixed array, don't re-add each time. Build a <strong>prefix-sum</strong> array <code>P</code> where <code>P[i]</code> is the sum of the first <code>i</code> elements. Then the sum of any range <code>[l, r]</code> is just <code>P[r+1] - P[l]</code> — <strong>O(1)</strong> per query after an O(n) build." },
              { t: "widget", id: "prefixsum" },
              { t: "code", lang: "python", code:
                "# Build once: O(n)\n" +
                "def build_prefix(arr):\n" +
                "    P = [0] * (len(arr) + 1)\n" +
                "    for i, x in enumerate(arr):\n" +
                "        P[i + 1] = P[i] + x\n" +
                "    return P\n\n" +
                "# Query any range in O(1)\n" +
                "def range_sum(P, l, r):      # inclusive [l, r]\n" +
                "    return P[r + 1] - P[l]"
              },
              { t: "note", variant: "tip", html: "The same idea generalizes: 2-D prefix sums answer sub-rectangle sums in O(1), and a <strong>difference array</strong> is the inverse — it applies many range <em>updates</em> in O(1) each and reconstructs the result at the end." },
              { t: "h", text: "Sparse tables for idempotent queries" },
              { t: "p", html: "Range <em>min/max</em> can't be undone by subtraction, so prefix sums don't apply. A <strong>sparse table</strong> pre-computes answers for every power-of-two length in O(n log n), then answers each min/max query in <strong>O(1)</strong> by overlapping two pre-computed ranges. It assumes the array doesn't change." }
            ]
          },
          {
            id: "sliding-window",
            title: "The sliding window",
            summary: "A window that grows and shrinks over a contiguous range — turning many O(n²) subarray scans into a single O(n) pass.",
            minutes: 8,
            tags: ["sliding-window", "technique", "array", "string"],
            blocks: [
              { t: "p", html: "The <strong>sliding window</strong> keeps a contiguous range <code>[L, R]</code> over an array or string and slides it across the data instead of re-examining every subarray. Each element enters the window once (as <code>R</code> advances) and leaves at most once (as <code>L</code> advances), so the whole scan is <strong>O(n)</strong> rather than O(n²)." },
              { t: "widget", id: "slidingwindow" },
              { t: "h", text: "Fixed vs. variable windows" },
              {
                t: "ul", items: [
                  "<strong>Fixed window</strong> \u2014 the size <code>k</code> is given. Slide it one step at a time, adding the entering element and subtracting the leaving one (maximum sum of k consecutive elements, moving averages).",
                  "<strong>Variable window</strong> \u2014 grow <code>R</code> to include more, and shrink <code>L</code> whenever a constraint breaks (longest substring without repeats, smallest subarray with sum \u2265 target)."
                ]
              },
              { t: "code", lang: "python", code:
                "# Fixed window: max sum of k consecutive elements\n" +
                "def max_sum_k(a, k):\n" +
                "    window = sum(a[:k]); best = window\n" +
                "    for r in range(k, len(a)):\n" +
                "        window += a[r] - a[r - k]    # add entering, drop leaving\n" +
                "        best = max(best, window)\n" +
                "    return best\n\n" +
                "# Variable window: longest substring without repeating chars\n" +
                "def longest_unique(s):\n" +
                "    seen = {}; L = 0; best = 0\n" +
                "    for R, c in enumerate(s):\n" +
                "        if c in seen and seen[c] >= L:\n" +
                "            L = seen[c] + 1          # shrink past the duplicate\n" +
                "        seen[c] = R\n" +
                "        best = max(best, R - L + 1)\n" +
                "    return best"
              },
              { t: "note", variant: "key", html: "The window works when the quantity you track can be updated <em>incrementally</em> as elements enter and leave \u2014 a running sum, a character count, a max via a monotonic deque. If recomputing the window from scratch is unavoidable, it isn't a sliding-window problem." },
              { t: "note", variant: "tip", html: "Spot it from the words: <em>contiguous subarray / substring</em> plus <em>longest, shortest, maximum, minimum,</em> or <em>at most K</em>. A neat counting trick: <strong>exactly K = atMost(K) \u2212 atMost(K\u22121)</strong>, two easy windows instead of one tricky one." },
              { t: "quiz", id: "dsa-linear" }
            ]
          }
        ]
      },

      /* ===================== SORTING ===================== */
      {
        id: "sorting",
        name: "Sorting & Searching",
        icon: "trend",
        lessons: [
          {
            id: "sorting-bound",
            title: "Why sorting is \u03a9(n log n)",
            summary: "The comparison-sort lower bound, and a tour of bubble, insertion, merge and quick sort in one visualizer.",
            minutes: 9,
            tags: ["sorting", "lower-bound"],
            blocks: [
              { t: "p", html: "Any sort that only ever <em>compares</em> pairs of elements can't beat <strong>\u03a9(n log n)</strong>. The reason is beautiful: there are <code>n!</code> possible orderings, each comparison has two outcomes, and a binary decision tree with <code>n!</code> leaves must be at least <code>log\u2082(n!) \u2248 n log n</code> deep. No clever comparison sort escapes that floor." },
              { t: "widget", id: "sortviz" },
              {
                t: "table",
                headers: ["Algorithm", "Average", "Worst", "Space", "Stable?"],
                rows: [
                  ["Bubble", "O(n\u00b2)", "O(n\u00b2)", "O(1)", "Yes"],
                  ["Insertion", "O(n\u00b2)", "O(n\u00b2)", "O(1)", "Yes"],
                  ["Selection", "O(n\u00b2)", "O(n\u00b2)", "O(1)", "No"],
                  ["Merge", "O(n log n)", "O(n log n)", "O(n)", "Yes"],
                  ["Quick", "O(n log n)", "O(n\u00b2)", "O(log n)", "No"]
                ]
              },
              { t: "note", variant: "key", html: "<strong>Quicksort</strong> is usually fastest in practice (great cache behavior, in-place) but has an O(n\u00b2) worst case on bad pivots. <strong>Merge sort</strong> guarantees O(n log n) and is stable, at the cost of O(n) extra space. Real libraries often use <em>Timsort</em> — a hybrid of merge and insertion sort tuned for real-world, partially-sorted data." },
              { t: "h", text: "Stability — why it matters" },
              { t: "p", html: "A sort is <strong>stable</strong> if equal keys keep their original relative order. That's what lets you sort by one field, then another, and have the first ordering survive as a tie-breaker (sort by name, then by age \u2192 same-age people stay alphabetical)." }
            ]
          },
          {
            id: "linear-sorts",
            title: "Counting, radix & bucket sort",
            summary: "When the keys are small integers you can beat the n log n wall and sort in linear time.",
            minutes: 7,
            tags: ["counting-sort", "radix", "non-comparison"],
            blocks: [
              { t: "p", html: "The n log n floor only binds <em>comparison</em> sorts. If you don't compare — if you use the keys themselves to index into buckets — you can sort in <strong>O(n + k)</strong>. These are the non-comparison sorts." },
              {
                t: "ul", items: [
                  "<strong>Counting sort</strong> \u2014 count how many of each key, then write them back in order. O(n + k) where <code>k</code> is the key range. Great when keys are small integers.",
                  "<strong>Radix sort</strong> \u2014 counting-sort digit by digit (least-significant first). O(d\u00b7(n + b)) for <code>d</code> digits, base <code>b</code>. Sorts big integers and fixed-length strings.",
                  "<strong>Bucket sort</strong> \u2014 scatter values into buckets by range, sort each bucket, concatenate. O(n) average on uniformly-distributed data."
                ]
              },
              { t: "code", lang: "python", code:
                "# Counting sort for keys in [0, k]\n" +
                "def counting_sort(arr, k):\n" +
                "    count = [0] * (k + 1)\n" +
                "    for x in arr:\n" +
                "        count[x] += 1            # tally\n" +
                "    out = []\n" +
                "    for v in range(k + 1):\n" +
                "        out.extend([v] * count[v])  # write back in order\n" +
                "    return out"
              },
              { t: "note", variant: "trap", html: "Counting sort's <code>k</code> is the <em>range</em> of keys, not the count. Sorting values up to a billion would need a billion-slot array \u2014 linear time but disastrous space. These sorts win only when <code>k</code> is comparable to <code>n</code>." },
              { t: "quiz", id: "dsa-sorting" }
            ]
          },
          {
            id: "binary-search",
            title: "Binary search & the invariant",
            summary: "Halving the search space each step — the O(log n) workhorse, and how to write it without off-by-one bugs.",
            minutes: 7,
            tags: ["binary-search", "invariant"],
            blocks: [
              { t: "p", html: "On a <strong>sorted</strong> array, <strong>binary search</strong> finds a target in <strong>O(log n)</strong> by repeatedly halving the search window. Each comparison throws away half of what's left \u2014 32 elements take at most 5 checks, a billion take ~30." },
              { t: "code", lang: "python", code:
                "# Classic binary search; returns index or -1\n" +
                "def binary_search(arr, target):\n" +
                "    lo, hi = 0, len(arr) - 1       # inclusive bounds\n" +
                "    while lo <= hi:\n" +
                "        mid = (lo + hi) // 2        # avoids overflow vs (lo+hi)\n" +
                "        if arr[mid] == target:\n" +
                "            return mid\n" +
                "        if arr[mid] < target:\n" +
                "            lo = mid + 1            # discard left half\n" +
                "        else:\n" +
                "            hi = mid - 1            # discard right half\n" +
                "    return -1"
              },
              { t: "note", variant: "key", html: "Pick a <strong>loop invariant</strong> and never break it. With inclusive bounds <code>[lo, hi]</code> the loop runs while <code>lo &lt;= hi</code> and each branch moves a bound <em>past</em> mid (<code>mid+1</code> / <code>mid-1</code>) so the window always shrinks. Mixing inclusive and exclusive bounds is where the off-by-one bugs live." },
              { t: "note", variant: "tip", html: "Binary search isn't just for arrays. \u201cBinary search on the answer\u201d solves optimization problems: if you can cheaply test \u201cis a value of X feasible?\u201d and feasibility is monotonic, binary-search the smallest feasible X." }
            ]
          }
        ]
      },

      /* ===================== HEAPS, TRIES & TREES ===================== */
      {
        id: "trees-heaps",
        name: "Heaps, Tries & Trees",
        icon: "share",
        lessons: [
          {
            id: "heaps",
            title: "Heaps & priority queues",
            summary: "A complete binary tree in an array that gives you the min (or max) in O(1) and reshuffles in O(log n).",
            minutes: 9,
            tags: ["heap", "priority-queue", "heapsort"],
            blocks: [
              { t: "p", html: "A <strong>binary heap</strong> is a <em>complete</em> binary tree with the <strong>heap property</strong>: in a min-heap every parent is \u2264 its children, so the minimum is always at the root. It's the standard way to implement a <strong>priority queue</strong> \u2014 a queue where you always pull out the most important item next." },
              { t: "widget", id: "heap" },
              { t: "h", text: "The array trick" },
              { t: "p", html: "A heap needs no pointers. Store it level-by-level in an array and the tree shape is implicit: for the node at index <code>i</code>, its children are at <code>2i+1</code> and <code>2i+2</code>, and its parent is at <code>(i\u22121)/2</code>." },
              {
                t: "table",
                headers: ["Operation", "Cost", "How"],
                rows: [
                  ["Peek min/max", "O(1)", "It's the root, <code>heap[0]</code>"],
                  ["Insert", "O(log n)", "Append, then <em>sift up</em>"],
                  ["Extract min/max", "O(log n)", "Swap root with last, <em>sift down</em>"],
                  ["Build from n items", "O(n)", "Heapify bottom-up (not n log n!)"]
                ]
              },
              { t: "note", variant: "key", html: "<strong>Heapsort</strong> falls out for free: build a heap (O(n)), then extract the min n times (O(n log n)). It sorts in place with O(n log n) <em>worst-case</em> time \u2014 no bad-pivot risk like quicksort." },
            ]
          },
          {
            id: "heap-apps",
            title: "Heap applications: top-k, Dijkstra, Huffman",
            summary: "Three places the heap is the right tool — and why a size-k heap beats sorting for top-k.",
            minutes: 8,
            tags: ["heap", "top-k", "dijkstra", "huffman"],
            blocks: [
              { t: "p", html: "Once you can pull the smallest thing out cheaply, a surprising number of problems become easy. Three you'll see again and again:" },
              { t: "h", text: "1 · Top-k elements" },
              { t: "p", html: "To find the <code>k</code> largest of <code>n</code> items, keep a <strong>min-heap of size k</strong>. Push each item; if the heap exceeds <code>k</code>, pop the smallest. You end with the k largest in <strong>O(n log k)</strong> time and O(k) space \u2014 better than sorting everything in O(n log n) when k \u226a n." },
              { t: "code", lang: "python", code:
                "import heapq\n\n" +
                "def top_k(nums, k):\n" +
                "    heap = []                      # min-heap of size k\n" +
                "    for x in nums:\n" +
                "        heapq.heappush(heap, x)\n" +
                "        if len(heap) > k:\n" +
                "            heapq.heappop(heap)    # drop the smallest so far\n" +
                "    return heap                    # the k largest"
              },
              { t: "h", text: "2 · Dijkstra's shortest path" },
              { t: "p", html: "Dijkstra repeatedly expands the <em>closest</em> unsettled node. A min-heap keyed by distance hands you that node in O(log n), turning shortest-path on a weighted graph into <strong>O((V + E) log V)</strong>." },
              { t: "h", text: "3 · Huffman coding" },
              { t: "p", html: "To build an optimal prefix code, repeatedly merge the two <em>least-frequent</em> symbols into a subtree. A min-heap on frequency makes \u201ctwo smallest\u201d an O(log n) operation, and the result is a provably minimal-length encoding." },
              { t: "note", variant: "tip", html: "The tell that a heap fits: the problem repeatedly needs \u201cthe smallest / largest / closest / most-frequent remaining thing\u201d while the set keeps changing. That's a priority queue." },
            ]
          },
          {
            id: "tries",
            title: "Tries for strings",
            summary: "A tree of characters where shared prefixes share a path — the structure behind autocomplete and spell-check.",
            minutes: 8,
            tags: ["trie", "prefix-tree", "strings"],
            blocks: [
              { t: "p", html: "A <strong>trie</strong> (prefix tree) stores a set of strings as a tree where each edge is one character and each path from the root spells a prefix. Words that share a prefix share that part of the path, which makes prefix queries extremely fast." },
              { t: "widget", id: "trie" },
              {
                t: "ul", items: [
                  "<strong>Insert / search a word</strong> of length <code>L</code> \u2014 <strong>O(L)</strong>, independent of how many words are stored.",
                  "<strong>Prefix search</strong> (\u201call words starting with <em>ca</em>\u201d) \u2014 walk to the prefix node, then collect its subtree. This is autocomplete.",
                  "<strong>Space</strong> \u2014 can be large (a node per character) but shared prefixes save a lot; a compressed <em>radix tree</em> packs single-child chains."
                ]
              },
              { t: "code", lang: "python", code:
                "class TrieNode:\n" +
                "    def __init__(self):\n" +
                "        self.kids = {}        # char -> TrieNode\n" +
                "        self.end = False      # marks a complete word\n\n" +
                "class Trie:\n" +
                "    def __init__(self):\n" +
                "        self.root = TrieNode()\n\n" +
                "    def insert(self, word):\n" +
                "        node = self.root\n" +
                "        for c in word:\n" +
                "            node = node.kids.setdefault(c, TrieNode())\n" +
                "        node.end = True\n\n" +
                "    def starts_with(self, prefix):\n" +
                "        node = self.root\n" +
                "        for c in prefix:\n" +
                "            if c not in node.kids:\n" +
                "                return False\n" +
                "            node = node.kids[c]\n" +
                "        return True"
              },
              { t: "note", variant: "key", html: "A hash set answers \u201cis this exact word present?\u201d in O(L) too \u2014 but it can't do <em>prefix</em> queries. The trie's superpower is that every internal node already represents a prefix, so autocomplete and longest-common-prefix come for free." },
              { t: "quiz", id: "dsa-trees" }
            ]
          }
        ]
      },

      /* ===================== GRAPHS ===================== */
      {
        id: "graphs",
        name: "Graphs",
        icon: "globe",
        lessons: [
          {
            id: "graph-basics",
            title: "Graphs: types & representation",
            summary: "Vertices and edges — directed vs undirected, weighted vs not, and adjacency list vs matrix.",
            minutes: 8,
            tags: ["graph", "adjacency"],
            blocks: [
              { t: "p", html: "A <strong>graph</strong> is just a set of <em>vertices</em> connected by <em>edges</em>. It's the most general structure here \u2014 trees and linked lists are special cases \u2014 and it models roads, social networks, dependencies, the web, and state machines." },
              { t: "h", text: "The vocabulary" },
              {
                t: "ul", items: [
                  "<strong>Directed</strong> (edges have a direction, like \u201cA follows B\u201d) vs <strong>undirected</strong> (mutual, like \u201cA is friends with B\u201d).",
                  "<strong>Weighted</strong> (edges carry a cost/distance) vs <strong>unweighted</strong>.",
                  "<strong>Cyclic</strong> vs <strong>acyclic</strong>; a directed acyclic graph is a <strong>DAG</strong> \u2014 the shape of dependencies and schedules.",
                  "<strong>Dense</strong> (many edges, E \u2248 V\u00b2) vs <strong>sparse</strong> (few, E \u2248 V) \u2014 this drives which representation you pick."
                ]
              },
              { t: "h", text: "Two ways to store it" },
              {
                t: "table",
                headers: ["", "Adjacency list", "Adjacency matrix"],
                rows: [
                  ["Space", "O(V + E)", "O(V\u00b2)"],
                  ["\u201cIs there an edge u\u2013v?\u201d", "O(degree)", "O(1)"],
                  ["Iterate a vertex's neighbors", "O(degree)", "O(V)"],
                  ["Best for", "Sparse graphs (most real ones)", "Dense graphs / quick edge checks"]
                ]
              },
              { t: "code", lang: "python", code:
                "# Adjacency list — the default for most problems\n" +
                "from collections import defaultdict\n\n" +
                "graph = defaultdict(list)\n" +
                "def add_edge(u, v, directed=False):\n" +
                "    graph[u].append(v)\n" +
                "    if not directed:\n" +
                "        graph[v].append(u)"
              },
            ]
          },
          {
            id: "bfs",
            title: "BFS: shortest paths & bipartite",
            summary: "Explore level by level with a queue — unweighted shortest paths, connected components, and 2-coloring.",
            minutes: 8,
            tags: ["bfs", "shortest-path", "bipartite"],
            blocks: [
              { t: "p", html: "<strong>Breadth-first search</strong> explores a graph in rings: all vertices one edge away, then two edges away, and so on. It uses a <strong>queue</strong> (FIFO) and visits each vertex and edge once \u2014 <strong>O(V + E)</strong>." },
              { t: "widget", id: "graphtraversal" },
              { t: "note", variant: "key", html: "Because BFS reaches vertices in order of distance, the first time it reaches a vertex is via a <strong>shortest path</strong> (in number of edges). That's why BFS \u2014 not Dijkstra \u2014 is the right tool for shortest paths on <em>unweighted</em> graphs." },
              { t: "h", text: "What BFS gives you" },
              {
                t: "ul", items: [
                  "<strong>Shortest path</strong> in an unweighted graph (track each node's parent to rebuild the path).",
                  "<strong>Connected components</strong> \u2014 BFS from every unvisited node; each sweep is one component.",
                  "<strong>Bipartite test</strong> \u2014 2-color the graph level by level; if two adjacent nodes ever get the same color, it isn't bipartite."
                ]
              },
              { t: "code", lang: "python", code:
                "from collections import deque\n\n" +
                "def bfs_shortest(graph, start):\n" +
                "    dist = {start: 0}\n" +
                "    q = deque([start])\n" +
                "    while q:\n" +
                "        u = q.popleft()           # FIFO -> level order\n" +
                "        for v in graph[u]:\n" +
                "            if v not in dist:\n" +
                "                dist[v] = dist[u] + 1\n" +
                "                q.append(v)\n" +
                "    return dist"
              },
            ]
          },
          {
            id: "dfs-undirected",
            title: "DFS on undirected graphs",
            summary: "Go deep with a stack or recursion — detect cycles, and find the articulation points whose removal disconnects a network.",
            minutes: 9,
            tags: ["dfs", "cycles", "articulation"],
            blocks: [
              { t: "p", html: "<strong>Depth-first search</strong> plunges as deep as possible before backing up. It uses a <strong>stack</strong> (often the call stack via recursion) and, like BFS, runs in <strong>O(V + E)</strong>. On undirected graphs it shines at structural questions." },
              { t: "p", html: "Flip the BFS/DFS toggle in the traversal lab above to watch the stack replace the queue \u2014 same graph, very different exploration order." },
              { t: "h", text: "Cycle detection" },
              { t: "p", html: "Run DFS and track each node's parent. If you ever reach an already-visited node that <em>isn't</em> the parent you came from, you've found a <strong>back edge</strong> \u2014 and a cycle." },
              { t: "h", text: "Articulation points & bridges" },
              { t: "p", html: "An <strong>articulation point</strong> (cut vertex) is a node whose removal increases the number of connected components \u2014 a single point of failure in a network. A <strong>bridge</strong> is the edge equivalent. DFS finds them all in one pass using <em>discovery times</em> and <em>low-link</em> values (the earliest-discovered node reachable from a subtree)." },
              { t: "code", lang: "python", code:
                "# Cycle detection in an undirected graph via DFS\n" +
                "def has_cycle(graph, n):\n" +
                "    seen = set()\n" +
                "    def dfs(u, parent):\n" +
                "        seen.add(u)\n" +
                "        for v in graph[u]:\n" +
                "            if v not in seen:\n" +
                "                if dfs(v, u):\n" +
                "                    return True\n" +
                "            elif v != parent:    # back edge -> cycle\n" +
                "                return True\n" +
                "        return False\n" +
                "    return any(dfs(s, -1) for s in range(n) if s not in seen)"
              },
              { t: "note", variant: "tip", html: "Articulation points and bridges matter in the real world: they are the routers and links whose failure splits a network. Finding them is how you locate single points of failure in a topology." },
            ]
          },
          {
            id: "dfs-directed",
            title: "DFS on directed graphs",
            summary: "Topological sort for dependency order, and Tarjan/Kosaraju for strongly connected components.",
            minutes: 9,
            tags: ["dfs", "topological-sort", "scc"],
            blocks: [
              { t: "p", html: "On <em>directed</em> graphs, DFS unlocks two heavyweight results: ordering work that has dependencies, and clustering nodes that can all reach each other." },
              { t: "h", text: "Topological sort" },
              { t: "p", html: "A <strong>topological sort</strong> of a <strong>DAG</strong> lists its vertices so that every edge points forward \u2014 if A must happen before B, A comes first. It's exactly what a build system, course scheduler, or task runner needs. DFS produces it by recording each node when it <em>finishes</em>, then reversing that order." },
              { t: "code", lang: "python", code:
                "# Topological sort via DFS finish-order\n" +
                "def topo_sort(graph, n):\n" +
                "    seen, order = set(), []\n" +
                "    def dfs(u):\n" +
                "        seen.add(u)\n" +
                "        for v in graph[u]:\n" +
                "            if v not in seen:\n" +
                "                dfs(v)\n" +
                "        order.append(u)        # record on FINISH\n" +
                "    for s in range(n):\n" +
                "        if s not in seen:\n" +
                "            dfs(s)\n" +
                "    return order[::-1]          # reverse = topo order"
              },
              { t: "note", variant: "trap", html: "Topological sort only exists if the graph is acyclic. If DFS finds a back edge (an edge to a node still on the recursion stack), there's a cycle \u2014 and no valid ordering. Many schedulers use this to detect circular dependencies." },
              { t: "h", text: "Strongly connected components" },
              { t: "p", html: "A <strong>strongly connected component</strong> (SCC) is a maximal set of vertices where every node can reach every other. <strong>Kosaraju's</strong> algorithm finds them with two DFS passes (one on the graph, one on its transpose); <strong>Tarjan's</strong> does it in a single pass with low-link values. Collapsing each SCC to a point turns any directed graph into a DAG \u2014 the <em>condensation</em>." }
            ]
          },
          {
            id: "union-find",
            title: "Union-Find (disjoint set)",
            summary: "Track which elements are connected and merge groups in near-constant time — the structure behind cycle detection and Kruskal's MST.",
            minutes: 8,
            tags: ["union-find", "disjoint-set", "graph"],
            blocks: [
              { t: "p", html: "<strong>Union-Find</strong> (a <em>disjoint-set</em> structure) maintains a collection of non-overlapping groups and answers two questions blazingly fast: <strong>union(a, b)</strong> merges the groups containing a and b, and <strong>find(x)</strong> returns a <em>representative</em> for x's group. Two elements are connected exactly when they share a representative." },
              { t: "cue", html: "<b>Recognize it when</b> a problem is about <em>connectivity</em> or <em>grouping</em> that only ever <em>merges</em> (never splits): connected components in a growing graph, detecting a cycle while adding edges, Kruskal's minimum spanning tree, or 'are these accounts the same person?'" },
              { t: "widget", id: "unionfind" },
              { t: "h", text: "The two optimizations that make it fast" },
              {
                t: "ul", items: [
                  "<strong>Union by rank/size</strong> \u2014 always attach the shorter tree under the taller one, so trees stay shallow.",
                  "<strong>Path compression</strong> \u2014 during <code>find</code>, re-point every node on the path straight to the root, flattening the tree for next time."
                ]
              },
              { t: "p", html: "Together they give an <strong>almost-constant</strong> amortized cost per operation \u2014 O(\u03b1(n)), where \u03b1 is the inverse Ackermann function, which is \u2264 4 for any input you'll ever see. Toggle path compression off in the lab above to watch the find-step counter climb." },
              { t: "code", lang: "python", code:
                "class UnionFind:\n" +
                "    def __init__(self, n):\n" +
                "        self.parent = list(range(n))   # each node is its own root\n" +
                "        self.rank = [0] * n\n\n" +
                "    def find(self, x):\n" +
                "        while self.parent[x] != x:\n" +
                "            self.parent[x] = self.parent[self.parent[x]]  # path compression\n" +
                "            x = self.parent[x]\n" +
                "        return x\n\n" +
                "    def union(self, a, b):\n" +
                "        ra, rb = self.find(a), self.find(b)\n" +
                "        if ra == rb:\n" +
                "            return False               # already connected (a cycle, in MST terms)\n" +
                "        if self.rank[ra] < self.rank[rb]:\n" +
                "            ra, rb = rb, ra            # attach smaller under larger\n" +
                "        self.parent[rb] = ra\n" +
                "        if self.rank[ra] == self.rank[rb]:\n" +
                "            self.rank[ra] += 1\n" +
                "        return True"
              },
              { t: "note", variant: "key", html: "Use Union-Find over BFS/DFS when edges <em>arrive over time</em> and you keep asking 'connected yet?'. A fresh BFS per query is O(V+E) each time; Union-Find answers each in near-O(1) after cheap merges. The catch: it only <em>unions</em> \u2014 it can't efficiently <em>remove</em> an edge." },
              { t: "quiz", id: "dsa-graphs" }
            ]
          }
        ]
      },

      /* ===================== RECURSION, BACKTRACKING & DP ===================== */
      {
        id: "recursion",
        name: "Recursion, Backtracking & DP",
        icon: "cube",
        lessons: [
          {
            id: "recursion",
            title: "Recursion & the call stack",
            summary: "A function that calls itself, a base case that stops it, and the stack that remembers where you were.",
            minutes: 7,
            tags: ["recursion", "call-stack"],
            blocks: [
              { t: "p", html: "<strong>Recursion</strong> solves a problem by reducing it to a smaller version of itself. Every recursion needs two parts: a <strong>base case</strong> that returns without recursing, and a <strong>recursive case</strong> that moves toward the base case. Miss the base case and you get a stack overflow." },
              { t: "p", html: "Each call suspends and waits on the <strong>call stack</strong> until the calls beneath it return \u2014 which is why recursion depth <code>d</code> costs <strong>O(d)</strong> memory even when the function itself allocates nothing." },
              { t: "code", lang: "python", code:
                "# Three ingredients: base case, smaller subproblem, combine\n" +
                "def factorial(n):\n" +
                "    if n <= 1:            # base case\n" +
                "        return 1\n" +
                "    return n * factorial(n - 1)   # smaller subproblem\n\n" +
                "# Recursion + memo = dynamic programming\n" +
                "from functools import lru_cache\n\n" +
                "@lru_cache(maxsize=None)\n" +
                "def fib(n):\n" +
                "    if n < 2:\n" +
                "        return n\n" +
                "    return fib(n - 1) + fib(n - 2)   # O(n) with the cache, O(2^n) without"
              },
              { t: "note", variant: "key", html: "Recursion is the natural language of <strong>divide and conquer</strong> (merge sort, quicksort), <strong>trees</strong> (a tree is recursive by definition), and <strong>dynamic programming</strong> (recursion + memoization). Get comfortable trusting the recursive call to \u201cjust work\u201d on the smaller input." },
              { t: "note", variant: "tip", html: "Any recursion can be rewritten with an explicit stack to avoid deep call stacks. Some languages also do <em>tail-call</em> optimization \u2014 but Python and Java don't, so deep recursion can overflow; convert to iteration when depth can be large." }
            ]
          },
          {
            id: "backtracking",
            title: "Mastering backtracking",
            summary: "Systematic trial and error: choose, explore, un-choose — the template behind permutations, subsets, N-Queens and Sudoku.",
            minutes: 9,
            tags: ["backtracking", "recursion", "search"],
            blocks: [
              { t: "p", html: "<strong>Backtracking</strong> builds a solution one decision at a time and abandons a path (\u201cbacktracks\u201d) the instant it can't possibly lead to a valid answer. It's a depth-first search over the tree of partial solutions, with <em>pruning</em>." },
              { t: "widget", id: "backtracking" },
              { t: "h", text: "The universal template" },
              { t: "code", lang: "python", code:
                "def backtrack(state, choices):\n" +
                "    if is_solution(state):\n" +
                "        record(state)\n" +
                "        return\n" +
                "    for choice in choices:\n" +
                "        if is_valid(state, choice):\n" +
                "            state.add(choice)          # 1. choose\n" +
                "            backtrack(state, choices)  # 2. explore\n" +
                "            state.remove(choice)       # 3. un-choose (backtrack)"
              },
              { t: "p", html: "<strong>Choose \u2192 explore \u2192 un-choose.</strong> That three-line rhythm solves permutations, combinations, subsets, the N-Queens puzzle, Sudoku, word search, and maze solving. The art is in <code>is_valid</code> \u2014 the earlier you prune a doomed branch, the faster the search." },
              { t: "note", variant: "key", html: "Backtracking is worst-case exponential because the solution space is exponential. <strong>Pruning</strong> is what makes it practical: a good constraint check (like \u201cthis column/diagonal is already attacked\u201d in N-Queens) cuts off whole subtrees before you waste time exploring them." },
              { t: "note", variant: "trap", html: "Forgetting the un-choose step is the classic bug \u2014 the state leaks into sibling branches and you get garbage. Every change you make on the way down must be undone on the way back up." },
              { t: "quiz", id: "dsa-backtracking" }
            ]          },
          {
            id: "dynamic-programming",
            title: "Dynamic programming",
            summary: "Recursion that remembers. When subproblems overlap, solve each once and reuse it — memoization (top-down) or tabulation (bottom-up).",
            minutes: 9,
            tags: ["dp", "memoization", "tabulation", "recursion"],
            blocks: [
              { t: "p", html: "<strong>Dynamic programming (DP)</strong> applies when a problem has two properties: <em>overlapping subproblems</em> (the same smaller problems recur) and <em>optimal substructure</em> (the best answer is built from the best answers to those subproblems). The fix is simple — compute each subproblem <strong>once</strong> and remember it — but spotting <em>which</em> recursion to memoize is the skill." },
              { t: "p", html: "Naive Fibonacci recomputes <code>fib(n-2)</code> an exponential number of times. Memoizing collapses it to a single pass." },
              { t: "widget", id: "dptable" },
              { t: "h", text: "Two ways to write the same DP" },
              {
                t: "compare",
                bad: { title: "Top-down (memoization)", items: ["Write the natural recursion, then cache results", "Only computes the states you actually need", "Easy to derive from a brute-force solution", "✗ Recursion depth = O(n) stack"] },
                good: { title: "Bottom-up (tabulation)", items: ["Fill a table from the base cases upward", "No recursion — no stack overflow", "Often lets you shrink space to O(1)", "✗ Must order subproblems by dependency"] }
              },
              { t: "code", lang: "python", code:
                "# Top-down: recursion + a cache\n" +
                "from functools import lru_cache\n" +
                "@lru_cache(None)\n" +
                "def fib(n):\n" +
                "    if n < 2:\n" +
                "        return n\n" +
                "    return fib(n - 1) + fib(n - 2)   # O(n) with the cache, O(2^n) without\n\n" +
                "# Bottom-up: tabulation, O(1) space\n" +
                "def fib_iter(n):\n" +
                "    a, b = 0, 1\n" +
                "    for _ in range(n):\n" +
                "        a, b = b, a + b   # only the last two states matter\n" +
                "    return a"
              },
              { t: "h", text: "The recipe" },
              {
                t: "ol", items: [
                  "<strong>Define the state</strong> — what does <code>dp[i]</code> (or <code>dp[i][j]</code>) mean? This is 80% of the battle.",
                  "<strong>Write the transition</strong> — how is a state built from smaller ones?",
                  "<strong>Set the base cases</strong> — the smallest states you know outright.",
                  "<strong>Pick a direction</strong> — memoize the recursion, or tabulate bottom-up; optionally compress space."
                ]
              },
              { t: "note", variant: "key", html: "Most interview DP is a variation of a few archetypes: <strong>0/1 knapsack</strong>, <strong>unbounded knapsack</strong> (coin change), <strong>LCS / edit distance</strong> (two sequences), <strong>LIS</strong>, <strong>grid paths</strong>, and <strong>interval / partition DP</strong>. Recognize the archetype and the transition usually follows." },
              { t: "note", variant: "trap", html: "DP is <em>not</em> always the answer — if subproblems don't overlap, plain divide-and-conquer (or a greedy choice) is simpler and faster. Reach for DP only when the same subproblem is being recomputed." }
            ]          }
        ]
      },

      /* ===================== INTERVIEW CRAFT ===================== */
      {
        id: "interview",
        name: "Interview Craft",
        icon: "map",
        lessons: [
          {
            id: "framework",
            title: "A 7-step interview framework",
            summary: "Turn a blank whiteboard into a structured conversation — clarify, plan, then code with the interviewer, not at them.",
            minutes: 7,
            tags: ["interview", "framework", "communication"],
            blocks: [
              { t: "p", html: "Most coding-interview failures aren't about not knowing the algorithm \u2014 they're about jumping straight to code, going silent, and writing yourself into a corner. A repeatable framework fixes that. Here is a 7-step version." },
              {
                t: "ol", items: [
                  "<strong>Clarify the problem.</strong> Restate it, ask about input ranges, edge cases, duplicates, and what \u201cvalid\u201d means. Never start coding on assumptions.",
                  "<strong>Work a small example by hand.</strong> It surfaces hidden rules and gives you test cases for later.",
                  "<strong>State a brute-force approach.</strong> Get a correct baseline and its complexity on the table \u2014 it shows structured thinking and anchors the optimization.",
                  "<strong>Optimize deliberately.</strong> Name the bottleneck, then reach for the right tool (hash map, two pointers, sorting, a heap, DP) and say <em>why</em>.",
                  "<strong>Walk the plan out loud</strong> before coding. Get a nod from the interviewer; it's far cheaper to fix a plan than a screen of code.",
                  "<strong>Code cleanly.</strong> Good names, small helpers, talk as you go. Handle the edge cases you found in step 1.",
                  "<strong>Test & analyze.</strong> Dry-run your hand example, probe edges (empty, one element, all-equal, overflow), then state final time and space complexity."
                ]
              },
              { t: "note", variant: "key", html: "The interviewer is evaluating how you <em>think</em>, not whether you instantly recall the trick. Communicating a structured approach \u2014 even on a problem you don't fully crack \u2014 beats a silent correct answer." },
              { t: "note", variant: "tip", html: "Practice this framework on easy problems until it's automatic. Under stress you fall back to your habits, so build the right ones when the stakes are low." },
              { t: "quiz", id: "dsa-interview" }
            ]
          }
        ]
      }
    ]
  };
})();

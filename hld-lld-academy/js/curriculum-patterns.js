/* =====================================================================
   BLUEPRINT · DSA Interview Patterns curriculum
   window.TRACKS.patterns
   The 16 problem-solving patterns that unlock thousands of LeetCode
   problems — recognition signals, reusable templates, most-asked
   questions, pitfalls, and an interactive lab per pattern.
   Fully self-contained — no external links.
   ===================================================================== */
(function () {
  window.TRACKS = window.TRACKS || {};

  const ask = (items) => ({ t: "ul", items: items });

  window.TRACKS.patterns = {
    id: "patterns",
    name: "DSA Interview Patterns",
    short: "PAT",
    tagline: "Recognize, then solve",
    color: "#f472b6",
    blurb: "Stop grinding 500+ random problems. These 16 problem-solving patterns map to thousands of coding-interview questions. For each: the trigger signals that tell you to use it, a reusable template you can write from memory, the most-asked questions, the classic pitfalls, and an interactive lab to step through it.",
    modules: [
      /* ===================== ARRAY & STRING ===================== */
      {
        id: "arrays",
        name: "Array & String Scans",
        icon: "trend",
        lessons: [
          {
            id: "prefix-sum",
            title: "1 · Prefix Sum",
            summary: "Pre-compute cumulative totals once, then answer any range-sum query — or 'how many subarrays sum to k' — in O(1).",
            minutes: 7,
            tags: ["array", "prefix-sum"],
            blocks: [
              { t: "p", html: "The <strong>Prefix Sum</strong> pattern trades a little memory for fast range queries. Build an array <code class='tok'>P</code> where <code class='tok'>P[i]</code> holds the sum of the first <code class='tok'>i</code> elements; then the sum of any range <code class='tok'>[l, r]</code> is just <code class='tok'>P[r+1] - P[l]</code> — one subtraction instead of a loop." },
              { t: "cue", html: "<b>Recognize it when</b> the problem says <em>“sum of a subarray”</em>, <em>“range sum query”</em>, <em>“subarray that sums to k”</em>, or asks the same range question many times over a fixed array. Pair prefix sums with a <strong>hash map</strong> to count subarrays in one pass." },
              { t: "widget", id: "prefixsum" },
              { t: "code", lang: "python", code:
                "# Build once: O(n).  P[i] = sum of the first i elements\n" +
                "def build(nums):\n" +
                "    P = [0] * (len(nums) + 1)\n" +
                "    for i, x in enumerate(nums):\n" +
                "        P[i + 1] = P[i] + x\n" +
                "    return P\n\n" +
                "def range_sum(P, l, r):        # inclusive [l, r] in O(1)\n" +
                "    return P[r + 1] - P[l]\n\n" +
                "# Count subarrays summing to k — prefix + hash map, one pass O(n)\n" +
                "def subarray_sum(nums, k):\n" +
                "    count = running = 0\n" +
                "    freq = {0: 1}                 # a prefix of 0 has been seen once\n" +
                "    for x in nums:\n" +
                "        running += x\n" +
                "        count += freq.get(running - k, 0)\n" +
                "        freq[running] = freq.get(running, 0) + 1\n" +
                "    return count"
              },
              { t: "h", text: "Most-asked interview questions" },
              ask([
                "Range Sum Query – Immutable", "Subarray Sum Equals K", "Find Pivot Index",
                "Product of Array Except Self (prefix × suffix)", "Contiguous Array", "Subarray Sums Divisible by K"
              ]),
              { t: "note", variant: "trap", html: "Mind the off-by-one: with <code class='tok'>P[0] = 0</code> the range <code class='tok'>[l, r]</code> is <code class='tok'>P[r+1] - P[l]</code>, not <code class='tok'>P[r] - P[l]</code>. For <em>counting</em> subarrays equal to <code class='tok'>k</code>, seed the map with <code class='tok'>{0: 1}</code> so subarrays starting at index 0 are counted." }
            ]
          },
          {
            id: "two-pointers",
            title: "2 · Two Pointers",
            summary: "Two indices moving toward or alongside each other to collapse an O(n²) brute force into a single O(n) pass.",
            minutes: 7,
            tags: ["array", "two-pointers"],
            blocks: [
              { t: "p", html: "The <strong>Two Pointers</strong> pattern uses two indices that move in a coordinated way. The headline form: on a <em>sorted</em> array, start one pointer at each end and move them inward based on whether their combination is too small or too big — turning nested loops into one linear scan." },
              { t: "cue", html: "<b>Recognize it when</b> the input is <em>sorted</em> (or you can sort it), and you need a <em>pair / triplet</em> matching a condition, a <em>palindrome</em> check, to <em>partition</em> in place, or to merge two sequences. Two flavours: <strong>opposite ends</strong> (converging) and <strong>same direction</strong> (fast/slow read-write)." },
              { t: "widget", id: "twopointer" },
              { t: "code", lang: "python", code:
                "# Opposite ends on a SORTED array — pair summing to target\n" +
                "def two_sum_sorted(a, target):\n" +
                "    lo, hi = 0, len(a) - 1\n" +
                "    while lo < hi:\n" +
                "        s = a[lo] + a[hi]\n" +
                "        if s == target: return (lo, hi)\n" +
                "        if s < target:  lo += 1     # need a bigger sum\n" +
                "        else:           hi -= 1     # need a smaller sum\n" +
                "    return None\n\n" +
                "# Same direction (read/write) — remove duplicates in place\n" +
                "def dedupe(a):\n" +
                "    w = 1                            # next write slot\n" +
                "    for r in range(1, len(a)):\n" +
                "        if a[r] != a[w - 1]:\n" +
                "            a[w] = a[r]; w += 1\n" +
                "    return w                         # new length"
              },
              { t: "h", text: "Most-asked interview questions" },
              ask([
                "Two Sum II – Input Array Is Sorted", "3Sum", "Container With Most Water",
                "Trapping Rain Water", "Valid Palindrome", "Remove Duplicates from Sorted Array", "Sort Colors (Dutch flag)"
              ]),
              { t: "note", variant: "key", html: "Two pointers only works when moving a pointer changes the compared quantity <strong>monotonically</strong>. On a sorted array, moving <code class='tok'>lo</code> right can only raise the sum and <code class='tok'>hi</code> left can only lower it — that's what lets you safely discard possibilities each step." }
            ]
          },
          {
            id: "sliding-window",
            title: "3 · Sliding Window",
            summary: "A moving window over a contiguous range — the go-to for 'longest / shortest / max' subarray and substring problems.",
            minutes: 9,
            tags: ["array", "string", "sliding-window"],
            blocks: [
              { t: "p", html: "The <strong>Sliding Window</strong> pattern maintains a contiguous range <code class='tok'>[L, R]</code> and slides it across the data, expanding <code class='tok'>R</code> to include new elements and contracting <code class='tok'>L</code> when a constraint breaks. Each element enters and leaves the window at most once → <strong>O(n)</strong>." },
              { t: "cue", html: "<b>Recognize it when</b> you see <em>“contiguous subarray / substring”</em> plus a superlative — <em>longest, shortest, maximum, minimum, at most K, exactly K</em>. <strong>Fixed window</strong> when the size is given; <strong>variable window</strong> when you grow/shrink to satisfy a condition." },
              { t: "widget", id: "slidingwindow" },
              { t: "code", lang: "python", code:
                "# Fixed window of size k — maximum sum\n" +
                "def max_sum_k(a, k):\n" +
                "    s = sum(a[:k]); best = s\n" +
                "    for r in range(k, len(a)):\n" +
                "        s += a[r] - a[r - k]        # add entering, drop leaving\n" +
                "        best = max(best, s)\n" +
                "    return best\n\n" +
                "# Variable window — longest substring without repeating chars\n" +
                "def longest_unique(s):\n" +
                "    last = {}; L = 0; best = 0\n" +
                "    for R, c in enumerate(s):\n" +
                "        if c in last and last[c] >= L:\n" +
                "            L = last[c] + 1          # shrink past the duplicate\n" +
                "        last[c] = R\n" +
                "        best = max(best, R - L + 1)\n" +
                "    return best"
              },
              { t: "h", text: "Most-asked interview questions" },
              ask([
                "Longest Substring Without Repeating Characters", "Minimum Window Substring", "Maximum Average Subarray I",
                "Longest Repeating Character Replacement", "Permutation in String", "Fruit Into Baskets", "Sliding Window Maximum (with a deque)"
              ]),
              { t: "note", variant: "trap", html: "Decide <em>when</em> to shrink. For “at most K distinct”, expand always and shrink while the window is invalid. A neat trick: <strong>“exactly K” = atMost(K) − atMost(K−1)</strong> — two cheap sliding windows instead of one tricky one." },
              { t: "quiz", id: "pat-arrays" }
            ]
          }
        ]
      },

      /* ===================== LINKED LIST ===================== */
      {
        id: "linkedlist",
        name: "Linked List Patterns",
        icon: "share",
        lessons: [
          {
            id: "fast-slow",
            title: "4 · Fast & Slow Pointers",
            summary: "Two pointers at different speeds — detect cycles, find the middle, or the nth-from-end, in O(1) space.",
            minutes: 7,
            tags: ["linked-list", "two-pointers"],
            blocks: [
              { t: "p", html: "The <strong>Fast &amp; Slow Pointers</strong> pattern (Floyd's tortoise &amp; hare) advances one pointer two steps for every one step of the other. If a list has a cycle, the fast pointer eventually laps the slow one and they meet; if it reaches the end, there's no cycle. It also pinpoints the <em>middle</em> in a single pass." },
              { t: "cue", html: "<b>Recognize it when</b> a problem mentions a <em>cycle / loop</em>, the <em>middle</em> of a list, the <em>nth node from the end</em>, or a <em>“happy number”</em>-style sequence that may repeat — and asks for <strong>O(1) extra space</strong>." },
              { t: "widget", id: "fastslow" },
              { t: "code", lang: "python", code:
                "# Detect a cycle — they meet inside the loop\n" +
                "def has_cycle(head):\n" +
                "    slow = fast = head\n" +
                "    while fast and fast.next:\n" +
                "        slow = slow.next          # 1 step\n" +
                "        fast = fast.next.next      # 2 steps\n" +
                "        if slow is fast:\n" +
                "            return True\n" +
                "    return False\n\n" +
                "# Middle of the list (slow lands at the middle when fast hits the end)\n" +
                "def middle(head):\n" +
                "    slow = fast = head\n" +
                "    while fast and fast.next:\n" +
                "        slow = slow.next\n" +
                "        fast = fast.next.next\n" +
                "    return slow"
              },
              { t: "h", text: "Most-asked interview questions" },
              ask([
                "Linked List Cycle", "Linked List Cycle II (find the start)", "Middle of the Linked List",
                "Happy Number", "Find the Duplicate Number", "Palindrome Linked List", "Remove Nth Node From End of List"
              ]),
              { t: "note", variant: "key", html: "To find the <strong>start</strong> of the cycle (Cycle II): after the meeting point, reset one pointer to the head and advance both one step at a time — they meet exactly at the cycle's entrance. (It falls out of the algebra of the meeting distance.)" }
            ]
          },
          {
            id: "reversal",
            title: "5 · In-place Linked List Reversal",
            summary: "Re-point each node's arrow backwards with three pointers — reverse all or part of a list in one O(1)-space pass.",
            minutes: 7,
            tags: ["linked-list", "pointers"],
            blocks: [
              { t: "p", html: "The <strong>In-place Reversal</strong> pattern walks a list once, flipping each <code class='tok'>next</code> pointer to point at the previous node. Three pointers — <code class='tok'>prev</code>, <code class='tok'>cur</code>, <code class='tok'>next</code> — are all you need, and you mutate the existing nodes rather than allocating a new list." },
              { t: "cue", html: "<b>Recognize it when</b> you must <em>reverse</em> a list or a <em>sub-list</em>, <em>swap nodes in pairs</em>, reverse in <em>k-groups</em>, or reorder nodes <strong>without extra memory</strong>. The three-pointer dance is the reusable core." },
              { t: "widget", id: "listreversal" },
              { t: "code", lang: "python", code:
                "# Reverse an entire list — memorize this dance\n" +
                "def reverse(head):\n" +
                "    prev = None\n" +
                "    cur = head\n" +
                "    while cur:\n" +
                "        nxt = cur.next        # 1. remember the rest\n" +
                "        cur.next = prev       # 2. flip the arrow\n" +
                "        prev = cur            # 3. advance prev\n" +
                "        cur = nxt             # 4. advance cur\n" +
                "    return prev               # new head\n\n" +
                "# Reverse only [left, right] — use a dummy + reversal in place\n" +
                "def reverse_between(head, left, right):\n" +
                "    dummy = ListNode(0, head); p = dummy\n" +
                "    for _ in range(left - 1): p = p.next   # node before window\n" +
                "    cur = p.next\n" +
                "    for _ in range(right - left):           # front-insertion\n" +
                "        nxt = cur.next\n" +
                "        cur.next = nxt.next\n" +
                "        nxt.next = p.next\n" +
                "        p.next = nxt\n" +
                "    return dummy.next"
              },
              { t: "h", text: "Most-asked interview questions" },
              ask([
                "Reverse Linked List", "Reverse Linked List II", "Swap Nodes in Pairs",
                "Reverse Nodes in k-Group", "Rotate List", "Reorder List", "Palindrome Linked List"
              ]),
              { t: "note", variant: "trap", html: "Don't lose the rest of the list: capture <code class='tok'>cur.next</code> <em>before</em> you overwrite it. A <strong>dummy head</strong> node removes the special-casing when the reversal touches the original head." },
              { t: "quiz", id: "pat-linkedlist" }
            ]
          }
        ]
      },

      /* ===================== STACKS & HEAPS ===================== */
      {
        id: "stack-heap",
        name: "Stacks & Heaps",
        icon: "queue",
        lessons: [
          {
            id: "monotonic-stack",
            title: "6 · Monotonic Stack",
            summary: "A stack kept in sorted order to find the next greater / smaller element for every item in O(n).",
            minutes: 8,
            tags: ["stack", "monotonic"],
            blocks: [
              { t: "p", html: "A <strong>Monotonic Stack</strong> keeps its elements in increasing or decreasing order as you scan. When a new element would break the order, you <em>pop</em> — and each popped element has just found its “next greater” (or smaller) neighbour. Every item is pushed and popped at most once, so the whole scan is <strong>O(n)</strong>." },
              { t: "cue", html: "<b>Recognize it when</b> you need the <em>next/previous greater or smaller element</em>, are spanning bars in a <em>histogram</em>, computing <em>stock spans</em>, or trapping water. The tell: a brute force that, for each element, scans left or right for the first bigger/smaller value." },
              { t: "widget", id: "monotonicstack" },
              { t: "code", lang: "python", code:
                "# Next greater element to the right (-1 if none)\n" +
                "def next_greater(nums):\n" +
                "    res = [-1] * len(nums)\n" +
                "    stack = []                       # holds indices; values DECREASING\n" +
                "    for i, x in enumerate(nums):\n" +
                "        while stack and nums[stack[-1]] < x:\n" +
                "            res[stack.pop()] = x      # x is the answer for that index\n" +
                "        stack.append(i)\n" +
                "    return res"
              },
              { t: "h", text: "Most-asked interview questions" },
              ask([
                "Next Greater Element I / II", "Daily Temperatures", "Largest Rectangle in Histogram",
                "Trapping Rain Water", "Remove K Digits", "Sum of Subarray Minimums", "Online Stock Span"
              ]),
              { t: "note", variant: "key", html: "Pick the direction deliberately: a <strong>decreasing</strong> stack finds the next <em>greater</em> element; an <strong>increasing</strong> stack finds the next <em>smaller</em>. Storing <em>indices</em> (not values) lets you also compute distances/widths." }
            ]
          },
          {
            id: "top-k",
            title: "7 · Top-K Elements (Heap)",
            summary: "A size-K heap to surface the K largest / smallest / most-frequent without sorting everything.",
            minutes: 8,
            tags: ["heap", "priority-queue", "top-k"],
            blocks: [
              { t: "p", html: "The <strong>Top-K Elements</strong> pattern keeps a <strong>heap of size K</strong> while scanning. For the K <em>largest</em>, use a <em>min</em>-heap and pop the smallest whenever it overflows; what remains is your answer. Cost is <strong>O(n log K)</strong> and space <strong>O(K)</strong> — better than sorting all n when K ≪ n." },
              { t: "cue", html: "<b>Recognize it when</b> you see <em>“K largest / smallest / closest / most frequent”</em>, a streaming median, or “merge K sorted …”. The words <em>top K</em> or <em>Kth</em> are the giveaway — reach for a priority queue." },
              { t: "widget", id: "heap" },
              { t: "code", lang: "python", code:
                "import heapq\n\n" +
                "# K largest with a MIN-heap of size k\n" +
                "def k_largest(nums, k):\n" +
                "    heap = []\n" +
                "    for x in nums:\n" +
                "        heapq.heappush(heap, x)\n" +
                "        if len(heap) > k:\n" +
                "            heapq.heappop(heap)       # drop the smallest so far\n" +
                "    return heap                       # the k largest, unordered\n\n" +
                "# Top-K frequent — count, then heap by frequency\n" +
                "def top_k_frequent(nums, k):\n" +
                "    from collections import Counter\n" +
                "    freq = Counter(nums)\n" +
                "    return heapq.nlargest(k, freq, key=freq.get)"
              },
              { t: "h", text: "Most-asked interview questions" },
              ask([
                "Kth Largest Element in an Array", "Top K Frequent Elements", "K Closest Points to Origin",
                "Find K Pairs with Smallest Sums", "Merge k Sorted Lists", "Task Scheduler", "Find Median from Data Stream (two heaps)"
              ]),
              { t: "note", variant: "key", html: "For a <strong>running median</strong>, use the <em>Two Heaps</em> variant: a max-heap for the lower half and a min-heap for the upper half, kept balanced. The median is a heap top (or the average of the two)." },
              { t: "quiz", id: "pat-stackheap" }
            ]
          }
        ]
      },

      /* ===================== INTERVALS & SEARCH ===================== */
      {
        id: "search",
        name: "Intervals & Search",
        icon: "compass",
        lessons: [
          {
            id: "merge-intervals",
            title: "8 · Overlapping Intervals",
            summary: "Sort by start, then sweep and merge — the backbone of calendar, meeting-room and range problems.",
            minutes: 7,
            tags: ["intervals", "sorting"],
            blocks: [
              { t: "p", html: "The <strong>Overlapping Intervals</strong> pattern sorts intervals by start time, then sweeps left to right. If the next interval starts before the current one ends, they overlap — extend the current interval; otherwise, start a new one. The sort dominates at <strong>O(n log n)</strong>." },
              { t: "cue", html: "<b>Recognize it when</b> the input is a set of <em>ranges / intervals / meetings</em> and you must <em>merge</em> them, <em>insert</em> one, count <em>conflicts</em>, or find the minimum resources (rooms, platforms). Almost always: <strong>sort first</strong>." },
              { t: "widget", id: "mergeintervals" },
              { t: "code", lang: "python", code:
                "# Merge all overlapping intervals\n" +
                "def merge(intervals):\n" +
                "    intervals.sort(key=lambda iv: iv[0])   # by start time\n" +
                "    out = [intervals[0][:]]\n" +
                "    for s, e in intervals[1:]:\n" +
                "        if s <= out[-1][1]:                 # overlaps current\n" +
                "            out[-1][1] = max(out[-1][1], e) # extend the end\n" +
                "        else:\n" +
                "            out.append([s, e])              # disjoint -> new\n" +
                "    return out"
              },
              { t: "h", text: "Most-asked interview questions" },
              ask([
                "Merge Intervals", "Insert Interval", "Non-overlapping Intervals",
                "Meeting Rooms / Meeting Rooms II", "Interval List Intersections", "Employee Free Time", "Minimum Number of Arrows to Burst Balloons"
              ]),
              { t: "note", variant: "tip", html: "For <em>“minimum meeting rooms”</em>, a <strong>min-heap of end times</strong> (or a sorted sweep of +1/−1 events) counts the peak overlap. Many interval problems reduce to a <em>sweep line</em> over sorted start/end events." }
            ]
          },
          {
            id: "binary-search",
            title: "9 · Modified Binary Search",
            summary: "Halve the search space — not just in sorted arrays, but over any monotonic answer space.",
            minutes: 9,
            tags: ["binary-search", "search-space"],
            blocks: [
              { t: "p", html: "<strong>Binary Search</strong> repeatedly halves a range, discarding the half that can't contain the answer — <strong>O(log n)</strong>. The interview superpower is <em>“binary search on the answer”</em>: if you can cheaply test <em>“is value X feasible?”</em> and feasibility is monotonic, you can binary-search the smallest/largest feasible X even when there's no sorted array in sight." },
              { t: "cue", html: "<b>Recognize it when</b> the array is <em>sorted</em> or <em>rotated</em>, or the problem asks to <em>minimize the maximum</em> / <em>maximize the minimum</em> / find the <em>smallest value that works</em> (“Koko eating bananas”, “ship within D days”). Monotonic predicate ⇒ binary search." },
              { t: "widget", id: "binarysearch" },
              { t: "code", lang: "python", code:
                "# Classic search (inclusive bounds)\n" +
                "def search(a, target):\n" +
                "    lo, hi = 0, len(a) - 1\n" +
                "    while lo <= hi:\n" +
                "        mid = (lo + hi) // 2\n" +
                "        if a[mid] == target: return mid\n" +
                "        if a[mid] < target:  lo = mid + 1\n" +
                "        else:                hi = mid - 1\n" +
                "    return -1\n\n" +
                "# The generalizable form: leftmost index where pred() is True\n" +
                "def lower_bound(lo, hi, pred):       # pred is monotonic F..F,T..T\n" +
                "    while lo < hi:                    # half-open [lo, hi)\n" +
                "        mid = (lo + hi) // 2\n" +
                "        if pred(mid): hi = mid\n" +
                "        else:         lo = mid + 1\n" +
                "    return lo"
              },
              { t: "h", text: "Most-asked interview questions" },
              ask([
                "Binary Search", "Search in Rotated Sorted Array", "Find Minimum in Rotated Sorted Array",
                "Find First and Last Position of Element", "Koko Eating Bananas", "Capacity to Ship Packages Within D Days", "Median of Two Sorted Arrays"
              ]),
              { t: "note", variant: "trap", html: "Pick one invariant and never break it. With inclusive <code class='tok'>[lo, hi]</code> loop while <code class='tok'>lo &lt;= hi</code> and move bounds <em>past</em> mid (<code class='tok'>mid±1</code>). Mixing inclusive and half-open bounds is where infinite loops and off-by-ones are born." },
              { t: "quiz", id: "pat-search" }
            ]
          }
        ]
      },

      /* ===================== TREES & GRAPHS ===================== */
      {
        id: "trees-graphs",
        name: "Trees & Graphs",
        icon: "blocks",
        lessons: [
          {
            id: "tree-traversal",
            title: "10 · Binary Tree Traversal",
            summary: "Pre / In / Post order are one DFS with the visit in a different spot; level-order is BFS with a queue.",
            minutes: 8,
            tags: ["tree", "dfs", "bfs"],
            blocks: [
              { t: "p", html: "The <strong>Tree Traversal</strong> pattern is the foundation for everything tree-shaped. The three depth-first orders differ <em>only</em> in <strong>when</strong> you process the node relative to its children: <em>pre</em> (before), <em>in</em> (between — sorted order for a BST), <em>post</em> (after — needed when children must be solved first). <strong>Level-order</strong> is breadth-first with a queue." },
              { t: "cue", html: "<b>Recognize it when</b> the input is a <em>binary tree</em> and you need every node, a depth/height, a path, the BST's sorted values (inorder), to build results from children up (postorder), or a level-by-level result (BFS)." },
              { t: "widget", id: "treetraversal" },
              { t: "code", lang: "python", code:
                "# DFS variants differ only in WHERE 'visit' sits\n" +
                "def inorder(node, out):\n" +
                "    if not node: return\n" +
                "    inorder(node.left, out)\n" +
                "    out.append(node.val)         # visit BETWEEN children (BST -> sorted)\n" +
                "    inorder(node.right, out)\n\n" +
                "# Level-order = BFS with a queue\n" +
                "from collections import deque\n" +
                "def level_order(root):\n" +
                "    out, q = [], deque([root] if root else [])\n" +
                "    while q:\n" +
                "        level = []\n" +
                "        for _ in range(len(q)):   # one whole level per iteration\n" +
                "            n = q.popleft(); level.append(n.val)\n" +
                "            if n.left:  q.append(n.left)\n" +
                "            if n.right: q.append(n.right)\n" +
                "        out.append(level)\n" +
                "    return out"
              },
              { t: "h", text: "Most-asked interview questions" },
              ask([
                "Binary Tree Inorder / Preorder / Postorder Traversal", "Binary Tree Level Order Traversal", "Binary Tree Zigzag Level Order",
                "Binary Tree Right Side View", "Maximum Depth of Binary Tree", "Validate Binary Search Tree", "Lowest Common Ancestor"
              ]),
              { t: "note", variant: "key", html: "<strong>Inorder of a BST is sorted</strong> — a huge interview shortcut for validation and Kth-smallest. When a node's answer depends on its children's answers (heights, sums, balance), you need <strong>postorder</strong>." }
            ]
          },
          {
            id: "dfs",
            title: "11 · Depth-First Search (DFS)",
            summary: "Go deep first — exhaustive exploration, connectivity, path-finding and cycle detection on trees and graphs.",
            minutes: 8,
            tags: ["graph", "dfs", "recursion"],
            blocks: [
              { t: "p", html: "<strong>DFS</strong> plunges as deep as possible before backtracking, using the call stack (or an explicit stack). On graphs it visits each vertex and edge once — <strong>O(V + E)</strong> — and a <code class='tok'>visited</code> set stops it from looping forever. It's the natural fit for <em>“explore everything reachable.”</em>" },
              { t: "cue", html: "<b>Recognize it when</b> you must explore <em>all</em> nodes/paths, find <em>connected components</em>, detect <em>cycles</em>, do <em>topological sort</em>, or answer reachability. If the problem is about going as far as you can down each branch, it's DFS." },
              { t: "widget", id: "graphtraversal" },
              { t: "code", lang: "python", code:
                "# Recursive DFS over a graph\n" +
                "def dfs(node, graph, visited):\n" +
                "    visited.add(node)\n" +
                "    for nxt in graph[node]:\n" +
                "        if nxt not in visited:\n" +
                "            dfs(nxt, graph, visited)\n\n" +
                "# Count connected components\n" +
                "def components(n, graph):\n" +
                "    seen, count = set(), 0\n" +
                "    for s in range(n):\n" +
                "        if s not in seen:\n" +
                "            count += 1\n" +
                "            dfs(s, graph, seen)   # one sweep = one component\n" +
                "    return count"
              },
              { t: "h", text: "Most-asked interview questions" },
              ask([
                "Number of Islands", "Clone Graph", "Course Schedule (cycle / topo-sort)",
                "Path Sum", "Max Area of Island", "Pacific Atlantic Water Flow", "Word Search"
              ]),
              { t: "note", variant: "trap", html: "On graphs (unlike trees) you <strong>must</strong> track <code class='tok'>visited</code> or you'll loop forever on a cycle. Watch recursion depth too — a very deep or skewed graph can overflow the call stack; convert to an explicit stack if needed." }
            ]
          },
          {
            id: "bfs",
            title: "12 · Breadth-First Search (BFS)",
            summary: "Explore in rings with a queue — the right tool for shortest paths on unweighted graphs and grids.",
            minutes: 8,
            tags: ["graph", "bfs", "shortest-path"],
            blocks: [
              { t: "p", html: "<strong>BFS</strong> explores level by level using a FIFO <strong>queue</strong>, visiting all nodes one edge away, then two, and so on — <strong>O(V + E)</strong>. Because it reaches nodes in order of distance, the first time it touches a node is along a <em>shortest path</em> (in edges)." },
              { t: "cue", html: "<b>Recognize it when</b> the question asks for the <em>shortest path / fewest steps / minimum moves</em> on an <em>unweighted</em> graph or grid, a <em>level-order</em> result, or “spread / rot / infect” simulations that advance one ring per step (multi-source BFS)." },
              { t: "widget", id: "graphtraversal" },
              { t: "code", lang: "python", code:
                "from collections import deque\n\n" +
                "# Shortest path (in edges) from a single source\n" +
                "def bfs(start, graph):\n" +
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
              { t: "h", text: "Most-asked interview questions" },
              ask([
                "Binary Tree Level Order Traversal", "Rotting Oranges (multi-source)", "Word Ladder",
                "Shortest Path in Binary Matrix", "01 Matrix", "Open the Lock", "Snakes and Ladders"
              ]),
              { t: "note", variant: "key", html: "<strong>BFS, not Dijkstra, is the tool for unweighted shortest paths.</strong> For grids, push all sources first for <em>multi-source BFS</em> (rotting oranges). Mark nodes visited <em>when you enqueue</em> them, not when you dequeue, to avoid adding duplicates." }
            ]
          },
          {
            id: "matrix",
            title: "13 · Matrix Traversal",
            summary: "Treat a grid as a graph — flood fill, islands and region problems via DFS/BFS over 4-directional neighbours.",
            minutes: 7,
            tags: ["matrix", "grid", "flood-fill"],
            blocks: [
              { t: "p", html: "The <strong>Matrix Traversal</strong> pattern recognizes that a 2-D grid <em>is</em> a graph: each cell is a node connected to its 4 (or 8) neighbours. Island, region and flood-fill problems are just DFS/BFS where you mark cells visited as you go — <strong>O(rows × cols)</strong>." },
              { t: "cue", html: "<b>Recognize it when</b> the input is a <em>grid / matrix / board</em> and you must count <em>islands / regions</em>, <em>flood-fill</em> a color, find <em>enclosed</em> areas, or compute shortest distance across cells (then it's BFS)." },
              { t: "widget", id: "matrixtraversal" },
              { t: "code", lang: "python", code:
                "# Number of islands via DFS flood fill\n" +
                "def num_islands(grid):\n" +
                "    R, C = len(grid), len(grid[0])\n" +
                "    def sink(r, c):\n" +
                "        if r < 0 or c < 0 or r >= R or c >= C or grid[r][c] != '1':\n" +
                "            return\n" +
                "        grid[r][c] = '0'                       # mark visited\n" +
                "        sink(r+1, c); sink(r-1, c)\n" +
                "        sink(r, c+1); sink(r, c-1)             # 4-directional\n" +
                "    count = 0\n" +
                "    for r in range(R):\n" +
                "        for c in range(C):\n" +
                "            if grid[r][c] == '1':\n" +
                "                count += 1; sink(r, c)         # one island\n" +
                "    return count"
              },
              { t: "h", text: "Most-asked interview questions" },
              ask([
                "Number of Islands", "Flood Fill", "Surrounded Regions", "Max Area of Island",
                "Walls and Gates", "Rotting Oranges", "Word Search", "Spiral Matrix"
              ]),
              { t: "note", variant: "tip", html: "Keep a single <code class='tok'>directions = [(1,0),(-1,0),(0,1),(0,-1)]</code> list and loop it instead of writing four calls — it generalizes to 8 directions and keeps bounds-checking in one place. Mutating the grid to mark visited saves a separate <code class='tok'>seen</code> set." },
              { t: "quiz", id: "pat-treesgraphs" }
            ]
          }
        ]
      },

      /* ===================== RECURSION & DP ===================== */
      {
        id: "recursion-dp",
        name: "Recursion & DP",
        icon: "cube",
        lessons: [
          {
            id: "backtracking",
            title: "14 · Backtracking",
            summary: "Choose, explore, un-choose — the systematic search behind subsets, permutations, N-Queens and Sudoku.",
            minutes: 9,
            tags: ["backtracking", "recursion"],
            blocks: [
              { t: "p", html: "<strong>Backtracking</strong> builds a candidate solution one decision at a time and abandons a branch (“backtracks”) the moment it can't lead to a valid answer. It's a DFS over the tree of partial solutions, with <em>pruning</em> — and almost every variant is the same three-line rhythm." },
              { t: "cue", html: "<b>Recognize it when</b> the problem asks for <em>all</em> combinations / permutations / subsets / partitions, or to place items under constraints (N-Queens, Sudoku, word search). Words like <em>“all possible”</em>, <em>“generate every”</em>, or <em>“find a valid arrangement”</em> scream backtracking." },
              { t: "widget", id: "backtracking" },
              { t: "code", lang: "python", code:
                "# Universal template: choose -> explore -> un-choose\n" +
                "def subsets(nums):\n" +
                "    res = []\n" +
                "    def backtrack(start, path):\n" +
                "        res.append(path[:])               # every node is a subset\n" +
                "        for i in range(start, len(nums)):\n" +
                "            path.append(nums[i])          # 1. choose\n" +
                "            backtrack(i + 1, path)        # 2. explore\n" +
                "            path.pop()                    # 3. un-choose (backtrack)\n" +
                "    backtrack(0, [])\n" +
                "    return res"
              },
              { t: "h", text: "Most-asked interview questions" },
              ask([
                "Subsets / Subsets II", "Permutations / Permutations II", "Combinations", "Combination Sum",
                "Palindrome Partitioning", "Word Search", "N-Queens", "Generate Parentheses", "Sudoku Solver"
              ]),
              { t: "note", variant: "trap", html: "Always undo your choice on the way back up — forgetting the <code class='tok'>path.pop()</code> leaks state into sibling branches and produces garbage. Prune early (a good validity check) to cut whole subtrees; backtracking is exponential without it." }
            ]
          },
          {
            id: "dynamic-programming",
            title: "15 · Dynamic Programming",
            summary: "Break a problem into overlapping subproblems and remember the answers — memoization and tabulation.",
            minutes: 10,
            tags: ["dp", "memoization", "tabulation"],
            blocks: [
              { t: "p", html: "<strong>Dynamic Programming</strong> applies when a problem has <em>overlapping subproblems</em> and <em>optimal substructure</em>: the answer is built from answers to smaller versions of the same problem, and those smaller answers repeat. DP computes each subproblem <strong>once</strong> and reuses it — <em>top-down</em> with memoization, or <em>bottom-up</em> with a table." },
              { t: "cue", html: "<b>Recognize it when</b> you see <em>“count the number of ways”</em>, <em>“minimum / maximum cost”</em>, <em>“longest / shortest …”</em> over choices, or a brute-force recursion that recomputes the same inputs. Define the <strong>state</strong>, the <strong>transition</strong>, and the <strong>base case</strong> — that's the whole game." },
              { t: "widget", id: "dptable" },
              { t: "code", lang: "python", code:
                "# Top-down: recursion + memo (climbing stairs)\n" +
                "from functools import lru_cache\n" +
                "@lru_cache(None)\n" +
                "def climb(n):\n" +
                "    if n <= 2: return n\n" +
                "    return climb(n - 1) + climb(n - 2)    # reuse cached subproblems\n\n" +
                "# Bottom-up: tabulation, O(1) space (coin change -> min coins)\n" +
                "def coin_change(coins, amount):\n" +
                "    INF = amount + 1\n" +
                "    dp = [0] + [INF] * amount             # dp[x] = min coins for x\n" +
                "    for x in range(1, amount + 1):\n" +
                "        for c in coins:\n" +
                "            if c <= x:\n" +
                "                dp[x] = min(dp[x], dp[x - c] + 1)\n" +
                "    return dp[amount] if dp[amount] < INF else -1"
              },
              { t: "h", text: "Most-asked interview questions" },
              ask([
                "Climbing Stairs", "House Robber", "Coin Change", "Longest Increasing Subsequence",
                "Longest Common Subsequence", "Edit Distance", "Unique Paths", "0/1 Knapsack / Partition Equal Subset Sum", "Word Break"
              ]),
              { t: "note", variant: "key", html: "Most DP problems are a variation of a few archetypes: <strong>0/1 knapsack</strong>, <strong>unbounded knapsack</strong>, <strong>LCS / edit distance</strong> (two sequences), <strong>LIS</strong>, <strong>grid paths</strong>, and <strong>interval / partition DP</strong>. Recognize the archetype and the transition usually follows." }
            ]
          },
          {
            id: "bit-manipulation",
            title: "16 · Bit Manipulation",
            summary: "Work directly on bits for O(1) tricks — XOR to cancel duplicates, masks for subsets, and space-free flags.",
            minutes: 7,
            tags: ["bits", "xor"],
            blocks: [
              { t: "p", html: "The <strong>Bit Manipulation</strong> pattern operates on the binary representation of numbers. A handful of identities solve a surprising range of problems in <strong>O(1)</strong> space — most famously <strong>XOR</strong>, which cancels equal values (<code class='tok'>x ^ x = 0</code>) and so isolates the odd one out." },
              { t: "cue", html: "<b>Recognize it when</b> a problem involves <em>pairs that cancel</em>, <em>counting set bits</em>, <em>flags / on-off state</em>, generating <em>subsets via bitmasks</em>, or demands <em>no extra space</em>. Also: any “do it without +/−” or “find the unique number” prompt." },
              { t: "widget", id: "bitwise" },
              { t: "code", lang: "python", code:
                "x & 1          # is x odd?\n" +
                "x >> 1         # divide by 2\n" +
                "x & (x - 1)    # drop the lowest set bit (count bits with this)\n" +
                "x & -x         # isolate the lowest set bit\n" +
                "x | (1 << i)   # set bit i      x & ~(1 << i)  # clear bit i\n\n" +
                "# Single Number — XOR cancels every pair, leaving the loner\n" +
                "def single_number(nums):\n" +
                "    r = 0\n" +
                "    for x in nums:\n" +
                "        r ^= x        # a ^ a = 0,  a ^ 0 = a\n" +
                "    return r\n\n" +
                "# Enumerate all subsets of n items with bitmasks\n" +
                "def subsets(items):\n" +
                "    n = len(items)\n" +
                "    return [[items[i] for i in range(n) if mask >> i & 1]\n" +
                "            for mask in range(1 << n)]"
              },
              { t: "h", text: "Most-asked interview questions" },
              ask([
                "Single Number I / II / III", "Number of 1 Bits", "Counting Bits", "Reverse Bits",
                "Sum of Two Integers (no + / −)", "Missing Number", "Subsets (bitmask)", "Power of Two"
              ]),
              { t: "note", variant: "key", html: "<strong>XOR is the interview workhorse.</strong> It finds the single non-duplicated element, swaps without a temp, and detects differences. <code class='tok'>x &amp; (x-1)</code> clearing the lowest set bit is the trick behind fast bit-counting (Brian Kernighan's algorithm)." },
              { t: "quiz", id: "pat-recursiondp" }
            ]
          }
        ]
      },

      /* ===================== MASTERY ===================== */
      {
        id: "mastery",
        name: "Pattern Mastery",
        icon: "map",
        lessons: [
          {
            id: "choose-pattern",
            title: "Pick the right pattern, fast",
            summary: "A signal → pattern decision table, the interview workflow, and a focused practice plan.",
            minutes: 8,
            tags: ["strategy", "interview", "resources"],
            blocks: [
              { t: "p", html: "You don't need 500+ problems — you need the <strong>right pattern → right template → right focus</strong>. The skill that separates strong candidates is <em>recognition</em>: reading a fresh problem and, within a minute, naming the pattern it belongs to. This table is your cheat sheet." },
              {
                t: "table",
                headers: ["When you see…", "Reach for…"],
                rows: [
                  ["Sorted array; find a pair / triplet / partition", "Two Pointers"],
                  ["Contiguous subarray/substring + 'longest / shortest / max / at most K'", "Sliding Window"],
                  ["Many range-sum queries, or 'subarray sums to K'", "Prefix Sum (+ hash map)"],
                  ["Cycle, middle, or nth-from-end of a linked list", "Fast &amp; Slow Pointers"],
                  ["Reverse all or part of a linked list", "In-place Reversal"],
                  ["Next greater / smaller element; histogram spans", "Monotonic Stack"],
                  ["'K largest / smallest / closest / most frequent'", "Heap (Top-K)"],
                  ["Overlapping ranges, meetings, calendars", "Merge Intervals"],
                  ["Sorted / rotated array, or 'minimize the max'", "Modified Binary Search"],
                  ["Anything with a binary tree", "Tree Traversal (DFS / BFS)"],
                  ["Reach all nodes; components; cycles; topo-sort", "DFS"],
                  ["Fewest steps / shortest path on an unweighted graph or grid", "BFS"],
                  ["Grid of islands / regions / flood fill", "Matrix Traversal"],
                  ["'All' combinations / permutations / subsets / arrangements", "Backtracking"],
                  ["'Count the ways' / 'min-max cost' with overlapping subproblems", "Dynamic Programming"],
                  ["Pairs cancel, flags, subsets, or 'no extra space'", "Bit Manipulation"]
                ]
              },
              { t: "h", text: "The interview workflow" },
              {
                t: "ol", items: [
                  "<strong>Clarify</strong> — restate the problem, confirm input ranges and edge cases.",
                  "<strong>Classify</strong> — match the signals above to a pattern; say it out loud.",
                  "<strong>Template</strong> — start from the pattern's skeleton, then specialize it.",
                  "<strong>Dry-run</strong> — trace a small example to catch off-by-ones before coding.",
                  "<strong>Analyze</strong> — state time & space, and note where the bottleneck moved."
                ]
              },
              { t: "note", variant: "key", html: "Patterns aren't just techniques — they're <strong>shortcuts</strong>. They help you understand what the question really wants, pick an approach quickly, and skip brute-force guesswork. Master the right patterns in the right order and a few hundred problems cover the whole interview surface." },
              { t: "h", text: "A focused practice plan" },
              { t: "p", html: "You don't need 500+ random problems. The winning formula is <strong>right patterns → right order → right focus</strong>: concise notes per topic, the most-asked questions for each, and the recognition reflex to map a new problem to a pattern fast." },
              { t: "ol", items: [
                "<strong>Learn one pattern at a time, in order.</strong> Work through this track top to bottom — each lesson gives you the recognition cue, the template, and the canonical questions.",
                "<strong>Do 5–10 representative problems per pattern</strong>, not 50. Use the 'most-asked' lists in each lesson — they are deliberately the highest-signal ones.",
                "<strong>After each problem, name the pattern out loud</strong> and write its template from memory. Recognition + recall is the whole skill.",
                "<strong>Revisit the decision table above weekly.</strong> Cover the right column and, for each signal, recall the pattern — that mapping is what an interview actually tests.",
                "<strong>Mix patterns once each is solid.</strong> Real problems blend two (binary search + greedy, BFS + hashing); practise spotting the <em>primary</em> pattern first."
              ] },
              { t: "note", variant: "tip", html: "Quality over quantity. Ten problems you can re-derive from the template beat a hundred you memorized and forgot. The 16 patterns in this track cover the overwhelming majority of array, string, linked-list, tree, graph, and DP questions asked in coding interviews." },
              { t: "quiz", id: "pat-mastery" }
            ]
          }
        ]
      }
    ]
  };
})();

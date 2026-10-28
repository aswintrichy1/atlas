/* =====================================================================
   CODEX · Quiz bank
   Filtered for this split app. Answers hand-verified in source.

   Merge, never reassign: the track-*.js files contribute to the same
   namespace, so a plain assignment here would drop their entries whenever
   this file is evaluated after them.
   ===================================================================== */
window.QUIZZES = Object.assign(window.QUIZZES || {}, {
  "dsa-foundations": {
    "title": "Foundations checkpoint",
    "sub": "Arrays, Big-O, and hashing.",
    "questions": [
      {
        "q": "What makes indexing an array, a[i], an O(1) operation?",
        "options": [
          "The array must be sorted first",
          "A hash function maps i to a slot",
          "Elements sit in contiguous memory, so the address is base + i × size",
          "Binary search locates it"
        ],
        "answer": 2,
        "explain": "Because slots are contiguous and equal-sized, the address of element i is a single multiply-and-add: base + i × size. No scanning, no hashing — just arithmetic."
      },
      {
        "q": "Appending to a dynamic array is 'O(1) amortized'. What does amortized mean here?",
        "options": [
          "Every single append is exactly O(1)",
          "The cost is paid by the garbage collector",
          "It is O(1) only while the array is empty",
          "The average cost over many appends is O(1), even though an occasional resize costs O(n)"
        ],
        "answer": 3,
        "explain": "Doubling on resize means across n appends you do at most ~2n copies total, so the average append is O(1) — even though the one append that triggers a resize is O(n)."
      },
      {
        "q": "What are the average and worst-case lookup times for a hash table?",
        "options": [
          "O(1) average, O(n) worst",
          "O(log n) average, O(n) worst",
          "O(1) average, O(1) worst",
          "O(n) average, O(n) worst"
        ],
        "answer": 0,
        "explain": "Hashing gives O(1) on average, but if many keys collide into one bucket (a bad hash or adversarial input) it degrades to O(n)."
      },
      {
        "q": "Which growth rate is the FASTEST (worst) as n gets large?",
        "options": [
          "O(n log n)",
          "O(2ⁿ)",
          "O(n²)",
          "O(log n)"
        ],
        "answer": 1,
        "explain": "Exponential O(2ⁿ) explodes far faster than any polynomial. At n = 50 it's already ~10¹⁵ operations — which is why brute-force subset enumeration only works for tiny n."
      }
    ]
  },
  "dsa-linear": {
    "title": "Linear structures checkpoint",
    "sub": "Linked lists, two pointers, and prefix sums.",
    "questions": [
      {
        "q": "Accessing the i-th element of a singly linked list takes…",
        "options": [
          "O(1)",
          "O(log n)",
          "O(n)",
          "O(n²)"
        ],
        "answer": 2,
        "explain": "There's no index arithmetic — you must follow i pointers from the head, so random access is O(n). The trade-off is O(1) insert/delete once you hold a node."
      },
      {
        "q": "Floyd's fast-and-slow pointer technique is used to…",
        "options": [
          "Sort a linked list",
          "Convert a list into an array",
          "Reverse a list in O(1) space without iterating",
          "Detect a cycle in a linked list"
        ],
        "answer": 3,
        "explain": "One pointer hops two steps, the other one step. If there's a cycle they eventually meet; if the fast one hits null, there's no cycle. It also finds the middle of a list."
      },
      {
        "q": "With a prefix-sum array P where P[0]=0, the sum of the inclusive range [l, r] is…",
        "options": [
          "P[r+1] − P[l]",
          "P[r] − P[l]",
          "P[r] − P[l−1]",
          "P[l] − P[r+1]"
        ],
        "answer": 0,
        "explain": "P[i] is the sum of the first i elements, so the sum of indices l..r inclusive is P[r+1] − P[l]. One subtraction, O(1) per query after an O(n) build."
      },
      {
        "q": "The 'converge from both ends' two-pointer pattern requires the array to be…",
        "options": [
          "Empty",
          "Sorted (or otherwise monotonic in the quantity you compare)",
          "A power-of-two length",
          "Free of duplicates"
        ],
        "answer": 1,
        "explain": "It only works when moving a pointer changes the compared quantity monotonically — e.g., on a sorted array moving lo right can only raise the sum and hi left can only lower it."
      }
    ]
  },
  "dsa-sorting": {
    "title": "Sorting checkpoint",
    "sub": "The n log n bound and the linear-time exceptions.",
    "questions": [
      {
        "q": "Why can't any comparison-based sort beat O(n log n) in the worst case?",
        "options": [
          "Memory is limited",
          "Swaps are expensive",
          "A decision tree that distinguishes all n! orderings must be about log(n!) ≈ n log n deep",
          "Recursion has overhead"
        ],
        "answer": 2,
        "explain": "There are n! possible orderings; each comparison is one binary decision. A binary tree with n! leaves needs depth ≥ log₂(n!) ≈ n log n, so some input forces that many comparisons."
      },
      {
        "q": "Which algorithm is BOTH guaranteed O(n log n) worst-case AND stable?",
        "options": [
          "Quicksort",
          "Heapsort",
          "Selection sort",
          "Merge sort"
        ],
        "answer": 3,
        "explain": "Merge sort is always O(n log n) and stable (it costs O(n) extra space). Quicksort can hit O(n²) on bad pivots and isn't stable; heapsort is O(n log n) but not stable."
      },
      {
        "q": "Counting sort runs in O(n + k). What is k?",
        "options": [
          "The range of possible key values",
          "The number of elements",
          "The number of swaps",
          "The recursion depth"
        ],
        "answer": 0,
        "explain": "k is the size of the key range (you allocate a count bucket per possible value). Counting sort wins only when k is comparable to n — sorting values up to a billion would need a billion buckets."
      },
      {
        "q": "A 'stable' sort is one that…",
        "options": [
          "Never crashes",
          "Keeps equal elements in their original relative order",
          "Always uses O(1) memory",
          "Is always the fastest available"
        ],
        "answer": 1,
        "explain": "Stability preserves the input order of equal keys, which lets you sort by one field and then another and have the first ordering survive as a tie-breaker."
      }
    ]
  },
  "dsa-trees": {
    "title": "Heaps & tries checkpoint",
    "sub": "Priority queues, top-k, and prefix trees.",
    "questions": [
      {
        "q": "In an array-backed binary heap, the children of index i are at indices…",
        "options": [
          "i−1 and i+1",
          "2i and 2i+1",
          "2i+1 and 2i+2",
          "i/2 and i/2 + 1"
        ],
        "answer": 2,
        "explain": "With 0-based indexing, node i's children are 2i+1 and 2i+2, and its parent is (i−1)/2. That implicit layout is why a heap needs no pointers."
      },
      {
        "q": "Extracting the minimum from a binary min-heap of n elements costs…",
        "options": [
          "O(1)",
          "O(n log n)",
          "O(n)",
          "O(log n)"
        ],
        "answer": 3,
        "explain": "You read the root in O(1), move the last element to the root, then sift it down — at most the height of the tree, which is O(log n)."
      },
      {
        "q": "To find the k largest of n elements efficiently, keep a…",
        "options": [
          "Min-heap of size k",
          "Max-heap of size n",
          "Sorted array of size n",
          "Stack of size k"
        ],
        "answer": 0,
        "explain": "A size-k min-heap lets you discard the smallest whenever it overflows, giving the k largest in O(n log k) time and O(k) space — better than sorting all n when k ≪ n."
      },
      {
        "q": "What can a trie do that a plain hash set cannot?",
        "options": [
          "Store strings",
          "Answer prefix queries like autocomplete",
          "Answer exact membership in O(L)",
          "Use less memory in every case"
        ],
        "answer": 1,
        "explain": "A hash set answers exact membership in O(L) too, but it can't do prefix queries. In a trie every internal node already represents a prefix, so autocomplete comes for free."
      }
    ]
  },
  "dsa-graphs": {
    "title": "Graphs checkpoint",
    "sub": "BFS, DFS, topological sort, and SCCs.",
    "questions": [
      {
        "q": "Which traversal finds the shortest path (in number of edges) on an UNWEIGHTED graph?",
        "options": [
          "DFS",
          "Topological sort",
          "BFS",
          "Binary search"
        ],
        "answer": 2,
        "explain": "BFS visits vertices in order of distance, so the first time it reaches a vertex is along a shortest path. (For weighted graphs you'd reach for Dijkstra instead.)"
      },
      {
        "q": "BFS uses a ___ ; DFS uses a ___.",
        "options": [
          "stack ; queue",
          "queue ; heap",
          "heap ; queue",
          "queue ; stack"
        ],
        "answer": 3,
        "explain": "BFS uses a FIFO queue to explore level by level; DFS uses a LIFO stack (often the call stack via recursion) to plunge deep before backing up."
      },
      {
        "q": "A topological sort exists only when the graph is…",
        "options": [
          "A directed acyclic graph (DAG)",
          "Undirected",
          "Fully connected",
          "Weighted"
        ],
        "answer": 0,
        "explain": "Topological order requires every edge to point forward, which is impossible if there's a cycle. A back edge to a node still on the recursion stack signals a cycle and no valid ordering."
      },
      {
        "q": "A strongly connected component (SCC) is a maximal set of vertices where…",
        "options": [
          "Every vertex has equal degree",
          "Every vertex can reach every other vertex (in a directed graph)",
          "There are no edges",
          "All edges share one weight"
        ],
        "answer": 1,
        "explain": "Within an SCC every node is reachable from every other. Collapsing each SCC to a point turns any directed graph into a DAG — its condensation."
      },
      {
        "q": "Traversing a graph with V vertices and E edges (BFS or DFS) takes…",
        "options": [
          "O(V)",
          "O(E)",
          "O(V + E)",
          "O(V × E)"
        ],
        "answer": 2,
        "explain": "Each vertex is visited once and each edge is examined once, so both BFS and DFS run in O(V + E) on an adjacency list."
      }
    ]
  },
  "dsa-backtracking": {
    "title": "Backtracking checkpoint",
    "sub": "Systematic trial, error, and pruning.",
    "questions": [
      {
        "q": "The core rhythm of backtracking is…",
        "options": [
          "sort, search, return",
          "hash, probe, resize",
          "divide, conquer, merge",
          "choose, explore, un-choose"
        ],
        "answer": 3,
        "explain": "You make a choice, recurse to explore its consequences, then undo the choice on the way back up so sibling branches start clean."
      },
      {
        "q": "What makes backtracking practical despite an exponential search space?",
        "options": [
          "Pruning doomed branches early with a validity check",
          "Caching results",
          "Running on a GPU",
          "Compiling to machine code"
        ],
        "answer": 0,
        "explain": "A good constraint check (e.g. 'this column/diagonal is already attacked' in N-Queens) cuts off whole subtrees before you waste time exploring them."
      },
      {
        "q": "Forgetting to 'un-choose' (undo a change as you return) causes…",
        "options": [
          "A syntax error",
          "State to leak into sibling branches, producing wrong answers",
          "Faster execution",
          "A guaranteed stack overflow"
        ],
        "answer": 1,
        "explain": "Every change made on the way down must be reverted on the way back up; otherwise partial state from one branch contaminates the others."
      },
      {
        "q": "Which problem is a classic fit for backtracking?",
        "options": [
          "Summing an array",
          "Looking up a hash key",
          "Generating all permutations of a set",
          "Reversing a string"
        ],
        "answer": 2,
        "explain": "Permutations, combinations, subsets, N-Queens, Sudoku and word search all explore a tree of partial solutions — exactly what backtracking with pruning is built for."
      }
    ]
  },
  "pat-arrays": {
    "title": "Array & string patterns",
    "sub": "Prefix sum, two pointers, sliding window.",
    "questions": [
      {
        "q": "A problem asks for the number of subarrays that sum to k. Which pattern fits best?",
        "options": [
          "Sliding window alone",
          "Backtracking",
          "Binary search",
          "Prefix sum + a hash map of prefix frequencies"
        ],
        "answer": 3,
        "explain": "Running prefix sums with a hash map of how often each prefix has occurred counts subarrays summing to k in one O(n) pass. Plain sliding window breaks when the array has negatives."
      },
      {
        "q": "The converging two-pointer technique (one at each end) requires the array to be…",
        "options": [
          "Sorted, or otherwise monotonic in the compared quantity",
          "Empty",
          "A power-of-two length",
          "Free of duplicates"
        ],
        "answer": 0,
        "explain": "It only works when moving a pointer changes the compared value monotonically — e.g., on a sorted array moving lo right can only increase the sum and hi left can only decrease it."
      },
      {
        "q": "'Longest substring without repeating characters' is the signature of which pattern?",
        "options": [
          "Prefix sum",
          "Variable-size sliding window",
          "Monotonic stack",
          "Binary search"
        ],
        "answer": 1,
        "explain": "Grow the window with the right pointer; when a repeat appears, shrink from the left past the duplicate. Each character enters and leaves once → O(n)."
      },
      {
        "q": "Sliding window over a contiguous range runs in what time for n elements?",
        "options": [
          "O(n²)",
          "O(n log n)",
          "O(n)",
          "O(log n)"
        ],
        "answer": 2,
        "explain": "Each element is added once when the right edge passes it and removed at most once when the left edge passes it, so the whole scan is linear."
      }
    ]
  },
  "pat-linkedlist": {
    "title": "Linked list patterns",
    "sub": "Fast & slow pointers and in-place reversal.",
    "questions": [
      {
        "q": "Floyd's fast & slow pointers detect a cycle because…",
        "options": [
          "The fast pointer sorts the list",
          "The slow pointer reverses the list",
          "They count the nodes",
          "If a loop exists, the 2-step pointer eventually laps and meets the 1-step pointer"
        ],
        "answer": 3,
        "explain": "Inside a cycle the fast pointer gains one position per step on the slow one, so it must eventually land on it. If fast reaches null, there's no cycle."
      },
      {
        "q": "To find the middle of a linked list in one pass…",
        "options": [
          "Advance slow by 1 and fast by 2; slow is at the middle when fast reaches the end",
          "Reverse it first",
          "Use a hash map of indices",
          "Sort the nodes"
        ],
        "answer": 0,
        "explain": "When the fast pointer (2×) hits the end, the slow pointer (1×) has covered exactly half the list — the middle. O(n) time, O(1) space."
      },
      {
        "q": "In the three-pointer reversal, what must you do BEFORE setting cur.next = prev?",
        "options": [
          "Delete prev",
          "Save cur.next in a temp so you don't lose the rest of the list",
          "Sort the list",
          "Allocate a new list"
        ],
        "answer": 1,
        "explain": "Overwriting cur.next first would orphan the remaining nodes. Capture nxt = cur.next, then flip the arrow, then advance prev and cur."
      },
      {
        "q": "Why add a dummy head node when reversing a sublist [left, right]?",
        "options": [
          "It speeds up the loop",
          "It saves memory",
          "It removes the special case when the reversal includes the original head",
          "It sorts the list"
        ],
        "answer": 2,
        "explain": "A dummy node before the head means the 'node before the window' always exists, so you don't branch on whether left == 1."
      }
    ]
  },
  "pat-stackheap": {
    "title": "Stack & heap patterns",
    "sub": "Monotonic stack and Top-K with heaps.",
    "questions": [
      {
        "q": "To find the next greater element for every item in O(n), keep a stack whose values are…",
        "options": [
          "Increasing",
          "Sorted ascending then re-sorted",
          "Random",
          "Decreasing (pop when a bigger value arrives)"
        ],
        "answer": 3,
        "explain": "A decreasing stack of indices means each new larger value pops everything smaller — and is their 'next greater element'. Each index is pushed and popped once → O(n)."
      },
      {
        "q": "Why is a monotonic stack O(n) despite the inner while-loop?",
        "options": [
          "Each element is pushed once and popped at most once across the whole scan",
          "The loop never runs",
          "It uses binary search",
          "The array is sorted first"
        ],
        "answer": 0,
        "explain": "Amortized analysis: across the entire scan there are at most n pushes and n pops, so the total work is linear even though one step may pop several items."
      },
      {
        "q": "To get the K largest of n elements efficiently, use a…",
        "options": [
          "Max-heap of size n",
          "Min-heap of size K (pop the smallest when it overflows)",
          "Sorted array of size n",
          "Stack of size K"
        ],
        "answer": 1,
        "explain": "A size-K min-heap keeps the K largest seen so far in O(n log K) time and O(K) space — better than sorting all n when K ≪ n."
      },
      {
        "q": "Which problem signals the 'Two Heaps' variant?",
        "options": [
          "Reverse a list",
          "Detect a cycle",
          "Find the median of a running data stream",
          "Merge intervals"
        ],
        "answer": 2,
        "explain": "A max-heap for the lower half and a min-heap for the upper half, kept balanced, give the running median in O(log n) per insert."
      }
    ]
  },
  "pat-search": {
    "title": "Intervals & search patterns",
    "sub": "Merge intervals and modified binary search.",
    "questions": [
      {
        "q": "The first step of almost every overlapping-intervals problem is to…",
        "options": [
          "Hash the endpoints",
          "Reverse the list",
          "Build a heap of sizes",
          "Sort the intervals by start time"
        ],
        "answer": 3,
        "explain": "Sorting by start lets a single left-to-right sweep decide overlaps: if the next start is ≤ the current end, they overlap and you extend; otherwise start a new interval."
      },
      {
        "q": "'Koko eating bananas' and 'ship packages within D days' are solved by…",
        "options": [
          "Binary search on the answer (a monotonic feasibility predicate)",
          "Sorting",
          "A monotonic stack",
          "Backtracking"
        ],
        "answer": 0,
        "explain": "If you can test 'is speed/capacity X feasible?' and feasibility is monotonic in X, binary-search the smallest feasible X — no sorted array required."
      },
      {
        "q": "With inclusive bounds [lo, hi], the binary-search loop condition and update should be…",
        "options": [
          "while lo \u003c hi; hi = mid",
          "while lo \u003c= hi; move bounds to mid+1 / mid-1",
          "while lo != hi; lo = mid",
          "an infinite loop with break"
        ],
        "answer": 1,
        "explain": "Inclusive bounds pair with lo \u003c= hi and moving a bound strictly past mid (mid+1 / mid-1) so the window always shrinks — preventing infinite loops."
      },
      {
        "q": "Searching a rotated sorted array in O(log n) works because…",
        "options": [
          "It must be re-sorted first",
          "Rotation removes duplicates",
          "At each step at least one half is still sorted, so you can decide which half to discard",
          "Binary search can't be used"
        ],
        "answer": 2,
        "explain": "Comparing mid to the ends tells you which half is sorted; you check whether the target lies in that sorted half and discard the other — still O(log n)."
      }
    ]
  },
  "pat-treesgraphs": {
    "title": "Trees & graphs patterns",
    "sub": "Traversal, DFS, BFS and matrix flood fill.",
    "questions": [
      {
        "q": "An inorder traversal of a Binary Search Tree produces…",
        "options": [
          "The nodes in random order",
          "A reversed tree",
          "Only the leaves",
          "The values in sorted ascending order"
        ],
        "answer": 3,
        "explain": "Inorder visits left subtree, node, right subtree — which for a BST yields the keys in sorted order. It's the shortcut for validation and Kth-smallest."
      },
      {
        "q": "Which traversal finds the shortest path (in edges) on an UNWEIGHTED graph or grid?",
        "options": [
          "BFS",
          "DFS",
          "Inorder",
          "Binary search"
        ],
        "answer": 0,
        "explain": "BFS reaches nodes in order of distance, so the first time it touches a node is via a shortest path. (Weighted graphs need Dijkstra instead.)"
      },
      {
        "q": "When exploring a graph with DFS, why is a 'visited' set mandatory (unlike a tree)?",
        "options": [
          "To sort the nodes",
          "Because graphs can have cycles, so without it you'd loop forever",
          "To count edges",
          "It isn't needed"
        ],
        "answer": 1,
        "explain": "Trees have no cycles, but general graphs do. Marking nodes visited stops DFS from revisiting and looping endlessly."
      },
      {
        "q": "'Number of islands' on a grid is solved by…",
        "options": [
          "Sorting the rows",
          "Binary search",
          "Treating the grid as a graph and flood-filling each unseen land cell with DFS/BFS",
          "A monotonic stack"
        ],
        "answer": 2,
        "explain": "Each cell connects to its 4 neighbours. Scan the grid; each time you hit unseen land, flood-fill its whole island and count +1 — O(rows × cols)."
      }
    ]
  },
  "pat-recursiondp": {
    "title": "Recursion & DP patterns",
    "sub": "Backtracking, dynamic programming and bit manipulation.",
    "questions": [
      {
        "q": "The core rhythm of backtracking is…",
        "options": [
          "sort, search, return",
          "hash, probe, resize",
          "divide, conquer, merge",
          "choose, explore, un-choose"
        ],
        "answer": 3,
        "explain": "Make a choice, recurse to explore it, then undo the choice on the way back up so sibling branches start clean. Forgetting the un-choose is the classic bug."
      },
      {
        "q": "Dynamic programming applies when a problem has…",
        "options": [
          "Overlapping subproblems AND optimal substructure",
          "No structure",
          "Only one possible answer",
          "Random inputs"
        ],
        "answer": 0,
        "explain": "DP shines when the answer is built from smaller versions of the same problem (optimal substructure) and those smaller answers repeat (overlapping subproblems), so you compute each once."
      },
      {
        "q": "Which signals usually point to dynamic programming?",
        "options": [
          "'Sort the array'",
          "'Count the number of ways' or 'min/max cost' over a series of choices",
          "'Reverse the string'",
          "'Find the middle node'"
        ],
        "answer": 1,
        "explain": "Counting ways or optimizing a cost over sequential decisions, where a brute-force recursion recomputes the same states, is the hallmark of DP."
      },
      {
        "q": "Why does XOR find the single non-duplicated number in an array where every other value appears twice?",
        "options": [
          "XOR sorts the values",
          "XOR counts occurrences",
          "Because x ^ x = 0 and x ^ 0 = x, so all pairs cancel and only the loner remains",
          "It doesn't — you need a hash map"
        ],
        "answer": 2,
        "explain": "XOR-ing everything together cancels each duplicated pair to 0, leaving just the unique value — O(n) time and O(1) space."
      }
    ]
  },
  "dsa-interview": {
    "title": "Interview craft checkpoint",
    "sub": "Working a coding problem out loud, the right way.",
    "questions": [
      {
        "q": "In the 7-step framework, what should you do FIRST when handed a problem?",
        "options": [
          "Write the optimal solution",
          "Pick a data structure",
          "State the time complexity",
          "Clarify the problem — restate it and ask about input ranges and edge cases"
        ],
        "answer": 3,
        "explain": "Clarify before you code. Restating the problem and pinning down input ranges, duplicates, and edge cases prevents you from confidently solving the wrong problem."
      },
      {
        "q": "Why state a brute-force approach before optimizing?",
        "options": [
          "It gives a correct baseline and its complexity to anchor the optimization",
          "It's usually the final answer",
          "To run out the clock",
          "Interviewers require it by rule"
        ],
        "answer": 0,
        "explain": "A brute force puts a correct baseline and its Big-O on the table, shows structured thinking, and gives you something concrete to improve — you optimize by naming and attacking its bottleneck."
      },
      {
        "q": "What is the interviewer primarily evaluating?",
        "options": [
          "Whether you instantly recall the trick",
          "How you think and communicate a structured approach",
          "Your typing speed",
          "How many problems you've memorized"
        ],
        "answer": 1,
        "explain": "They're hiring a problem-solver, not a lookup table. A clearly-communicated structured approach — even on a problem you don't fully crack — beats a silent correct answer."
      },
      {
        "q": "Just before you start writing code, you should…",
        "options": [
          "Stay silent and code as fast as possible",
          "Delete your hand-worked example",
          "Walk the plan out loud and get the interviewer's buy-in",
          "Skip the edge cases to save time"
        ],
        "answer": 2,
        "explain": "It's far cheaper to fix a plan than a screen of code. Narrate the approach, get a nod, then implement — and reuse the example you worked by hand as a test case."
      }
    ]
  },
  "pat-mastery": {
    "title": "Pattern mastery checkpoint",
    "sub": "Reading a problem and naming its pattern, fast.",
    "questions": [
      {
        "q": "'Longest substring with at most K distinct characters' is the signature of which pattern?",
        "options": [
          "Binary Search",
          "Union-Find",
          "Backtracking",
          "Sliding Window"
        ],
        "answer": 3,
        "explain": "A contiguous substring/subarray with a 'longest / shortest / at most K' constraint is the canonical Sliding Window trigger — grow and shrink a window instead of re-scanning."
      },
      {
        "q": "You need the fewest steps / shortest path on an UNWEIGHTED graph or grid. Reach for…",
        "options": [
          "BFS",
          "DFS",
          "Dynamic Programming",
          "Two Pointers"
        ],
        "answer": 0,
        "explain": "BFS explores level by level, so the first time it reaches a node it has used the fewest edges — the shortest path on an unweighted graph. DFS gives no such guarantee."
      },
      {
        "q": "'Find the K largest / most frequent / closest' elements points to which tool?",
        "options": [
          "A monotonic stack",
          "A heap (Top-K)",
          "A prefix-sum array",
          "A trie"
        ],
        "answer": 1,
        "explain": "A size-K heap keeps the running best K in O(n log K) without sorting everything — the standard Top-K pattern for 'K largest / smallest / most frequent / closest'."
      },
      {
        "q": "What's the winning study formula this track argues for?",
        "options": [
          "Grind 500+ random problems",
          "Memorize solutions verbatim",
          "Right patterns → right order → right focus, quality over quantity",
          "Only practice hard problems"
        ],
        "answer": 2,
        "explain": "You don't need 500+ problems — you need the right patterns in the right order, 5–10 high-signal problems each, and the recognition reflex. Ten you can re-derive beat a hundred you memorized."
      }
    ]
  }
});

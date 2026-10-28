/* track-cka.js — Certified Kubernetes Administrator concepts (unofficial, original prep) */
(function () {
  "use strict";
  var TID = "cka";

  function h(tag, attrs) {
    var el = document.createElement(tag);
    for (var k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    mount.appendChild(h("p", { class: "widget-desc" }, desc));
    var stage = h("div", { class: "w-stage" });
    mount.appendChild(stage);
    return stage;
  }
  function seg(label, opts, active, onPick) {
    var wrap = h("div", { class: "su-ctl" }, h("span", { class: "su-ctl-label" }, label));
    var box = h("div", { class: "w-seg", role: "group", "aria-label": label });
    var btns = opts.map(function (o, i) {
      var b = h("button", { type: "button", class: "w-seg-btn" + (i === active ? " active" : ""), "aria-pressed": i === active ? "true" : "false" }, o);
      b.addEventListener("click", function () {
        btns.forEach(function (x, j) { x.className = "w-seg-btn" + (j === i ? " active" : ""); x.setAttribute("aria-pressed", j === i ? "true" : "false"); });
        onPick(i);
      });
      box.appendChild(b);
      return b;
    });
    wrap.appendChild(box);
    return wrap;
  }
  function ro(label) {
    var b = h("b", {}, "-");
    var el = h("div", { class: "ro" }, label + ": ", b);
    return { el: el, set: function (v) { b.textContent = String(v); } };
  }
  function hashStr(s) { var x = 2166136261; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
  var bag = [];
  function slot(seedText) {
    if (!bag.length) {
      bag = [0, 1, 2, 3];
      var r = hashStr(TID + seedText);
      for (var i = 3; i > 0; i--) { r = (Math.imul(r, 1103515245) + 12345) >>> 0; var j = (r >>> 8) % (i + 1); var t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
    }
    return bag.pop();
  }
  function Q(q, right, wrong, explain) {
    var pos = slot(q);
    var options = wrong.slice(0, 3);
    options.splice(pos, 0, right);
    return { q: q, options: options, answer: pos, explain: explain };
  }
  var QZ = {};
  function L(id, title, summary, minutes, tags, blocks, questions) {
    var qid = TID + "-" + id;
    QZ[qid] = { title: "Checkpoint: " + title, sub: questions.length + " original exam-style questions with explanations", questions: questions };
    var b = blocks.slice(0, -1).concat([{ t: "quiz", id: qid }], blocks.slice(-1));
    return { id: id, title: title, summary: summary, minutes: minutes, tags: tags, blocks: b };
  }
  var VERIFY = { t: "note", variant: "warn", html: "Unofficial study material. The real exam is hands-on in a live terminal, and its curriculum and Kubernetes version change; <strong>verify current official objectives</strong> and practice in a real cluster. These questions check concepts and command recall." };

  /* ---------- widgets ---------- */
  var Widgets = {};

  Widgets.suScheduler = function (mount) {
    var stage = shell(mount, "scheduler", "Where can this pod land?", "Set the pod's CPU request, its toleration and node selector. Three nodes have different free CPU, taints and labels. The scheduler filters nodes, then scores the rest.");
    var nodes = [
      { n: "node-a", free: 500, taint: null, label: "disk=hdd" },
      { n: "node-b", free: 2000, taint: "gpu=true:NoSchedule", label: "disk=ssd" },
      { n: "node-c", free: 1500, taint: null, label: "disk=ssd" }
    ];
    var st = { req: 1, tol: 0, sel: 0 };
    var reqs = [250, 1000, 1800];
    var list = h("ul", { class: "su-list" });
    var a = ro("Feasible nodes"), b = ro("Pod status");
    function paint() {
      list.textContent = "";
      var ok = [];
      nodes.forEach(function (nd) {
        var why = [];
        if (reqs[st.req] > nd.free) why.push("insufficient cpu");
        if (nd.taint && !st.tol) why.push("untolerated taint " + nd.taint);
        if (st.sel === 1 && nd.label !== "disk=ssd") why.push("nodeSelector disk=ssd not matched");
        if (!why.length) ok.push(nd.n);
        list.appendChild(h("li", { class: why.length ? "is-bad" : "is-ok" }, nd.n + " (" + nd.free + "m free, " + nd.label + (nd.taint ? ", taint " + nd.taint : "") + "): " + (why.length ? why.join("; ") : "feasible")));
      });
      a.set(ok.length ? ok.join(", ") : "none");
      b.set(ok.length ? "Scheduled" : "Pending (FailedScheduling event)");
    }
    stage.appendChild(seg("CPU request", ["250m", "1000m", "1800m"], 1, function (i) { st.req = i; paint(); }));
    stage.appendChild(seg("Toleration gpu=true:NoSchedule", ["no", "yes"], 0, function (i) { st.tol = i; paint(); }));
    stage.appendChild(seg("nodeSelector", ["none", "disk=ssd"], 0, function (i) { st.sel = i; paint(); }));
    stage.appendChild(list);
    stage.appendChild(h("div", { class: "w-readout" }, a.el, b.el));
    paint();
  };

  Widgets.suRbacCheck = function (mount) {
    var stage = shell(mount, "rbac", "Would kubectl auth can-i say yes?", "A ServiceAccount 'ci' in namespace 'build' has a RoleBinding to a Role that allows get, list and create on pods in 'build'. Change the request.");
    var st = { verb: 0, res: 0, ns: 0, binding: 0 };
    var verbs = ["get", "create", "delete"], ress = ["pods", "deployments", "secrets"], nss = ["build", "prod"];
    var a = ro("Answer"), b = ro("Reason"), cmd = h("code", { class: "su-mono" }, "");
    function paint() {
      var allowedVerb = st.verb < 2;
      var allowedRes = st.res === 0;
      var nsOk = st.binding === 1 ? true : st.ns === 0;
      var ok = allowedVerb && allowedRes && nsOk;
      a.set(ok ? "yes" : "no");
      b.set(ok ? (st.binding ? "ClusterRole bound by ClusterRoleBinding applies in all namespaces" : "Role in 'build' grants it")
        : !allowedRes ? "the role does not list " + ress[st.res] : !allowedVerb ? "verb '" + verbs[st.verb] + "' is not in the rule" : "a Role and RoleBinding only grant inside their own namespace");
      cmd.textContent = "kubectl auth can-i " + verbs[st.verb] + " " + ress[st.res] + " -n " + nss[st.ns] + " --as=system:serviceaccount:build:ci";
    }
    stage.appendChild(seg("Verb", verbs, 0, function (i) { st.verb = i; paint(); }));
    stage.appendChild(seg("Resource", ress, 0, function (i) { st.res = i; paint(); }));
    stage.appendChild(seg("Namespace", nss, 0, function (i) { st.ns = i; paint(); }));
    stage.appendChild(seg("Binding type", ["Role + RoleBinding", "ClusterRole + ClusterRoleBinding"], 0, function (i) { st.binding = i; paint(); }));
    stage.appendChild(h("div", { class: "su-row" }, cmd));
    stage.appendChild(h("div", { class: "w-readout" }, a.el, b.el));
    paint();
  };

  Widgets.suServicePicker = function (mount) {
    var stage = shell(mount, "networking", "Service type picker", "Who needs to reach the pods, and how? Pick the requirement and see the Service type and the address clients use.");
    var st = { who: 0 };
    var opts = [
      ["ClusterIP", "web.shop.svc.cluster.local (virtual IP inside the cluster)", "internal callers only; default type"],
      ["NodePort", "<any-node-ip>:<port in the node port range>", "simple external access for labs or behind your own LB"],
      ["LoadBalancer", "external IP from the cloud or LB controller", "production external access where a provider integration exists"],
      ["Headless (clusterIP: None)", "DNS returns individual pod IPs", "StatefulSets and clients that pick specific pods"],
      ["Ingress + ClusterIP", "https://shop.example via an ingress controller", "many HTTP services behind one entry point with host/path rules"]
    ];
    var a = ro("Use"), b = ro("Clients connect to"), c = ro("Fits");
    function paint() { var o = opts[st.who]; a.set(o[0]); b.set(o[1]); c.set(o[2]); }
    stage.appendChild(seg("Requirement", ["Other pods only", "Quick external port", "Cloud external IP", "Stable per-pod DNS", "HTTP routing by host/path"], 0, function (i) { st.who = i; paint(); }));
    stage.appendChild(h("div", { class: "w-readout" }, a.el, b.el, c.el));
    paint();
  };

  Widgets.suPodTriage = function (mount) {
    var stage = shell(mount, "triage", "Pod status triage", "Pick the status you see in kubectl get pods. The panel lists the first commands to run and the usual causes.");
    var data = [
      ["Pending", "kubectl describe pod <p>  # read Events", "insufficient resources, untolerated taints, nodeSelector/affinity mismatch, unbound PVC"],
      ["ImagePullBackOff", "kubectl describe pod <p>", "wrong image name or tag, private registry without imagePullSecrets, registry unreachable"],
      ["CrashLoopBackOff", "kubectl logs <p> --previous", "application error on start, bad config or env, failing liveness probe, missing dependency"],
      ["OOMKilled", "kubectl describe pod <p>  # Last State", "memory limit too low for the workload or a leak"],
      ["Running but not Ready", "kubectl describe pod <p>; kubectl get endpoints <svc>", "readiness probe failing, so the pod is removed from Service endpoints"],
      ["CreateContainerConfigError", "kubectl describe pod <p>", "referenced ConfigMap or Secret key missing"]
    ];
    var st = { s: 0 };
    var a = ro("First command"), b = ro("Usual causes");
    function paint() { a.set(data[st.s][1]); b.set(data[st.s][2]); }
    stage.appendChild(seg("Status", data.map(function (d) { return d[0]; }), 0, function (i) { st.s = i; paint(); }));
    stage.appendChild(h("div", { class: "w-readout" }, a.el, b.el));
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ---------- lessons ---------- */
  var arch = [
    L("control-plane", "Control plane and node components", "What each component does and how a pod actually gets started.", 9, ["architecture"], [
      VERIFY,
      { t: "p", html: "Everything in Kubernetes is <strong>desired state stored in the API</strong>, and controllers that work to make reality match. The API server is the only component that talks to etcd; everyone else watches and updates objects through the API server." },
      { t: "table", headers: ["Component", "Runs on", "Job"], rows: [
        ["kube-apiserver", "Control plane", "Validates and serves the API; front door for everything"],
        ["etcd", "Control plane", "Consistent key-value store holding cluster state"],
        ["kube-scheduler", "Control plane", "Assigns unscheduled pods to nodes"],
        ["kube-controller-manager", "Control plane", "Runs controllers (Deployments, ReplicaSets, nodes, endpoints)"],
        ["kubelet", "Every node", "Ensures containers for pods bound to its node are running"],
        ["kube-proxy", "Every node (typically)", "Programs Service networking rules"],
        ["Container runtime", "Every node", "Pulls images and runs containers via the CRI"]
      ] },
      { t: "ol", items: ["You apply a Deployment; the API server stores it in etcd.", "The Deployment controller creates a ReplicaSet; the ReplicaSet controller creates Pods.", "The scheduler binds each Pod to a node.", "The kubelet on that node sees the binding and asks the runtime to start containers."] },
      { t: "note", variant: "tip", html: "In kubeadm clusters the control-plane components run as <strong>static pods</strong> whose manifests the kubelet reads from a directory on the node (commonly /etc/kubernetes/manifests). Edit the manifest and the kubelet recreates the pod." },
      { t: "note", variant: "key", html: "API server in front of etcd, controllers reconcile, scheduler places, kubelet runs. Static pod manifests define the control plane on kubeadm clusters." }
    ], [
      Q("Which component decides which node an unscheduled pod should run on?", "kube-scheduler", ["kubelet", "kube-proxy", "etcd"], "The scheduler watches for pods without a node, filters and scores nodes, and writes the binding. The kubelet only runs pods already bound to its node."),
      Q("Which component is the only one that reads and writes etcd directly in a standard cluster?", "kube-apiserver", ["kube-scheduler", "kubelet", "kube-controller-manager"], "All other components interact with cluster state through the API server, which owns communication with etcd."),
      Q("On a kubeadm control-plane node, where would you typically edit the kube-apiserver configuration?", "Its static pod manifest in the kubelet's manifest directory", ["A ConfigMap in the default namespace", "The Deployment named kube-apiserver", "The kube-proxy DaemonSet"], "kubeadm runs control-plane components as static pods. The kubelet watches the manifest directory and recreates the pod when the file changes."),
      Q("A ReplicaSet keeps three pods running after one is deleted. Which component performed the reconciliation?", "kube-controller-manager", ["kube-scheduler", "kube-proxy", "container runtime"], "Controllers inside the controller manager compare desired and actual state and create replacement pods."),
      Q("Which node component makes Service virtual IPs route to backend pods?", "kube-proxy", ["kubelet", "etcd", "kube-scheduler"], "kube-proxy programs networking rules on each node so traffic to a Service reaches its endpoints, unless a CNI replaces that function."),
      Q("A node's kubelet stops. What happens to new pods assigned to that node?", "They are not started, because the kubelet is what launches containers on the node", ["The scheduler starts them directly", "etcd starts the containers", "kube-proxy starts them"], "Only the kubelet starts containers on its node. Without it, the node becomes NotReady and pods there cannot run.")
    ]),

    L("kubeadm-lifecycle", "Cluster lifecycle with kubeadm", "Bootstrap, join, upgrade and maintain nodes safely.", 10, ["kubeadm", "upgrade"], [
      { t: "p", html: "kubeadm builds a cluster from nodes that already have a container runtime, kubelet and kubeadm installed. Upgrades follow a strict order: <strong>control plane first, then nodes one at a time</strong>, draining each node before touching it." },
      { t: "code", lang: "bash", code: "# control plane\nkubeadm upgrade plan\nkubeadm upgrade apply v1.X.Y        # first control-plane node\n# then upgrade kubelet/kubectl packages and restart kubelet\n\n# each worker\nkubectl drain node-1 --ignore-daemonsets\nkubeadm upgrade node                # on the worker\n# upgrade kubelet package, then: systemctl daemon-reload && systemctl restart kubelet\nkubectl uncordon node-1" },
      { t: "table", headers: ["Command", "Effect"], rows: [
        ["kubectl cordon", "Mark node unschedulable; existing pods stay"],
        ["kubectl drain", "Cordon and evict pods (respecting PodDisruptionBudgets)"],
        ["kubectl uncordon", "Allow scheduling again"],
        ["kubeadm token create --print-join-command", "Generate a join command for a new node"]
      ] },
      { t: "ul", items: ["Upgrade one minor version at a time.", "Version skew rules limit how far the kubelet may lag the API server; it must not be newer. Check the current policy.", "DaemonSet pods are not evicted by drain; --ignore-daemonsets acknowledges that.", "Pods with local emptyDir data need an explicit flag to be drained."] },
      { t: "note", variant: "trap", html: "Forgetting to <strong>uncordon</strong> after an upgrade leaves a healthy node that never receives new pods." },
      { t: "note", variant: "key", html: "Plan, upgrade the control plane, then drain, upgrade and uncordon each node, one minor version at a time." }
    ], [
      Q("What is the correct order for upgrading a kubeadm cluster?", "Control plane first, then worker nodes one at a time", ["Workers first, then the control plane", "All nodes simultaneously", "Only the kubelets; the control plane upgrades itself"], "Components must not be newer than the API server, so the control plane leads and nodes follow, each drained before upgrade."),
      Q("Which command evicts pods from a node and marks it unschedulable before maintenance?", "kubectl drain", ["kubectl cordon", "kubectl taint", "kubectl delete node"], "drain cordons the node and evicts its pods while respecting disruption budgets. cordon alone only stops new scheduling."),
      Q("After upgrading and restarting the kubelet on a worker, new pods never land on it. What was most likely forgotten?", "kubectl uncordon on that node", ["kubeadm init", "Deleting the node's certificates", "Restarting etcd"], "Draining leaves the node cordoned. It stays unschedulable until uncordoned."),
      Q("A drain fails because of DaemonSet-managed pods. What flag is commonly used?", "--ignore-daemonsets", ["--force-delete-etcd", "--all-namespaces", "--grace-period=-1 only"], "DaemonSet pods would be recreated immediately, so drain must be told to proceed without evicting them."),
      Q("How do you get a fresh join command for adding a worker to an existing kubeadm cluster?", "kubeadm token create --print-join-command", ["kubectl get join", "kubeadm reset", "kubectl create node"], "Join tokens expire. Creating a new token with print-join-command gives the full kubeadm join line."),
      Q("Which upgrade path is supported?", "One minor version at a time", ["Skipping three minor versions at once", "Downgrading the control plane during an upgrade", "Upgrading kubelets ahead of the API server"], "kubeadm upgrades are designed for sequential minor versions, and kubelets must not be newer than the API server.")
    ]),

    L("etcd-backup", "Backing up and restoring etcd", "Snapshots, certificates, and how a restore really works.", 9, ["etcd", "backup"], [
      { t: "p", html: "etcd holds the entire cluster state, so backing it up is backing up the cluster's configuration. A snapshot is a point-in-time file; a restore writes that snapshot into a <strong>new data directory</strong> that etcd is then pointed at." },
      { t: "code", lang: "bash", code: "ETCDCTL_API=3 etcdctl snapshot save /backup/etcd.db \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key\n\n# restore into a new directory (newer releases may use etcdutl)\netcdctl snapshot restore /backup/etcd.db --data-dir=/var/lib/etcd-restore\n# then point the etcd static pod's data volume at /var/lib/etcd-restore" },
      { t: "ul", items: ["Find endpoint and certificate paths in the etcd static pod manifest.", "Verify a snapshot with a status command before relying on it.", "After changing the manifest, the kubelet recreates the etcd pod; the API server reconnects.", "A snapshot does not include persistent volume data, only API objects."] },
      { t: "note", variant: "trap", html: "Restoring over the existing data directory, or forgetting to update the manifest's hostPath, are the usual reasons a restore appears to do nothing." },
      { t: "note", variant: "key", html: "Snapshot with endpoint and TLS flags; restore to a new data dir; repoint the etcd manifest. Volume data needs its own backup." }
    ], [
      Q("Where can you find the certificate paths needed for etcdctl on a kubeadm control-plane node?", "In the etcd static pod manifest", ["In the default ServiceAccount token", "In the kube-proxy ConfigMap", "In the kubelet's pod logs only"], "The etcd manifest lists its listen URLs and certificate files, which are the values etcdctl needs."),
      Q("What does an etcd snapshot capture?", "Cluster state stored as API objects", ["All application data on persistent volumes", "Container images on every node", "Node operating system packages"], "etcd stores Kubernetes objects. Persistent volume contents live in storage systems and need separate backups."),
      Q("What is the recommended target for an etcd restore?", "A new data directory, then update etcd to use it", ["The existing data directory while etcd runs", "A ConfigMap", "The kubelet's root directory"], "Restoring creates a fresh data directory from the snapshot. etcd is then reconfigured to use that directory."),
      Q("Which flags are typically required for etcdctl snapshot save against a TLS-secured etcd?", "--endpoints, --cacert, --cert and --key", ["--namespace and --selector", "--replicas and --image", "--kubeconfig only"], "etcd uses mutual TLS. etcdctl needs the endpoint plus CA, client certificate and key."),
      Q("After restoring etcd and updating the static pod manifest, what recreates the etcd pod?", "The kubelet, which watches the manifest directory", ["The Deployment controller", "kube-proxy", "The scheduler"], "Static pods are managed directly by the kubelet from manifest files, not by controllers."),
      Q("Why verify a snapshot file after saving it?", "To confirm it is complete and usable before you need it", ["To encrypt it automatically", "To upload it to the API server", "To delete old pods"], "A backup you cannot restore is not a backup. Checking status catches truncated or corrupt files early.")
    ]),

    L("rbac", "RBAC and ServiceAccounts", "Roles, bindings and the can-i check.", 9, ["rbac", "security"], [
      { t: "p", html: "RBAC is additive: no permissions exist until a rule grants them. A <strong>Role</strong> lists verbs on resources inside one namespace; a <strong>ClusterRole</strong> can be cluster-wide or reused across namespaces. <strong>Bindings</strong> attach roles to users, groups or ServiceAccounts." },
      { t: "table", headers: ["Combination", "Grants"], rows: [
        ["Role + RoleBinding", "Permissions in that one namespace"],
        ["ClusterRole + RoleBinding", "ClusterRole's permissions, but only in the binding's namespace"],
        ["ClusterRole + ClusterRoleBinding", "Permissions across all namespaces and cluster-scoped resources"]
      ] },
      { t: "widget", id: "suRbacCheck" },
      { t: "code", lang: "bash", code: "kubectl create role pod-reader --verb=get,list,watch --resource=pods -n dev\nkubectl create rolebinding read-pods --role=pod-reader --serviceaccount=dev:app -n dev\nkubectl auth can-i list pods -n dev --as=system:serviceaccount:dev:app" },
      { t: "note", variant: "trap", html: "Cluster-scoped resources such as nodes or persistent volumes cannot be granted by a namespaced Role; use a ClusterRole with a ClusterRoleBinding." },
      { t: "note", variant: "key", html: "Rules are additive; Roles are namespaced; bindings choose scope; verify with kubectl auth can-i --as." }
    ], [
      Q("A ServiceAccount needs to list pods only in namespace 'dev'. What is the least-privilege setup?", "A Role in dev allowing list on pods, bound with a RoleBinding in dev", ["A ClusterRoleBinding to cluster-admin", "A ClusterRole bound with a ClusterRoleBinding", "Adding the ServiceAccount to the kube-system namespace"], "A namespaced Role and RoleBinding grant exactly the needed verb in exactly one namespace."),
      Q("How can you check whether a ServiceAccount can delete deployments in 'prod' without logging in as it?", "kubectl auth can-i delete deployments -n prod --as=system:serviceaccount:<ns>:<name>", ["kubectl get rbac --check", "kubectl describe node", "kubectl logs deployment"], "auth can-i with --as impersonates the subject and evaluates RBAC rules."),
      Q("A ClusterRole is bound with a RoleBinding in namespace 'qa'. Where do its permissions apply?", "Only in namespace qa", ["In every namespace", "Only to cluster-scoped resources", "Nowhere; this combination is invalid"], "A RoleBinding scopes the referenced ClusterRole's rules to the binding's namespace, which lets you reuse one ClusterRole in many namespaces."),
      Q("A user must be able to list nodes. Which object type can grant that?", "A ClusterRole with a ClusterRoleBinding", ["A Role with a RoleBinding", "A NetworkPolicy", "A ResourceQuota"], "Nodes are cluster-scoped, so only cluster-level RBAC can grant access to them."),
      Q("Which statement about RBAC rules is true?", "They are additive; there are no deny rules", ["Deny rules override allow rules", "Everything is allowed until denied", "Rules only apply to human users"], "Kubernetes RBAC grants permissions only. Access exists when at least one rule allows it."),
      Q("Which identity do pods use to authenticate to the API server by default?", "The ServiceAccount assigned to the pod", ["The node's root user", "The cluster-admin user", "The kubelet's client certificate"], "Each pod runs as a ServiceAccount, the default one in its namespace unless another is specified.")
    ])
  ];

  var workloads = [
    L("controllers", "Deployments, DaemonSets, StatefulSets and Jobs", "Pick the controller that matches the workload, then roll it safely.", 10, ["deployments", "workloads"], [
      { t: "p", html: "Controllers turn a template into running pods and keep them there. Match the controller to what the workload promises: interchangeable replicas, one per node, stable identity, or run to completion." },
      { t: "table", headers: ["Controller", "Use for", "Key property"], rows: [
        ["Deployment", "Stateless replicas", "Rolling updates and rollbacks via ReplicaSets"],
        ["DaemonSet", "One pod per (matching) node", "Agents: logging, monitoring, networking"],
        ["StatefulSet", "Stateful apps", "Stable names, ordered rollout, per-pod volumes"],
        ["Job", "Run to completion", "Retries until success count is reached"],
        ["CronJob", "Scheduled Jobs", "Cron schedule creates Jobs"]
      ] },
      { t: "code", lang: "bash", code: "kubectl create deployment web --image=nginx --replicas=3\nkubectl set image deployment/web nginx=nginx:1.27\nkubectl rollout status deployment/web\nkubectl rollout history deployment/web\nkubectl rollout undo deployment/web\nkubectl scale deployment/web --replicas=5" },
      { t: "ul", items: ["maxSurge and maxUnavailable tune how aggressive a rolling update is.", "Recreate strategy stops old pods before starting new ones (downtime, but no mixed versions).", "Deleting a Deployment's pod just triggers a replacement; change the Deployment to change pods.", "Labels and selectors tie controllers to their pods; a selector mismatch orphans pods."] },
      { t: "note", variant: "trap", html: "Editing a pod managed by a Deployment is pointless; the controller reconciles it back. Edit the Deployment's template instead." },
      { t: "note", variant: "key", html: "Stateless: Deployment. Per node: DaemonSet. Identity: StatefulSet. Finite: Job or CronJob. Roll with set image, watch with rollout status, revert with rollout undo." }
    ], [
      Q("A log collector must run exactly one pod on every node, including nodes added later. Which controller fits?", "DaemonSet", ["Deployment with replicas equal to node count", "StatefulSet", "Job"], "DaemonSets place one pod per eligible node and automatically add pods to new nodes."),
      Q("A new image version is failing after a rolling update. What is the fastest way to revert?", "kubectl rollout undo deployment/<name>", ["Delete the Deployment and recreate it from memory", "kubectl drain every node", "Scale the Deployment to zero permanently"], "rollout undo switches back to the previous ReplicaSet revision."),
      Q("A database cluster needs stable pod names and a dedicated volume per replica. Which controller fits?", "StatefulSet", ["Deployment", "DaemonSet", "ReplicaSet"], "StatefulSets give each pod a stable identity and can create a PersistentVolumeClaim per pod from a template."),
      Q("Which command updates a Deployment's container image imperatively?", "kubectl set image deployment/web nginx=nginx:1.27", ["kubectl edit pod web-123 and change the image", "kubectl rollout pause pod", "kubectl run web --image=nginx:1.27 --update"], "set image changes the Deployment template, which triggers a rolling update. Editing a single pod does not change the controller."),
      Q("A nightly report must run at 02:00 and exit when done. Which object fits?", "CronJob", ["DaemonSet", "Deployment", "Service"], "CronJobs create Jobs on a schedule, and Jobs run pods to completion."),
      Q("During a rolling update you want no reduction in serving capacity. Which setting matters most?", "maxUnavailable set to 0 (with maxSurge above 0)", ["maxSurge set to 0 and maxUnavailable to 100%", "strategy type Recreate", "replicas set to 0"], "maxUnavailable 0 keeps all existing pods until replacements are ready, while maxSurge lets extra pods start first.")
    ]),

    L("scheduling", "Scheduling: requests, selectors, affinity, taints", "Steer pods to nodes and keep them off the wrong ones.", 10, ["scheduling", "taints"], [
      { t: "p", html: "The scheduler <strong>filters</strong> nodes that cannot run the pod, then <strong>scores</strong> the rest. Filtering uses resource <em>requests</em> (not limits), selectors, affinity rules and taints." },
      { t: "widget", id: "suScheduler" },
      { t: "table", headers: ["Tool", "Direction", "Effect"], rows: [
        ["nodeSelector", "Pod attracts to node", "Must match labels exactly"],
        ["Node affinity", "Pod attracts to node", "Required or preferred rules with operators"],
        ["Pod affinity / anti-affinity", "Pod relative to other pods", "Co-locate or spread by topology"],
        ["Taint", "Node repels pods", "NoSchedule, PreferNoSchedule, NoExecute"],
        ["Toleration", "Pod tolerates a taint", "Allows, but does not attract"]
      ] },
      { t: "code", lang: "bash", code: "kubectl label node node-c disk=ssd\nkubectl taint node node-b gpu=true:NoSchedule\nkubectl taint node node-b gpu=true:NoSchedule-   # remove" },
      { t: "ul", items: ["CPU over its limit is throttled; memory over its limit is OOMKilled.", "A pod whose requests fit no node stays Pending with a FailedScheduling event.", "NoExecute taints also evict running pods that do not tolerate them.", "To dedicate nodes: taint them and add both a toleration and an affinity/selector to the intended pods."] },
      { t: "note", variant: "trap", html: "A toleration alone does not send a pod to the tainted node; it only removes the barrier. Pair it with a selector or affinity to attract." },
      { t: "note", variant: "key", html: "Requests drive scheduling; selectors and affinity attract; taints repel and tolerations permit; dedicated nodes need both." }
    ], [
      Q("A pod stays Pending and its events say 0/3 nodes are available: insufficient cpu. What is the scheduler using to decide?", "The pod's CPU requests compared with each node's allocatable capacity", ["The pod's CPU limits only", "Actual CPU usage averaged over a week", "The number of containers in the image"], "Scheduling is based on requests against allocatable resources. Limits cap usage at runtime but do not drive placement."),
      Q("GPU nodes should run only GPU workloads. What is the most complete approach?", "Taint the GPU nodes, and give GPU pods a matching toleration plus a node affinity or selector", ["Add a toleration to all pods", "Label the GPU nodes only", "Use a NetworkPolicy"], "The taint keeps other pods off; the toleration lets GPU pods in; the selector or affinity makes them actually choose GPU nodes."),
      Q("A container exceeds its memory limit. What happens?", "It is terminated with OOMKilled", ["It is throttled but keeps running", "It is moved to another node automatically", "Its limit is raised automatically"], "Memory is not compressible; exceeding the limit causes the kernel to kill the container. CPU over its limit is throttled instead."),
      Q("Which taint effect also evicts already running pods that do not tolerate it?", "NoExecute", ["NoSchedule", "PreferNoSchedule", "NoEvict"], "NoExecute prevents new scheduling and evicts existing non-tolerating pods."),
      Q("Two replicas of a service must not run on the same node. What should you use?", "Pod anti-affinity with the hostname topology key", ["A DaemonSet", "A larger memory request", "A Role and RoleBinding"], "Pod anti-affinity spreads pods relative to each other across a topology domain such as the node hostname."),
      Q("How do you remove the taint gpu=true:NoSchedule from node-b?", "kubectl taint node node-b gpu=true:NoSchedule-", ["kubectl untaint node-b gpu", "kubectl delete taint gpu", "kubectl label node node-b gpu-"], "Appending a minus sign to the taint specification removes it.")
    ]),

    L("config-quotas", "ConfigMaps, Secrets, quotas and limits", "Inject configuration and keep namespaces within budget.", 9, ["configmap", "secret", "quota"], [
      { t: "p", html: "Keep configuration out of images. A <strong>ConfigMap</strong> holds non-sensitive settings; a <strong>Secret</strong> holds sensitive values. Both can be consumed as environment variables or as files in a volume." },
      { t: "code", lang: "bash", code: "kubectl create configmap app-cfg --from-literal=MODE=prod --from-file=app.properties\nkubectl create secret generic db-cred --from-literal=password='<from your vault>'\n# pod spec: envFrom: [{configMapRef: {name: app-cfg}}]\n#           volumes: [{name: cred, secret: {secretName: db-cred}}]" },
      { t: "table", headers: ["Consumption", "Updates when the object changes?"], rows: [
        ["Environment variables", "No; only on container restart"],
        ["Mounted volume", "Yes, eventually (not for subPath mounts)"]
      ] },
      { t: "table", headers: ["Object", "Controls"], rows: [
        ["ResourceQuota", "Total requests, limits, object counts in a namespace"],
        ["LimitRange", "Default and min/max requests and limits per pod or container"]
      ] },
      { t: "note", variant: "warn", html: "Secret values are base64-encoded, not encrypted, by default. Enable encryption at rest for Secrets and restrict who can read them with RBAC." },
      { t: "note", variant: "trap", html: "With a ResourceQuota on CPU or memory, pods that omit requests or limits are rejected unless a LimitRange supplies defaults." },
      { t: "note", variant: "key", html: "ConfigMaps for settings, Secrets for sensitive values (encrypt at rest), env vars are static, volumes refresh; quotas cap namespaces and LimitRanges set defaults." }
    ], [
      Q("An app reads a setting from an environment variable sourced from a ConfigMap. The ConfigMap is updated. When does the app see the new value?", "After the container restarts", ["Immediately", "Within one second", "Never, ConfigMaps are immutable"], "Environment variables are set when the container starts. Volume-mounted ConfigMaps can refresh, but env vars require a restart."),
      Q("How are Secret values stored in etcd by default?", "Base64-encoded, not encrypted unless encryption at rest is configured", ["Encrypted with a hardware module", "Hashed so they cannot be read back", "Stored only in memory"], "Base64 is an encoding, not protection. Encryption at rest and RBAC restrictions protect Secrets."),
      Q("A namespace has a ResourceQuota for CPU requests, and a new pod without requests is rejected. What is a clean fix?", "Add a LimitRange that sets default requests and limits", ["Delete the namespace", "Give the pod cluster-admin", "Use a DaemonSet instead"], "When quotas track requests, each pod must declare them. A LimitRange can inject defaults automatically."),
      Q("Which object limits the total number of pods and the total memory requests in a namespace?", "ResourceQuota", ["LimitRange", "NetworkPolicy", "PodDisruptionBudget"], "ResourceQuota enforces aggregate consumption limits per namespace. LimitRange applies per pod or container."),
      Q("Which command creates a ConfigMap from a literal value?", "kubectl create configmap app-cfg --from-literal=MODE=prod", ["kubectl create secret app-cfg MODE=prod", "kubectl set env configmap MODE=prod", "kubectl apply --literal MODE=prod"], "create configmap with --from-literal builds the object directly from key-value pairs."),
      Q("A container mounts a ConfigMap key with subPath. The ConfigMap changes. What happens to the file?", "It does not update until the pod is recreated", ["It updates instantly", "The pod is evicted automatically", "The key is deleted"], "subPath mounts are not refreshed when the source changes, unlike whole-volume mounts.")
    ])
  ];

  var net = [
    L("services", "Services and endpoints", "Stable virtual addresses in front of changing pods.", 9, ["services"], [
      { t: "p", html: "Pods come and go with new IPs. A <strong>Service</strong> gives a stable name and virtual IP, and selects backend pods by label. The endpoints behind it update automatically as matching pods become Ready." },
      { t: "widget", id: "suServicePicker" },
      { t: "code", lang: "bash", code: "kubectl expose deployment web --port=80 --target-port=8080 --type=ClusterIP\nkubectl get endpoints web          # or endpointslices\nkubectl run tmp --rm -it --image=busybox -- wget -qO- web" },
      { t: "ul", items: ["<code class='tok'>port</code> is the Service port; <code class='tok'>targetPort</code> is the container port.", "NodePort uses a port from the node port range on every node.", "LoadBalancer needs a cloud or load-balancer controller to assign an address.", "If a Service has no endpoints, check its selector against pod labels and pod readiness."] },
      { t: "note", variant: "trap", html: "A typo in the Service selector gives you a Service with zero endpoints and no error. Always check endpoints when traffic goes nowhere." },
      { t: "note", variant: "key", html: "Services select Ready pods by label and expose them on a stable address; no endpoints means a selector or readiness problem." }
    ], [
      Q("A Service exists but requests time out, and kubectl get endpoints shows none. What should you check first?", "Whether the Service selector matches the pod labels and the pods are Ready", ["Whether etcd has enough disk", "Whether the node port range is exhausted", "Whether the image is multi-architecture"], "Endpoints are built from Ready pods matching the selector. Empty endpoints usually mean a label mismatch or failing readiness."),
      Q("Which Service type is the default?", "ClusterIP", ["NodePort", "LoadBalancer", "ExternalName"], "ClusterIP exposes the Service on an internal virtual IP reachable within the cluster."),
      Q("A Service is defined with port 80 and targetPort 8080. What does targetPort mean?", "The port the container listens on", ["The port on the node", "The external load balancer port", "The DNS port"], "Clients connect to the Service port; traffic is forwarded to the pods' targetPort."),
      Q("On a bare-metal lab without a load-balancer controller, a LoadBalancer Service stays pending. Why?", "Nothing is available to provision an external address", ["LoadBalancer Services require StatefulSets", "The selector must be empty", "kube-proxy is disabled on control planes"], "LoadBalancer depends on a cloud integration or an installed controller to assign the external IP."),
      Q("Which Service configuration returns individual pod IPs from DNS instead of a single virtual IP?", "A headless Service with clusterIP: None", ["A NodePort Service", "A Service with two ports", "A LoadBalancer with a static IP"], "Headless Services skip the virtual IP, so DNS returns records for each backing pod, which suits StatefulSets."),
      Q("Which command creates a ClusterIP Service for an existing Deployment named web on port 80?", "kubectl expose deployment web --port=80", ["kubectl create service web --deployment", "kubectl run web --service", "kubectl port-forward deployment/web 80 --permanent"], "expose creates a Service whose selector matches the Deployment's pods.")
    ]),

    L("dns-ingress", "Cluster DNS, Ingress and Gateway", "Names for Services and HTTP routing into the cluster.", 8, ["dns", "ingress"], [
      { t: "p", html: "Cluster DNS (commonly CoreDNS) creates names for Services: <code class='tok'>&lt;service&gt;.&lt;namespace&gt;.svc.cluster.local</code>. Pods in the same namespace can use the short name. For HTTP from outside, an <strong>Ingress</strong> resource defines host and path rules, and an <strong>ingress controller</strong> implements them." },
      { t: "table", headers: ["From a pod in namespace 'shop'", "Resolves"], rows: [
        ["api", "api Service in shop"],
        ["api.billing", "api Service in billing"],
        ["api.billing.svc.cluster.local", "Fully qualified form"]
      ] },
      { t: "code", lang: "bash", code: "kubectl create ingress shop --class=nginx \\\n  --rule=\"shop.example/=web:80\" --rule=\"shop.example/api*=api:8080\"\nkubectl get ingress shop" },
      { t: "ul", items: ["An Ingress without a running controller does nothing.", "ingressClassName selects which controller handles it.", "TLS for an Ingress references a Secret containing the certificate and key.", "The Gateway API is a newer, more expressive family of routing resources; check whether your exam version covers it."] },
      { t: "note", variant: "trap", html: "If DNS lookups fail cluster-wide, check the DNS pods and their Service in kube-system before debugging application code." },
      { t: "note", variant: "key", html: "service.namespace.svc.cluster.local for names; Ingress rules need a controller; ingress class picks the controller." }
    ], [
      Q("A pod in namespace 'web' must call Service 'db' in namespace 'data'. Which name works?", "db.data", ["db", "data.db", "db.web.svc"], "Short names resolve within the caller's namespace. Adding the namespace (db.data or the full form) reaches another namespace."),
      Q("An Ingress resource is created but nothing answers on its host. What is a likely cause?", "No ingress controller is running or matching its class", ["The Service type must be NodePort", "DNS is disabled for Ingress by design", "Ingress only works for UDP"], "Ingress objects are only configuration. A controller must watch them and configure a proxy."),
      Q("What is the fully qualified DNS name of Service 'api' in namespace 'prod' with the default cluster domain?", "api.prod.svc.cluster.local", ["prod.api.cluster.local", "api.svc.prod.local", "api.prod.pod.cluster"], "The pattern is service.namespace.svc followed by the cluster domain."),
      Q("Where should a TLS certificate for an Ingress host be stored?", "In a Secret referenced by the Ingress tls section", ["In a ConfigMap annotation", "In the pod image", "In the Service's selector"], "Ingress TLS configuration references a TLS Secret holding the certificate and private key."),
      Q("Name resolution fails for every Service from every pod. What should you inspect early?", "The cluster DNS pods and their Service in kube-system", ["Each application's Dockerfile", "The ResourceQuota in default", "The etcd snapshot schedule"], "A cluster-wide DNS failure points to the DNS add-on itself, such as crashed pods or a broken Service."),
      Q("Which field chooses the controller that should implement an Ingress?", "ingressClassName", ["serviceAccountName", "nodeName", "schedulerName"], "ingressClassName links the Ingress to a specific IngressClass and its controller.")
    ]),

    L("netpol", "NetworkPolicies", "Default deny and explicit allows between pods.", 9, ["networkpolicy", "security"], [
      { t: "p", html: "By default every pod can reach every other pod. A <strong>NetworkPolicy</strong> selects pods and, for the directions it lists, allows only what its rules permit. Pods not selected by any policy stay open. Enforcement requires a CNI plugin that supports policies." },
      { t: "code", lang: "text", code: "apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata: { name: default-deny-ingress, namespace: shop }\nspec:\n  podSelector: {}\n  policyTypes: [Ingress]\n---\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata: { name: allow-web-to-api, namespace: shop }\nspec:\n  podSelector: { matchLabels: { app: api } }\n  ingress:\n  - from:\n    - podSelector: { matchLabels: { app: web } }\n    ports: [{ port: 8080 }]" },
      { t: "ul", items: ["An empty podSelector selects all pods in the namespace.", "Policies are additive: any policy allowing a flow allows it.", "Within one <code class='tok'>from</code> item, namespaceSelector and podSelector together mean AND; separate items mean OR.", "If you default-deny egress, remember to allow DNS (port 53) or name resolution breaks."] },
      { t: "note", variant: "trap", html: "Policies applied on a cluster whose CNI does not enforce them are silently ignored." },
      { t: "note", variant: "key", html: "Select pods, deny by default, allow specific flows; mind AND versus OR in selectors and allow DNS when restricting egress." }
    ], [
      Q("What is the default network behaviour between pods when no NetworkPolicies exist?", "All pods can communicate with all pods", ["All traffic is denied", "Only pods in the same namespace can communicate", "Only Services can receive traffic"], "Kubernetes networking is open by default. Isolation begins only when a policy selects a pod."),
      Q("A namespace needs all inbound pod traffic blocked unless explicitly allowed. What is the first policy to add?", "A policy with an empty podSelector and policyTypes Ingress with no ingress rules", ["A policy selecting no pods with egress rules", "A ResourceQuota with zero pods", "A Service of type None"], "An empty selector matches every pod; listing Ingress with no rules denies all inbound traffic to them."),
      Q("After applying a default-deny egress policy, applications fail to resolve hostnames. What was missed?", "An egress rule allowing DNS traffic", ["An ingress rule from kube-proxy", "A toleration", "An Ingress resource"], "Pods must reach the cluster DNS on port 53. Default-deny egress blocks that until explicitly allowed."),
      Q("Policies are applied but traffic is still unrestricted. What is a likely reason?", "The CNI plugin does not enforce NetworkPolicies", ["Policies apply only to Deployments", "Policies need a ClusterRoleBinding", "etcd must be restarted"], "The API accepts policies regardless, but enforcement depends on the network plugin."),
      Q("In a single 'from' entry containing both namespaceSelector and podSelector, how are they combined?", "Both must match (AND)", ["Either may match (OR)", "Only namespaceSelector is used", "Only podSelector is used"], "Inside one peer entry both selectors apply together. Listing them as separate entries would mean OR."),
      Q("Two policies select the same pod: one allows traffic from app=web, another from app=batch. What is allowed?", "Traffic from both app=web and app=batch", ["Only the newer policy's source", "Only the older policy's source", "No traffic, because policies conflict"], "Policies are additive; the union of their allowed flows is permitted.")
    ])
  ];

  var storage = [
    L("pv-pvc", "Persistent volumes, claims and StorageClasses", "Static and dynamic provisioning, access modes and reclaim policies.", 10, ["storage", "pvc"], [
      { t: "p", html: "Separate <em>supply</em> from <em>demand</em>. A <strong>PersistentVolume</strong> is a piece of storage; a <strong>PersistentVolumeClaim</strong> is a request for storage; a <strong>StorageClass</strong> lets claims trigger dynamic creation of volumes. Pods reference claims, never volumes directly." },
      { t: "table", headers: ["Access mode", "Meaning"], rows: [
        ["ReadWriteOnce (RWO)", "Read-write by a single node"],
        ["ReadOnlyMany (ROX)", "Read-only by many nodes"],
        ["ReadWriteMany (RWX)", "Read-write by many nodes (needs suitable storage)"],
        ["ReadWriteOncePod (RWOP)", "Read-write by a single pod"]
      ] },
      { t: "table", headers: ["Reclaim policy", "After the claim is deleted"], rows: [
        ["Delete", "Volume and backing storage are deleted (common for dynamic)"],
        ["Retain", "Volume kept as Released; admin must clean up and reuse manually"]
      ] },
      { t: "ul", items: ["A claim binds to a volume whose class, size and access mode satisfy it.", "A claim with no matching volume and no provisioner stays Pending, and so do pods using it.", "volumeBindingMode WaitForFirstConsumer delays provisioning until a pod is scheduled, which respects zone placement.", "Expanding a claim requires the StorageClass to allow volume expansion."] },
      { t: "code", lang: "text", code: "kind: PersistentVolumeClaim\napiVersion: v1\nmetadata: { name: data }\nspec:\n  accessModes: [ReadWriteOnce]\n  storageClassName: standard\n  resources: { requests: { storage: 5Gi } }" },
      { t: "note", variant: "trap", html: "A Retained volume does not bind to a new claim automatically after release; its old claim reference must be cleared." },
      { t: "note", variant: "key", html: "Pods use claims, claims bind to volumes, classes provision dynamically; match class, size and access mode, and choose Retain for data you must keep." }
    ], [
      Q("A pod is Pending because its PVC is Pending. There is no StorageClass with a provisioner and no matching PV. What fixes it?", "Create a PV that satisfies the claim, or configure a StorageClass that can provision one", ["Delete the pod's Service", "Add a toleration to the pod", "Increase the pod's CPU limit"], "A claim needs a matching volume. Without dynamic provisioning, an administrator must create a suitable PV."),
      Q("Which access mode lets many nodes mount a volume read-write at the same time?", "ReadWriteMany", ["ReadWriteOnce", "ReadOnlyMany", "ReadWriteOncePod"], "RWX allows simultaneous read-write mounts from multiple nodes, if the storage backend supports it."),
      Q("Data must be preserved when the claim is deleted. Which reclaim policy should the volume have?", "Retain", ["Delete", "Recycle on every reboot", "Ephemeral"], "Retain keeps the volume and data after release so an administrator can recover or reuse it."),
      Q("What does a StorageClass enable?", "Dynamic provisioning of volumes when claims are created", ["Scheduling pods to nodes with SSDs automatically", "Encryption of Secrets", "Service load balancing"], "StorageClasses describe a provisioner and parameters so claims can trigger automatic volume creation."),
      Q("Why use volumeBindingMode WaitForFirstConsumer in a multi-zone cluster?", "So the volume is provisioned in the zone where the pod is scheduled", ["So volumes are never deleted", "So pods start before storage exists", "So claims ignore access modes"], "Delaying binding until scheduling avoids creating a volume in a zone where the pod cannot run."),
      Q("How does a pod normally reference persistent storage?", "Through a persistentVolumeClaim volume source naming the claim", ["By naming the PV directly in the container spec", "Through an environment variable with the disk path", "Through the Service's selector"], "Pods reference claims; the claim indirection keeps workloads independent of specific storage.")
    ])
  ];

  var trouble = [
    L("pod-debug", "Troubleshooting pods", "From status to cause with describe, logs and events.", 10, ["troubleshooting", "pods"], [
      { t: "p", html: "Work from the outside in: <strong>status</strong> in <code class='tok'>kubectl get pods</code>, then <strong>events</strong> in <code class='tok'>describe</code>, then <strong>logs</strong>, then inside the container. Most failures announce their cause in events if you read them." },
      { t: "widget", id: "suPodTriage" },
      { t: "code", lang: "bash", code: "kubectl get pods -o wide\nkubectl describe pod web-7d9 | sed -n '/Events/,$p'\nkubectl logs web-7d9 -c app --previous\nkubectl exec -it web-7d9 -- sh\nkubectl get events --sort-by=.lastTimestamp -n shop" },
      { t: "table", headers: ["Probe", "On failure"], rows: [
        ["Liveness", "Container is restarted"],
        ["Readiness", "Pod removed from Service endpoints, not restarted"],
        ["Startup", "Other probes wait until it succeeds; failure restarts the container"]
      ] },
      { t: "note", variant: "trap", html: "A too-aggressive liveness probe on a slow-starting app creates its own CrashLoopBackOff. A startup probe or longer initial delay fixes it." },
      { t: "note", variant: "key", html: "Status, events, logs (--previous for crashes), then exec. Liveness restarts, readiness removes from endpoints." }
    ], [
      Q("A pod is in CrashLoopBackOff. Which command most directly shows why the last run failed?", "kubectl logs <pod> --previous", ["kubectl get nodes", "kubectl top pod", "kubectl get svc"], "CrashLoopBackOff means the container keeps exiting. Logs from the previous instance usually contain the error."),
      Q("A pod shows ImagePullBackOff. What is the most likely cause?", "The image name or tag is wrong, or the registry needs credentials", ["The node has too much memory", "The Service selector is wrong", "The pod has a readiness probe"], "The kubelet cannot pull the image. Describe events will show whether it is not found or unauthorized."),
      Q("A pod is Running but receives no traffic from its Service, and it is not Ready. Which probe is likely failing?", "Readiness probe", ["Liveness probe", "Startup probe that already passed", "No probe; Services ignore readiness"], "Failing readiness removes the pod from endpoints without restarting it."),
      Q("Where do you look first to see scheduling or pull errors for a pod?", "The Events section of kubectl describe pod", ["The container's /etc/hosts", "The etcd snapshot", "The Ingress resource"], "Events record scheduler decisions, pull failures, probe failures and volume errors."),
      Q("A slow-starting Java app is killed repeatedly by its liveness probe during startup. What is the best fix?", "Add a startup probe or increase the liveness initial delay", ["Remove all resource requests", "Change the Service type to NodePort", "Switch to a DaemonSet"], "A startup probe gives the app time to initialize before liveness checks begin."),
      Q("A pod status is CreateContainerConfigError. What should you check?", "Whether a referenced ConfigMap or Secret or key exists", ["Whether the node is cordoned", "Whether the image is too large", "Whether DNS is resolving"], "This error typically means the container spec references configuration that is missing.")
    ]),

    L("node-debug", "Troubleshooting nodes and the control plane", "NotReady nodes, kubelet logs and broken static pods.", 9, ["troubleshooting", "nodes"], [
      { t: "p", html: "When a node is NotReady, the kubelet on it is usually unhealthy or cannot reach the API server. When the API server itself is down, kubectl fails entirely, so you debug on the control-plane node with the runtime and the kubelet's logs." },
      { t: "code", lang: "bash", code: "kubectl get nodes; kubectl describe node node-2   # Conditions, events\n# on the node:\nsystemctl status kubelet\njournalctl -u kubelet --no-pager | tail -50\nsystemctl restart kubelet\n# control plane down? inspect static pods via the runtime\ncrictl ps -a; crictl logs <container-id>\nls /etc/kubernetes/manifests" },
      { t: "table", headers: ["Symptom", "Common cause"], rows: [
        ["Node NotReady", "kubelet stopped, misconfigured, or bad certificates; runtime down"],
        ["kubectl: connection refused", "API server static pod failing (bad manifest flag, cert path)"],
        ["Pods not scheduled anywhere", "Scheduler pod down"],
        ["Deployments not creating pods", "Controller manager down"],
        ["Node DiskPressure or MemoryPressure", "Resource exhaustion; eviction in progress"]
      ] },
      { t: "note", variant: "tip", html: "A typo in a static pod manifest stops that component. Compare against a backup copy and watch the runtime for the container restarting." },
      { t: "note", variant: "key", html: "NotReady: check kubelet with systemctl and journalctl. API down: inspect static pod manifests and container logs with crictl." }
    ], [
      Q("A worker node shows NotReady. What should you check first on that node?", "The kubelet service status and its logs", ["The Ingress controller logs", "The Deployment's rollout history", "The cluster's DNS records"], "NotReady usually means the kubelet is not reporting. systemctl status and journalctl reveal why."),
      Q("kubectl returns connection refused for every command. The control plane is kubeadm-based. Where should you look?", "The kube-apiserver static pod manifest and its container logs via the runtime", ["A ConfigMap in the default namespace", "The Service of type LoadBalancer", "The node's application logs"], "If the API server is down, kubectl cannot help. Inspect its manifest and container on the control-plane node."),
      Q("New Deployments are accepted but no pods are ever created. Which component is suspect?", "kube-controller-manager", ["kube-proxy", "CoreDNS", "kubelet on one worker"], "The controller manager creates ReplicaSets and pods from Deployments. If it is down, objects are stored but never reconciled."),
      Q("Pods are created but all stay Pending with no scheduling events at all. Which component is suspect?", "kube-scheduler", ["etcd", "kube-proxy", "The container runtime on one node"], "Without a running scheduler, pods are never assigned nodes and no scheduling events appear."),
      Q("Which tool lists containers directly through the CRI on a node, even when the API server is down?", "crictl", ["kubectl", "kubeadm token", "etcdctl snapshot"], "crictl talks to the container runtime directly, which is useful when the API is unavailable."),
      Q("A node reports DiskPressure. What is a likely consequence?", "The kubelet may evict pods and block new ones from scheduling there", ["The node gains more disk automatically", "All Services stop resolving", "etcd is restored from snapshot"], "Under pressure conditions the kubelet evicts pods to reclaim resources, and the node is tainted to avoid new scheduling.")
    ]),

    L("kubectl-speed", "Speed with kubectl", "Imperative generators, explain, contexts and verification habits.", 8, ["kubectl", "speed"], [
      { t: "p", html: "A hands-on exam rewards fast, correct edits. Generate YAML instead of typing it, verify every change, and always confirm you are in the right context and namespace before acting." },
      { t: "code", lang: "bash", code: "kubectl config use-context <context-from-the-task>\nkubectl config set-context --current --namespace=shop\nkubectl run web --image=nginx --dry-run=client -o yaml > web.yaml\nkubectl create deployment api --image=api:1 --replicas=2 --dry-run=client -o yaml\nkubectl explain pod.spec.containers.livenessProbe\nkubectl get pod web -o jsonpath='{.status.podIP}'" },
      { t: "ul", items: ["<code class='tok'>--dry-run=client -o yaml</code> turns imperative commands into editable manifests.", "<code class='tok'>kubectl explain</code> is offline field documentation, faster than guessing indentation.", "Short names (po, deploy, svc, ns, pvc) and an alias for kubectl save keystrokes.", "Verify after each task: get, describe, and a quick functional test such as a temporary busybox pod."] },
      { t: "note", variant: "trap", html: "Doing a perfect task in the wrong context scores nothing. Make switching context the first line of every task." },
      { t: "note", variant: "key", html: "Switch context first, generate YAML with dry-run, look up fields with explain, and verify every change before moving on." }
    ], [
      Q("What is the quickest way to get a starter manifest for a pod running nginx?", "kubectl run web --image=nginx --dry-run=client -o yaml", ["kubectl get pod web -o yaml before it exists", "kubectl describe image nginx", "kubectl explain nginx"], "dry-run=client with YAML output prints a manifest without creating anything, ready to edit and apply."),
      Q("You are unsure of the exact field name for a readiness probe's initial delay. What is fastest offline?", "kubectl explain pod.spec.containers.readinessProbe", ["kubectl logs readinessProbe", "kubectl top probes", "kubectl api-versions --probes"], "explain shows field names, types and descriptions from the API schema."),
      Q("Each task specifies a cluster context. What should you do before every task?", "Switch to the specified context", ["Restart the kubelet", "Delete all namespaces", "Take an etcd snapshot"], "Work done in the wrong cluster does not count. Switching context first avoids that mistake."),
      Q("How can you make all following commands default to namespace 'shop'?", "kubectl config set-context --current --namespace=shop", ["export NAMESPACE=shop", "kubectl create namespace shop --default", "kubectl label ns shop default=true"], "Setting the namespace on the current context changes the default for subsequent kubectl commands."),
      Q("Which command prints only a pod's IP address?", "kubectl get pod web -o jsonpath='{.status.podIP}'", ["kubectl describe pod web --ip", "kubectl logs web --ip", "kubectl top pod web"], "jsonpath output extracts specific fields from the object."),
      Q("After creating a Service and a Deployment, what is a good verification step?", "Run a temporary pod and request the Service by name", ["Assume it works if apply succeeded", "Reboot the node", "Delete the endpoints object"], "A successful apply only means the API accepted the objects. A functional test proves traffic reaches the pods.")
    ])
  ];

  window.QUIZZES = Object.assign(window.QUIZZES || {}, QZ);

  window.SUMMIT_CARDS = (window.SUMMIT_CARDS || []).concat([
    { front: "Who talks to etcd?", back: "Only the kube-apiserver; everyone else goes through the API.", track: TID },
    { front: "Static pods", back: "Pods the kubelet runs from manifest files on the node (kubeadm control plane).", track: TID },
    { front: "Upgrade order", back: "Control plane first; then drain, upgrade, uncordon each node; one minor version at a time.", track: TID },
    { front: "etcd snapshot flags", back: "--endpoints, --cacert, --cert, --key; restore to a new data dir and repoint the manifest.", track: TID },
    { front: "ClusterRole + RoleBinding", back: "ClusterRole's rules applied only in the RoleBinding's namespace.", track: TID },
    { front: "kubectl auth can-i --as", back: "Impersonate a user or ServiceAccount to test RBAC.", track: TID },
    { front: "DaemonSet", back: "One pod per eligible node, including new nodes.", track: TID },
    { front: "Requests vs limits", back: "Requests drive scheduling; limits cap usage (CPU throttled, memory OOMKilled).", track: TID },
    { front: "Taint vs toleration", back: "Taints repel; tolerations permit but do not attract.", track: TID },
    { front: "Env var from ConfigMap", back: "Does not update until the container restarts; volume mounts refresh.", track: TID },
    { front: "Empty Service endpoints", back: "Selector does not match labels, or pods are not Ready.", track: TID },
    { front: "Service DNS", back: "service.namespace.svc.cluster.local", track: TID },
    { front: "NetworkPolicy default", back: "Everything open until a policy selects the pod; enforcement needs a capable CNI.", track: TID },
    { front: "Reclaim Retain", back: "Volume and data kept after the claim is deleted; manual cleanup to reuse.", track: TID },
    { front: "CrashLoopBackOff first step", back: "kubectl logs <pod> --previous", track: TID }
  ]);

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.cka = {
    id: "cka",
    name: "Certified Kubernetes Administrator",
    short: "CKA",
    tagline: "Run, secure and repair a cluster under time pressure",
    color: "#818cf8",
    blurb: "Concept and command prep for the hands-on administrator exam: control plane, kubeadm lifecycle, etcd backup, RBAC, workloads and scheduling, Services, DNS, NetworkPolicies, storage, and troubleshooting. Unofficial; practice in a real cluster and verify current objectives.",
    modules: [
      { id: "arch", name: "Cluster architecture and lifecycle", icon: "cube", lessons: arch },
      { id: "workloads", name: "Workloads and scheduling", icon: "grid", lessons: workloads },
      { id: "net", name: "Services and networking", icon: "plug", lessons: net },
      { id: "storage", name: "Storage", icon: "database", lessons: storage },
      { id: "trouble", name: "Troubleshooting", icon: "wrench", lessons: trouble }
    ]
  };
})();

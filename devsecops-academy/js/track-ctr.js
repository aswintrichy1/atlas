/* =====================================================================
   FORGE · Containers & Kubernetes
   window.TRACKS.ctr — modules: docker / k8s / posture

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Block grammar: see the header of track-found.js.
   ===================================================================== */
(function () {
  "use strict";

  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
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
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
  }
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
  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }

  var Widgets = {};

  /* ctrBaseImage — base image choice vs size, packages and CVEs (illustrative) */
  var BASES = {
    full: { label: "Full OS image", size: 410, pkgs: 430, cves: 96, shell: "yes" },
    slim: { label: "Slim variant", size: 160, pkgs: 120, cves: 31, shell: "yes" },
    alpine: { label: "Alpine-based", size: 75, pkgs: 28, cves: 6, shell: "yes (busybox)" },
    distroless: { label: "Distroless", size: 62, pkgs: 9, cves: 2, shell: "no" }
  };
  Widgets.ctrBaseImage = function (mount) {
    shell(mount, "image", "Base image versus attack surface",
      "Pick a base image for the same Java service and whether you use a multi-stage build. Numbers are illustrative but the proportions are typical.");
    var base = "full", multi = false;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var b = BASES[base] || BASES.full;
      var size = b.size + (multi ? 0 : 280);
      var cves = b.cves + (multi ? 0 : 22);
      clear(stage);
      stage.appendChild(h("div", { style: "height:14px;border-radius:7px;background:var(--surface-solid);overflow:hidden" },
        h("i", { style: "display:block;height:100%;width:" + Math.min(100, Math.round(size / 700 * 100)) + "%;background:" + (cves > 40 ? "var(--rose)" : cves > 10 ? "var(--accent)" : "var(--lime)") })));
      stage.appendChild(h("p", { style: "font-size:0.84rem;color:var(--text-dim);margin-top:8px" },
        multi ? "Multi-stage: the JDK, Maven and caches stay in the build stage; only the jar and runtime ship." : "Single stage: compilers, package managers and build caches ship to production with the app."));
      clear(readout);
      readout.appendChild(ro("image size", size + " MB"));
      readout.appendChild(ro("OS packages", b.pkgs + (multi ? 0 : 60)));
      readout.appendChild(ro("known CVEs", cves));
      readout.appendChild(ro("shell inside", b.shell));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["full", "Full OS"], ["slim", "Slim"], ["alpine", "Alpine"], ["distroless", "Distroless"]], 0, function (v) { base = v; paint(); }),
      segment([[false, "Single stage"], [true, "Multi-stage"]], 0, function (v) { multi = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ctrPodSecurity — securityContext choices vs Pod Security Standards level */
  Widgets.ctrPodSecurity = function (mount) {
    shell(mount, "policy", "Which Pod Security Standard does this pod meet?",
      "Toggle the pod's security settings. Privileged and host access fail even the baseline profile; the restricted profile also needs non-root, no privilege escalation, dropped capabilities and a seccomp profile.");
    var s = { priv: true, host: true, root: true, caps: false, seccomp: false };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var baseline = !s.priv && !s.host;
      var restricted = baseline && !s.root && s.caps && s.seccomp;
      var level = restricted ? "restricted" : baseline ? "baseline" : "privileged only";
      var missing = [];
      if (s.priv) missing.push("privileged: true");
      if (s.host) missing.push("hostPath / hostNetwork");
      if (s.root) missing.push("runAsNonRoot");
      if (!s.caps) missing.push("drop ALL capabilities");
      if (!s.seccomp) missing.push("seccompProfile RuntimeDefault");
      clear(stage);
      stage.appendChild(h("p", { style: "font-size:0.86rem;margin:0;line-height:1.55" },
        restricted ? "Meets restricted: admission in a namespace labelled enforce=restricted admits it." :
        "Still to fix for restricted: " + missing.join(", ") + "."));
      clear(readout);
      readout.appendChild(ro("meets", level));
      readout.appendChild(ro("namespace enforce=restricted", restricted ? "admitted" : "rejected"));
      readout.appendChild(ro("namespace enforce=baseline", baseline ? "admitted" : "rejected"));
    }
    function toggle(key, onLabel, offLabel) {
      return segment([[true, onLabel], [false, offLabel]], s[key] ? 0 : 1, function (v) { s[key] = v; paint(); });
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      toggle("priv", "privileged", "not privileged"),
      toggle("host", "hostPath mounted", "no host access"),
      toggle("root", "runs as root", "runAsNonRoot"),
      toggle("caps", "caps dropped", "default caps"),
      toggle("seccomp", "seccomp RuntimeDefault", "no seccomp")));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "ctr-docker": {
      title: "Docker checkpoint",
      sub: "Images, Dockerfiles, hygiene, build and scanning.",
      questions: [
        { q: "Why deploy images by digest rather than by tag?", options: ["Digests are shorter", "A digest identifies exact content and cannot be moved to point at a different image; tags can", "Tags do not work in Kubernetes", "Digests skip scanning"], answer: 1,
          explain: "A tag is a movable label. The sha256 digest is the content hash, so what was scanned and signed is exactly what runs." },
        { q: "A build needs a private registry token. Which approach keeps it out of the image?", options: ["ARG NPM_TOKEN then RUN npm install", "ENV NPM_TOKEN in the Dockerfile", "A BuildKit secret mount for that RUN step", "COPY .npmrc with the token, then delete it in a later layer"], answer: 2,
          explain: "ARG and ENV values persist in image history, and a file deleted in a later layer still exists in the earlier one. A secret mount is available only during that step." },
        { q: "What does Hadolint check?", options: ["Running containers", "Dockerfile best practices such as pinned versions, a non-root USER and safe package installs", "Kubernetes RBAC", "Cloud posture"], answer: 1,
          explain: "Hadolint lints Dockerfiles (and the shell in RUN lines) before you build, so problems are fixed at the source." },
        { q: "What is the main security benefit of a multi-stage build?", options: ["Faster pushes only", "Build tools and caches stay in the build stage, so the runtime image has fewer packages and CVEs", "It signs the image", "It enables root"], answer: 1,
          explain: "Only the artifacts you copy into the final stage ship. Compilers and package managers never reach production." }
      ]
    },
    "ctr-k8s": {
      title: "Kubernetes security checkpoint",
      sub: "Cluster model, workloads and Helm, RBAC, network policy, pod security and the gated deploy stage.",
      questions: [
        { q: "What does helm rollback do?", options: ["Deletes the chart repository", "Redeploys a previous release revision recorded by Helm", "Rolls back the Git repository", "Downgrades Kubernetes"], answer: 1,
          explain: "Helm records each release revision. Rollback re-applies a previous revision's rendered manifests. In a GitOps setup you would instead revert the commit so Git and the cluster stay in agreement." },
        { q: "What does a default-deny NetworkPolicy do?", options: ["Deletes pods", "Blocks all ingress (and optionally egress) for selected pods until explicit allow policies are added", "Encrypts traffic", "Disables DNS"], answer: 1,
          explain: "Kubernetes allows all pod-to-pod traffic by default. Default deny plus explicit allows limits lateral movement." },
        { q: "Which Pod Security Standards level forbids privileged pods but still allows running as root?", options: ["privileged", "baseline", "restricted", "none"], answer: 1,
          explain: "Baseline blocks known privilege escalations such as privileged containers and host namespaces. Restricted additionally requires non-root, dropped capabilities and seccomp." },
        { q: "A service account is only used for scheduling a workload that never calls the Kubernetes API. What should you set?", options: ["cluster-admin binding", "automountServiceAccountToken: false", "hostNetwork: true", "A second service account"], answer: 1,
          explain: "If the pod never talks to the API, do not mount a token an attacker could steal." },
        { q: "How do you make sure production runs the exact image the pipeline signed?", options: ["Use :latest", "Reference the image by digest and verify its signature at admission", "Disable admission", "Pull from Docker Hub"], answer: 1,
          explain: "The digest pins content; signature verification at admission proves it came from your pipeline." }
      ]
    },
    "ctr-posture": {
      title: "Admission, runtime & zero trust checkpoint",
      sub: "Policy as code and admission control, CIS and runtime detection, CNAPP lenses, mesh mTLS and zero trust.",
      questions: [
        { q: "What does an admission controller such as OPA Gatekeeper or Kyverno do?", options: ["Builds container images", "Evaluates Kubernetes API requests against policy and can reject non-compliant resources before they are created", "Scans source code", "Rotates passwords"], answer: 1,
          explain: "Admission control is the last gate before a resource is persisted in the cluster. A policy such as 'no privileged pods' or 'only signed images' is enforced there regardless of how the request arrived." },
        { q: "Which statement about policy as code is accurate?", options: ["Policies are written in wiki pages", "Policies are versioned code, tested, and evaluated automatically in CI and at admission time", "Policy as code replaces all scanners", "It only works for AWS"], answer: 1,
          explain: "Writing policy as code (Rego, Kyverno YAML, Sentinel) lets you review, test and reuse it in CI, at admission and in cloud posture tools, with the same rule everywhere." },
        { q: "What is Falco used for?", options: ["Building images", "Runtime threat detection from kernel events, with rules such as a shell spawned in a container", "Helm templating", "Code review"], answer: 1,
          explain: "Falco watches syscalls through eBPF or a kernel module and alerts on suspicious behaviour. Tetragon, Sysdig and the Wiz runtime sensor cover similar ground." },
        { q: "What does mutual TLS in a service mesh such as Istio or Linkerd give you?", options: ["Faster builds", "Encrypted service-to-service traffic where both sides authenticate with workload identities", "Image signing", "Code coverage"], answer: 1,
          explain: "Each sidecar or node proxy presents a certificate for its workload identity, so traffic is encrypted and policies can be written in terms of identities." },
        { q: "Which statement captures zero trust as a design idea?", options: ["Buy a zero-trust product", "Never grant access because of network location; authenticate and authorize every request based on identity, device and context", "Trust everything inside the VPC", "Disable logging"], answer: 1,
          explain: "Zero trust is a principle. Mesh mTLS, workload identity, least privilege and continuous verification are ways to implement it." },
        { q: "Which CNAPP lens finds a ClusterRoleBinding granting cluster-admin to a CI service account?", options: ["DSPM", "KSPM together with CIEM", "DAST", "SAST"], answer: 1,
          explain: "KSPM evaluates Kubernetes configuration including RBAC; entitlement analysis shows what that identity can effectively do." },
        { q: "What does a mesh authorization policy add on top of mTLS?", options: ["Nothing", "Rules about which workload identities may call which services and methods", "Image scanning", "Log retention"], answer: 1,
          explain: "mTLS proves who is calling; authorization policy decides whether that caller is allowed." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.ctr = {
    id: "ctr",
    name: "Containers & Kubernetes",
    short: "CTR",
    tagline: "Docker and Kubernetes, beginner to secure",
    color: "#22d3ee",
    blurb: "Containers from first principles to a hardened supply chain: images, layers and digests, Dockerfiles and image hygiene, building, scanning and signing in Jenkins. Then Kubernetes: the cluster model, workloads and Helm, RBAC, network policy and Pod Security Standards, and Forge's single home for policy as code and admission control (OPA, Gatekeeper, Kyverno, Wiz admission), plus CIS benchmarks, runtime detection and zero trust.",
    modules: [
      {
        id: "docker",
        name: "Docker",
        icon: "cube",
        lessons: [
          {
            id: "docker-basics",
            title: "Containers vs VMs: images, layers, registries, tags and digests",
            summary: "What a container really is, and the vocabulary every later lesson relies on.",
            minutes: 9,
            tags: ["foundation", "docker", "containers", "images"],
            blocks: [
              { t: "p", html: "A <strong>virtual machine</strong> virtualizes hardware and runs a full guest kernel. A <strong>container</strong> is an ordinary process on the host kernel, isolated with <em>namespaces</em> (what it can see) and limited with <em>cgroups</em> (what it can use). That makes containers small and fast — and means the kernel is a shared security boundary." },
              { t: "table", headers: ["", "Virtual machine", "Container"], rows: [
                ["Isolation", "Hypervisor, separate kernel", "Namespaces and cgroups on a shared kernel"],
                ["Start time", "Tens of seconds", "Milliseconds to seconds"],
                ["Size", "Gigabytes", "Megabytes"],
                ["Escape impact", "Hypervisor escape is rare and severe", "Kernel or runtime escape reaches the node"]
              ] },
              { t: "h", text: "Images, layers and registries" },
              { t: "ul", items: [
                "An <strong>image</strong> is a stack of read-only <strong>layers</strong> plus config (entrypoint, user, env). Each Dockerfile instruction that changes the filesystem adds a layer.",
                "Layers are content-addressed and shared, so a common base is stored once.",
                "A <strong>registry</strong> (Harbor, Artifactory, ECR, ACR, Artifact Registry) stores images in repositories.",
                "A <strong>tag</strong> such as <code class='tok'>payments-api:482</code> is a movable label; a <strong>digest</strong> such as <code class='tok'>payments-api@sha256:…</code> is the immutable content hash."
              ] },
              { t: "code", lang: "bash", code:
                "docker pull registry.internal.example/base/java21:nonroot\n" +
                "docker image inspect --format '{{index .RepoDigests 0}}' registry.internal.example/base/java21:nonroot\n" +
                "docker history registry.internal.example/payments/payments-api:482   # every layer and the instruction that made it"
              },
              { t: "note", variant: "warn", html: "Anything written in any layer stays in the image, even if a later layer deletes it. <code class='tok'>docker history</code> and layer extraction reveal it." },
              { t: "note", variant: "key", html: "<strong>A container is an isolated process, an image is a stack of layers, a digest is the truth.</strong> Deploy digests; remember the kernel is shared." }
            ]
          },
          {
            id: "dockerfile",
            title: "Dockerfile essentials: FROM, COPY, RUN, ENTRYPOINT, multi-stage, .dockerignore",
            summary: "Write a Dockerfile that is cacheable, small and predictable.",
            minutes: 10,
            tags: ["practitioner", "dockerfile", "multi-stage", "dockerignore"],
            blocks: [
              { t: "table", headers: ["Instruction", "Does", "Tip"], rows: [
                ["FROM", "Sets the base image for a stage", "Pin by digest; name stages with AS"],
                ["WORKDIR", "Sets the working directory", "Avoid cd chains in RUN"],
                ["COPY", "Copies files from the build context or another stage", "Copy dependency manifests first for better caching"],
                ["RUN", "Executes a command in a new layer", "Combine install and cleanup in one RUN"],
                ["USER", "Sets the user for following steps and runtime", "Use a numeric non-root UID"],
                ["ENTRYPOINT / CMD", "Defines what runs", "Use exec form (JSON array) so signals reach the process"],
                ["HEALTHCHECK", "Lets the runtime probe health", "Kubernetes uses probes instead, but it documents intent"]
              ] },
              { t: "code", lang: "dockerfile", code:
                "# syntax=docker/dockerfile:1\n" +
                "FROM eclipse-temurin:21-jdk@sha256:<DIGEST> AS build\n" +
                "WORKDIR /src\n" +
                "COPY pom.xml mvnw ./\n" +
                "COPY .mvn .mvn\n" +
                "RUN ./mvnw -B -ntp dependency:go-offline      # cached until pom.xml changes\n" +
                "COPY src src\n" +
                "RUN ./mvnw -B -ntp package -DskipTests\n\n" +
                "FROM gcr.io/distroless/java21-debian12:nonroot@sha256:<DIGEST>\n" +
                "COPY --from=build /src/target/app.jar /app/app.jar\n" +
                "USER 65532:65532\n" +
                "ENTRYPOINT [\"java\", \"-jar\", \"/app/app.jar\"]"
              },
              { t: "code", lang: "text", code:
                "# .dockerignore — keep secrets and noise out of the build context\n" +
                ".git\n" +
                "**/*.pem\n" +
                "**/.env\n" +
                "target/\n" +
                "node_modules/\n" +
                "*.log"
              },
              { t: "note", variant: "tip", html: "The build context is sent to the builder in full. Without a .dockerignore, a stray <code class='tok'>.env</code> or key file can be copied into an image by a broad <code class='tok'>COPY . .</code>." },
              { t: "note", variant: "key", html: "<strong>Order for caching, split stages for size, ignore what must never ship.</strong> Exec-form entrypoints and a non-root user finish the job." }
            ]
          },
          {
            id: "image-hygiene",
            title: "Image hygiene: minimal bases, non-root, pinning, no secrets in layers",
            summary: "The habits that remove most container findings before any scanner runs.",
            minutes: 10,
            tags: ["practitioner", "distroless", "non-root", "pinning", "buildkit-secrets"],
            blocks: [
              { t: "widget", id: "ctrBaseImage" },
              { t: "table", headers: ["Habit", "Why", "How"], rows: [
                ["Official or vetted minimal base", "Fewer packages, fewer CVEs, maintained patches", "Distroless, slim or a golden base image from the platform team"],
                ["Non-root USER", "A compromise does not start as root", "USER with a numeric UID; runAsNonRoot in the pod"],
                ["Pin versions and digests", "Reproducible builds; no surprise base changes", "FROM image@sha256:…; pinned package versions"],
                ["No secrets in layers or build args", "History and layers are readable by anyone with pull access", "BuildKit secret mounts; runtime injection"],
                ["HEALTHCHECK / probes", "Unhealthy containers are replaced automatically", "HEALTHCHECK for Docker; liveness and readiness in Kubernetes"],
                ["Read-only root filesystem", "Malware cannot write binaries; drift is impossible", "readOnlyRootFilesystem: true plus an emptyDir for temp"]
              ] },
              { t: "code", lang: "dockerfile", code:
                "# build-time credential via a secret mount: never stored in a layer\n" +
                "RUN --mount=type=secret,id=npm_token \\\n" +
                "    NPM_TOKEN=\"$(cat /run/secrets/npm_token)\" npm ci --ignore-scripts\n\n" +
                "# CI side: docker buildx build --secret id=npm_token,env=NPM_TOKEN ."
              },
              { t: "compare",
                bad: { title: "Leaks into the image", items: ["<code class='tok'>ARG NPM_TOKEN</code> used in RUN", "<code class='tok'>ENV API_KEY=…</code>", "COPY a key file, delete it later", "Full OS base running as root"] },
                good: { title: "Stays out", items: ["Secret mount for the one RUN step", "Runtime secrets from the orchestrator", ".dockerignore excludes key files", "Distroless nonroot base by digest"] } },
              { t: "note", variant: "warn", html: "Never mount the Docker socket into a container and never run <code class='tok'>privileged: true</code> for application workloads. Either one is effectively root on the node." },
              { t: "note", variant: "key", html: "<strong>Minimal, non-root, pinned, secret-free, read-only.</strong> A clean image needs fewer exceptions, fewer patches and fewer incident calls." }
            ]
          },
          {
            id: "build-ship",
            title: "Build and ship: buildx, tagging, pushing and immutability",
            summary: "From docker build to an immutable, promotable image in Harbor, Artifactory or a cloud registry.",
            minutes: 9,
            tags: ["practitioner", "buildx", "registry", "harbor", "immutability"],
            blocks: [
              { t: "code", lang: "bash", code:
                "# multi-arch build with BuildKit, tagged with the commit and pushed once\n" +
                "docker buildx build --platform linux/amd64,linux/arm64 \\\n" +
                "  --provenance=true --sbom=true \\\n" +
                "  -t registry.internal.example/payments/payments-api:3f9c2a1 --push .\n\n" +
                "# promotion later copies the same digest; no rebuild\n" +
                "crane copy registry.internal.example/payments/payments-api@sha256:<DIGEST> \\\n" +
                "           registry.internal.example/payments-prod/payments-api@sha256:<DIGEST>"
              },
              { t: "table", headers: ["Registry", "Immutability and trust features"], rows: [
                ["Harbor", "Immutable tag rules, built-in Trivy scanning, cosign signature policy, replication, project RBAC"],
                ["Artifactory", "Repository permissions, Xray scanning, promotion between local repos, build-info"],
                ["ECR / ACR / Artifact Registry", "Tag immutability settings, IAM-scoped push and pull, scan on push"]
              ] },
              { t: "ul", items: [
                "Tag with something traceable (commit SHA, build number); never rely on <code class='tok'>latest</code>.",
                "Turn on tag immutability in production repositories.",
                "Grant push only to the pipeline identity; humans pull only.",
                "Set retention rules, but never delete a digest that production still runs."
              ] },
              { t: "note", variant: "key", html: "<strong>Build once with BuildKit, push a traceable tag, promote the digest.</strong> Immutability and pipeline-only push make the registry trustworthy." }
            ]
          },
          {
            id: "docker-security-tools",
            title: "Container security tooling: Hadolint, Trivy, Snyk, Wiz, Scout, Docker Bench, cosign, SBOM",
            summary: "Which tool checks which layer of the container story, and where it runs.",
            minutes: 10,
            tags: ["practitioner", "hadolint", "trivy", "snyk-container", "docker-scout", "docker-bench", "cosign"],
            blocks: [
              { t: "table", headers: ["Tool", "Checks", "Pipeline point"], rows: [
                ["Hadolint", "Dockerfile rules: pinned versions, USER, apt hygiene, shell pitfalls", "Before build, seconds"],
                ["Trivy", "Image OS and app CVEs, misconfigurations, secrets, SBOM output", "After build, before push"],
                ["Snyk Container", "Image CVEs with base-image upgrade advice", "After build; monitor in registry"],
                ["Wiz CLI image scan", "Image CVEs, secrets, malware against central Wiz policies", "After build, before push; tag after push"],
                ["Docker Scout", "Image CVEs and base recommendations inside Docker tooling", "Developer laptop, Docker Hub"],
                ["Docker Bench for Security", "Host and daemon configuration against the CIS Docker Benchmark", "Build hosts and container hosts"],
                ["cosign", "Signs images and attestations; verifies them", "After push; verified at admission"],
                ["Syft / BuildKit SBOM", "Software bill of materials for the image", "At build; attached as an attestation"]
              ] },
              { t: "code", lang: "bash", code:
                "hadolint Dockerfile\n" +
                "trivy image --severity HIGH,CRITICAL --exit-code 1 payments-api:482\n" +
                "snyk container test payments-api:482 --file=Dockerfile --severity-threshold=high\n" +
                "wizcli docker scan --image payments-api:482 --policy \"<WIZ_VULN_POLICY>\"\n" +
                "syft payments-api:482 -o cyclonedx-json > sbom.cdx.json"
              },
              { t: "note", variant: "tip", html: "Run one primary scanner as the gate and keep others advisory. Two blocking scanners with different databases double the noise without doubling the safety." },
              { t: "note", variant: "key", html: "<strong>Lint the recipe, scan the image, sign the digest, attach the SBOM, benchmark the host.</strong> Each tool covers a different layer." }
            ]
          },
          {
            id: "docker-in-jenkins",
            title: "Docker in the Jenkins pipeline: build, scan with Snyk and Wiz, sign, push",
            summary: "A stage group that only pushes images that passed every gate, with credential-store references only.",
            minutes: 10,
            tags: ["practitioner", "jenkins", "docker", "snyk", "wizcli", "cosign"],
            blocks: [
              { t: "code", lang: "groovy", code:
                "stage('Container') {\n" +
                "  environment { IMAGE = \"registry.internal.example/payments/payments-api:${env.GIT_COMMIT.take(12)}\" }\n" +
                "  stages {\n" +
                "    stage('Lint')  { steps { sh 'hadolint Dockerfile' } }\n" +
                "    stage('Build') { steps { sh 'docker buildx build --load -t \"$IMAGE\" .' } }\n" +
                "    stage('Scan') {\n" +
                "      parallel {\n" +
                "        stage('Snyk Container') {\n" +
                "          steps {\n" +
                "            withCredentials([string(credentialsId: 'snyk-api-token', variable: 'SNYK_TOKEN')]) {\n" +
                "              sh 'snyk container test \"$IMAGE\" --file=Dockerfile --severity-threshold=high'\n" +
                "            }\n" +
                "          }\n" +
                "        }\n" +
                "        stage('Wiz image') {\n" +
                "          steps {\n" +
                "            withCredentials([usernamePassword(credentialsId: 'wiz-service-account',\n" +
                "                usernameVariable: 'WIZ_CLIENT_ID', passwordVariable: 'WIZ_CLIENT_SECRET')]) {\n" +
                "              sh '''\n" +
                "                set +x\n" +
                "                wizcli auth --id \"$WIZ_CLIENT_ID\" --secret \"$WIZ_CLIENT_SECRET\"\n" +
                "                wizcli docker scan --image \"$IMAGE\" --dockerfile Dockerfile --policy \"<WIZ_VULN_POLICY>\"\n" +
                "              '''\n" +
                "            }\n" +
                "          }\n" +
                "        }\n" +
                "      }\n" +
                "    }\n" +
                "    stage('Push & sign') {\n" +
                "      when { branch 'main' }\n" +
                "      steps {\n" +
                "        withCredentials([usernamePassword(credentialsId: 'registry-push', usernameVariable: 'REG_USER', passwordVariable: 'REG_TOKEN'),\n" +
                "                         file(credentialsId: 'cosign-private-key', variable: 'COSIGN_KEY'),\n" +
                "                         string(credentialsId: 'cosign-key-password', variable: 'COSIGN_PASSWORD')]) {\n" +
                "          sh '''\n" +
                "            set +x\n" +
                "            echo \"$REG_TOKEN\" | docker login registry.internal.example -u \"$REG_USER\" --password-stdin\n" +
                "            docker push \"$IMAGE\"\n" +
                "            DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' \"$IMAGE\")\n" +
                "            cosign sign --yes --key \"$COSIGN_KEY\" \"$DIGEST\"\n" +
                "          '''\n" +
                "        }\n" +
                "      }\n" +
                "    }\n" +
                "  }\n" +
                "}"
              },
              { t: "ul", items: [
                "Lint is seconds; it runs first so broken Dockerfiles never build.",
                "Snyk and Wiz scan in parallel; either failing stops the push.",
                "Push, sign and attest happen only on main, so PR images never reach the registry.",
                "Every credential is a Jenkins credential id; the shell, not Groovy, expands values."
              ] },
              { t: "note", variant: "tip", html: "Rehearse this stage group in the <a href='#/simulator'>pipeline simulator</a>: inject a root Dockerfile or a secret in a layer and watch Hadolint and the image scan respond." },
              { t: "quiz", id: "ctr-docker" },
              { t: "note", variant: "key", html: "<strong>Lint, build, scan in parallel, then push and sign only what passed.</strong> The registry only ever receives gated, signed digests." }
            ]
          }
        ]
      },
      {
        id: "k8s",
        name: "Kubernetes",
        icon: "grid",
        lessons: [
          {
            id: "k8s-model",
            title: "The cluster model: control plane, nodes and core objects",
            summary: "API server, etcd, scheduler, kubelet; pods, deployments, services, namespaces, ConfigMaps, Secrets, Ingress.",
            minutes: 10,
            tags: ["practitioner", "kubernetes", "control-plane", "objects"],
            blocks: [
              { t: "table", headers: ["Component", "Role", "Security note"], rows: [
                ["kube-apiserver", "Front door for every change; authenticates, authorizes, runs admission", "Private endpoint, OIDC auth, audit logging"],
                ["etcd", "Stores all cluster state, including Secrets", "Encrypt at rest; restrict network access"],
                ["Scheduler and controllers", "Place pods, reconcile desired state", "Managed by the provider in EKS, AKS, GKE"],
                ["kubelet (each node)", "Runs pods via the container runtime", "Authenticated API; node hardening"],
                ["kube-proxy / CNI", "Service networking and pod IPs", "CNI choice decides NetworkPolicy support"]
              ] },
              { t: "table", headers: ["Object", "Is"], rows: [
                ["Pod", "One or more containers sharing network and storage"],
                ["Deployment / ReplicaSet", "Desired number of identical pods and their rollout"],
                ["Service", "Stable virtual IP and DNS name for a set of pods"],
                ["Ingress / Gateway", "HTTP routing from outside into Services"],
                ["Namespace", "A scope for names, RBAC, quotas and policies"],
                ["ConfigMap", "Non-secret configuration"],
                ["Secret", "Sensitive values — base64-encoded, not encrypted, unless etcd encryption is on (see <a href='#/chain/identity/secrets-e2e'>secrets end to end</a>)"]
              ] },
              { t: "diagram", id: "k8s-secure-deploy", caption: "Every request passes authentication, RBAC and admission before it is stored; nodes then run what was admitted." },
              { t: "note", variant: "key", html: "<strong>Everything goes through the API server.</strong> Authentication, RBAC and admission there are the cluster's real perimeter." }
            ]
          },
          {
            id: "k8s-workloads",
            title: "Workloads: deployments, rolling updates, probes, limits, Helm, Kustomize and GitOps",
            summary: "Run the signed image reliably and deploy it declaratively.",
            minutes: 11,
            tags: ["practitioner", "deployments", "probes", "helm", "kustomize", "argo-cd"],
            blocks: [
              { t: "code", lang: "yaml", code:
                "apiVersion: apps/v1\n" +
                "kind: Deployment\n" +
                "metadata: { name: payments-api, namespace: payments }\n" +
                "spec:\n" +
                "  replicas: 6\n" +
                "  strategy: { type: RollingUpdate, rollingUpdate: { maxSurge: 1, maxUnavailable: 0 } }\n" +
                "  selector: { matchLabels: { app: payments-api } }\n" +
                "  template:\n" +
                "    metadata: { labels: { app: payments-api } }\n" +
                "    spec:\n" +
                "      containers:\n" +
                "        - name: app\n" +
                "          image: registry.internal.example/payments/payments-api@sha256:<DIGEST>\n" +
                "          resources:\n" +
                "            requests: { cpu: 250m, memory: 384Mi }\n" +
                "            limits:   { memory: 512Mi }\n" +
                "          readinessProbe: { httpGet: { path: /ready, port: 8080 }, periodSeconds: 5 }\n" +
                "          livenessProbe:  { httpGet: { path: /live,  port: 8080 }, initialDelaySeconds: 20 }"
              },
              { t: "table", headers: ["Tool", "Model", "Best for"], rows: [
                ["Helm", "Templated charts with values files; releases with revisions", "Packaging apps for many environments and consumers"],
                ["Kustomize", "Plain YAML bases plus overlays (patches) per environment", "Small per-environment differences without templating"],
                ["Argo CD / Flux", "Pull-based GitOps sync of Helm or Kustomize from Git", "Deploying what the pipeline committed, with drift correction"]
              ] },
              { t: "p", html: "Helm packages manifests as a <strong>chart</strong> with templated values. A <strong>release</strong> is an installed instance with numbered revisions: <code class='tok'>helm upgrade --install</code> deploys, <code class='tok'>helm rollback</code> re-applies a previous revision, and <code class='tok'>helm template</code> renders the manifests so scanners and policy checks can inspect them before deploy. Under GitOps you revert the config commit instead of running rollback, so Git and the cluster stay in agreement." },
              { t: "p", html: "In the GitOps flow, the pipeline does not deploy. It commits the <strong>new signed digest</strong> into the environment's config (a Helm values file or Kustomize image override), and Argo CD or Flux syncs it. Admission then verifies the signature before pods start." },
              { t: "note", variant: "tip", html: "Requests drive scheduling; limits cap usage. Always set memory limits and quotas per namespace so one noisy or compromised workload cannot starve the node." },
              { t: "note", variant: "key", html: "<strong>Digest-pinned image, safe rolling update, real probes, sensible resources, delivered by GitOps.</strong>" }
            ]
          },
          {
            id: "k8s-rbac-netpol",
            title: "RBAC, service accounts and NetworkPolicies",
            summary: "Least privilege for API access and default-deny for traffic.",
            minutes: 11,
            tags: ["practitioner", "rbac", "service-accounts", "network-policy"],
            blocks: [
              { t: "table", headers: ["Object", "Scope", "Grants"], rows: [
                ["Role", "One namespace", "Verbs on resources in that namespace"],
                ["ClusterRole", "Cluster-wide or reusable", "Verbs on cluster resources or any namespace"],
                ["RoleBinding", "One namespace", "A Role or ClusterRole to users, groups or service accounts there"],
                ["ClusterRoleBinding", "Whole cluster", "A ClusterRole everywhere — use sparingly"]
              ] },
              { t: "code", lang: "yaml", code:
                "apiVersion: v1\n" +
                "kind: ServiceAccount\n" +
                "metadata: { name: payments-api, namespace: payments }\n" +
                "automountServiceAccountToken: false      # the app never calls the Kubernetes API\n" +
                "---\n" +
                "apiVersion: networking.k8s.io/v1\n" +
                "kind: NetworkPolicy\n" +
                "metadata: { name: default-deny, namespace: payments }\n" +
                "spec:\n" +
                "  podSelector: {}\n" +
                "  policyTypes: [Ingress, Egress]\n" +
                "---\n" +
                "apiVersion: networking.k8s.io/v1\n" +
                "kind: NetworkPolicy\n" +
                "metadata: { name: allow-ingress-to-api, namespace: payments }\n" +
                "spec:\n" +
                "  podSelector: { matchLabels: { app: payments-api } }\n" +
                "  ingress:\n" +
                "    - from: [{ namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: ingress } } }]\n" +
                "      ports: [{ port: 8080 }]"
              },
              { t: "ul", items: [
                "Avoid wildcards (<code class='tok'>*</code>) in verbs and resources; avoid binding cluster-admin to anything automated.",
                "Watch for escalation verbs: <code class='tok'>create pods</code>, <code class='tok'>bind</code>, <code class='tok'>escalate</code>, <code class='tok'>impersonate</code>, reading Secrets.",
                "After default deny, remember DNS egress and the database egress the app needs."
              ] },
              { t: "note", variant: "key", html: "<strong>Narrow Roles, few ClusterRoleBindings, no unused tokens, default-deny traffic.</strong> That limits both API abuse and lateral movement." }
            ]
          },
          {
            id: "k8s-pod-security",
            title: "Pod Security Standards and a secure pod manifest",
            summary: "Privileged, baseline and restricted; non-root, dropped capabilities, read-only root and seccomp.",
            minutes: 11,
            tags: ["practitioner", "pod-security", "securitycontext", "psa"],
            blocks: [
              { t: "p", html: "<strong>Pod Security Admission</strong> is built into Kubernetes. Label a namespace with a <strong>Pod Security Standard</strong> and mode — <code class='tok'>enforce</code>, <code class='tok'>audit</code> or <code class='tok'>warn</code> — and the API server checks every pod against it." },
              { t: "table", headers: ["Level", "Allows", "Use for"], rows: [
                ["privileged", "Everything", "System components that truly need host access"],
                ["baseline", "Blocks privileged, host namespaces, hostPath, dangerous capabilities", "Minimum for all application namespaces"],
                ["restricted", "Also requires non-root, no privilege escalation, drop ALL, seccomp", "Default target for applications"]
              ] },
              { t: "widget", id: "ctrPodSecurity" },
              { t: "code", lang: "yaml", code:
                "apiVersion: v1\n" +
                "kind: Namespace\n" +
                "metadata:\n" +
                "  name: payments\n" +
                "  labels:\n" +
                "    pod-security.kubernetes.io/enforce: restricted\n" +
                "    pod-security.kubernetes.io/audit: restricted\n" +
                "---\n" +
                "# secure pod template (inside the Deployment)\n" +
                "spec:\n" +
                "  serviceAccountName: payments-api\n" +
                "  securityContext:\n" +
                "    runAsNonRoot: true\n" +
                "    runAsUser: 65532\n" +
                "    seccompProfile: { type: RuntimeDefault }\n" +
                "  containers:\n" +
                "    - name: app\n" +
                "      image: registry.internal.example/payments/payments-api@sha256:<DIGEST>\n" +
                "      securityContext:\n" +
                "        allowPrivilegeEscalation: false\n" +
                "        readOnlyRootFilesystem: true\n" +
                "        capabilities: { drop: [\"ALL\"] }\n" +
                "      resources:\n" +
                "        requests: { cpu: 250m, memory: 384Mi }\n" +
                "        limits:   { memory: 512Mi }\n" +
                "      volumeMounts: [{ name: tmp, mountPath: /tmp }]\n" +
                "  volumes: [{ name: tmp, emptyDir: {} }]"
              },
              { t: "note", variant: "key", html: "<strong>Label every app namespace restricted, and write pods that pass it.</strong> Non-root, no escalation, no capabilities, read-only root, seccomp, limits." }
            ]
          },
          {
            id: "k8s-pipeline",
            title: "The Kubernetes deploy stage: gated Helm upgrade or Argo sync",
            summary: "Deploy only after Snyk and Wiz gates pass, with policy checks on the rendered manifests.",
            minutes: 10,
            tags: ["practitioner", "helm", "argo-cd", "jenkins", "kyverno"],
            blocks: [
              { t: "code", lang: "groovy", code:
                "stage('K8s policy check') {\n" +
                "  steps {\n" +
                "    sh 'helm template payments ./chart -f envs/prod/values.yaml > rendered.yaml'\n" +
                "    sh 'kyverno apply policies/ --resource rendered.yaml'          // same policies as the cluster\n" +
                "    withCredentials([usernamePassword(credentialsId: 'wiz-service-account',\n" +
                "        usernameVariable: 'WIZ_CLIENT_ID', passwordVariable: 'WIZ_CLIENT_SECRET')]) {\n" +
                "      sh 'wizcli auth --id \"$WIZ_CLIENT_ID\" --secret \"$WIZ_CLIENT_SECRET\" && wizcli iac scan --path rendered.yaml --policy \"<WIZ_IAC_POLICY>\"'\n" +
                "    }\n" +
                "  }\n" +
                "}\n" +
                "stage('Deploy (GitOps)') {\n" +
                "  when { branch 'main' }\n" +
                "  steps {\n" +
                "    // only reached when Snyk, Wiz image and policy stages passed\n" +
                "    withCredentials([sshUserPrivateKey(credentialsId: 'config-repo-deploy-key', keyFileVariable: 'GIT_KEY')]) {\n" +
                "      sh './ci/bump-image.sh production \"$DIGEST_REF\"'   // Argo CD syncs the new digest\n" +
                "    }\n" +
                "  }\n" +
                "}\n" +
                "// push-based alternative where GitOps is not available:\n" +
                "//   withKubeConfig([credentialsId: 'kubeconfig-payments-deployer']) {\n" +
                "//     sh 'helm upgrade --install payments ./chart -f envs/prod/values.yaml --set image.digest=\"$DIGEST\" --atomic --wait'\n" +
                "//   }"
              },
              { t: "ul", items: [
                "Render once, check the rendered YAML with the same policies admission enforces — no surprises at deploy.",
                "<code class='tok'>--atomic</code> rolls back automatically if the release does not become healthy.",
                "Prefer GitOps so the pipeline holds a config-repo key, not cluster credentials.",
                "The deploy stage is unreachable unless every earlier gate passed: that ordering is the control."
              ] },
              { t: "quiz", id: "ctr-k8s" },
              { t: "note", variant: "key", html: "<strong>Render, policy-check, then let GitOps sync the signed digest.</strong> Admission re-checks in the cluster; runtime watches what it admitted." }
            ]
          }
        ]
      },
      {
        id: "posture",
        name: "Admission, Runtime & Zero Trust",
        icon: "globe",
        lessons: [
          {
            id: "policy-as-code",
            title: "Policy as code and admission control: OPA, Gatekeeper, Kyverno and Wiz admission",
            summary: "The one place Forge teaches policy as code: write rules once, enforce them in CI and at Kubernetes admission.",
            minutes: 12,
            tags: ["practitioner", "opa", "gatekeeper", "kyverno", "rego", "admission", "wiz"],
            blocks: [
              { t: "p", html: "Policy as code expresses rules such as 'no privileged containers' or 'images must come from our registry' as <strong>versioned, tested code</strong>. The same policy can run in CI (on manifests and Terraform plans) and in the cluster (at admission), so there is no gap." },
              { t: "h", text: "Admission control: the cluster's last gate" },
              { t: "p", html: "Every create or update passes authentication, RBAC and then <strong>admission</strong> in the API server before it is stored. Admission controllers can reject or mutate the request, so a rule enforced here holds no matter how the request arrived — pipeline, GitOps or a human with kubectl." },
              { t: "table", headers: ["Controller", "Strength", "Typical policies"], rows: [
                ["Pod Security Admission", "Built in, zero install", "PSS levels per namespace"],
                ["Kyverno", "YAML policies; validate, mutate, generate, verifyImages", "Require digests, verify cosign signatures, generate default NetworkPolicy"],
                ["OPA Gatekeeper", "Rego; very expressive; also used outside Kubernetes", "Allowed registries, required labels, custom org rules"],
                ["Wiz admission controller", "Decisions from central Wiz policies and CI scan records", "Block images with no passing scan, critical CVEs, or misconfigurations"]
              ] },
              { t: "h", text: "Gatekeeper versus Kyverno" },
              { t: "table", headers: ["", "OPA Gatekeeper", "Kyverno"], rows: [
                ["Language", "Rego", "Kubernetes-style YAML"],
                ["Model", "ConstraintTemplate plus Constraint", "ClusterPolicy with validate / mutate / generate / verifyImages"],
                ["Learning curve", "Steeper, very expressive", "Gentle for Kubernetes users"],
                ["Beyond Kubernetes", "OPA also runs in CI, APIs, Terraform (conftest)", "Kubernetes-focused, CLI for CI"]
              ] },
              { t: "code", lang: "yaml", code:
                "apiVersion: kyverno.io/v1\n" +
                "kind: ClusterPolicy\n" +
                "metadata:\n" +
                "  name: disallow-privileged\n" +
                "spec:\n" +
                "  validationFailureAction: Enforce\n" +
                "  rules:\n" +
                "    - name: no-privileged-containers\n" +
                "      match:\n" +
                "        any:\n" +
                "          - resources: { kinds: [Pod] }\n" +
                "      validate:\n" +
                "        message: Privileged containers are not allowed\n" +
                "        pattern:\n" +
                "          spec:\n" +
                "            containers:\n" +
                "              - =(securityContext):\n" +
                "                  =(privileged): \"false\""
              },
              { t: "code", lang: "text", code:
                "# The same intent in Rego (OPA / conftest)\n" +
                "package k8s.pods\n\n" +
                "deny contains msg if {\n" +
                "  some c in input.spec.containers\n" +
                "  c.securityContext.privileged == true\n" +
                "  msg := sprintf(\"container %v must not be privileged\", [c.name])\n" +
                "}"
              },
              { t: "h", text: "Production image rules: digest and signature" },
              { t: "p", html: "The supply-chain controls from <a href='#/chain/supply/sbom-signing'>SBOMs and Sigstore signing</a> become real at admission: a production namespace accepts only images pinned by digest and signed by the pipeline identity." },
              { t: "code", lang: "yaml", code:
                "apiVersion: kyverno.io/v1\n" +
                "kind: ClusterPolicy\n" +
                "metadata: { name: prod-image-rules }\n" +
                "spec:\n" +
                "  validationFailureAction: Enforce\n" +
                "  rules:\n" +
                "    - name: require-digest\n" +
                "      match: { any: [{ resources: { kinds: [Pod], namespaces: [payments] } }] }\n" +
                "      validate:\n" +
                "        message: Images must be pinned by digest\n" +
                "        pattern: { spec: { containers: [{ image: \"*@sha256:*\" }] } }\n" +
                "    - name: verify-signature\n" +
                "      match: { any: [{ resources: { kinds: [Pod], namespaces: [payments] } }] }\n" +
                "      verifyImages:\n" +
                "        - imageReferences: [\"registry.internal.example/payments/*\"]\n" +
                "          attestors:\n" +
                "            - entries: [{ keys: { publicKeys: \"<COSIGN_PUBLIC_KEY_REF>\" } }]"
              },
              { t: "p", html: "Secrets are the one thing admission cannot fix after the fact — keep them out of manifests entirely and deliver them by reference, as covered in <a href='#/chain/identity/secrets-e2e'>secrets end to end</a>." },
              { t: "note", variant: "tip", html: "Roll out new policies in audit mode first (<code class='tok'>Audit</code> in Kyverno, <code class='tok'>dryrun</code> enforcement in Gatekeeper), read the violations report, fix existing workloads, then switch to enforce — exactly the progressive model used for CI gates." },
              { t: "note", variant: "key", html: "<strong>One policy, many enforcement points.</strong> Version it, test it, run it in CI for fast feedback and at admission as the backstop. Kyverno or Gatekeeper encode your rules; the Wiz admission controller adds scan and risk context." }
            ]
          },
          {
            id: "k8s-runtime-supply",
            title: "CIS benchmark, runtime detection and the supply chain into the cluster",
            summary: "kube-bench, Falco, Tetragon, the Wiz Defend sensor, and verifying images before they run.",
            minutes: 10,
            tags: ["advanced", "cis", "kube-bench", "falco", "tetragon", "wiz-defend"],
            blocks: [
              { t: "h", text: "Benchmarks" },
              { t: "p", html: "The <strong>CIS Kubernetes Benchmark</strong> lists configuration checks for the control plane, nodes and policies. <strong>kube-bench</strong> runs those checks on nodes; managed providers publish their own variants because they operate the control plane. CNAPP KSPM reports the same controls continuously." },
              { t: "code", lang: "bash", code: "kubectl apply -f job-kube-bench.yaml     # runs kube-bench as a Job on a node\nkubectl logs job/kube-bench | grep -E '^\\[FAIL\\]'" },
              { t: "h", text: "Runtime detection" },
              { t: "table", headers: ["Tool", "How", "Example detection"], rows: [
                ["Falco", "Kernel events via eBPF; rule language", "Shell spawned in a container; write below /etc; unexpected outbound connection"],
                ["Tetragon", "eBPF observability and enforcement", "Process execution and network events with in-kernel filtering"],
                ["Sysdig Secure", "Commercial platform built on Falco", "Runtime policies plus posture"],
                ["Wiz runtime sensor (Wiz Defend)", "eBPF DaemonSet feeding the Wiz graph", "Reverse shell in a pod whose role reads PII, shown as a threat with blast radius"]
              ] },
              { t: "code", lang: "yaml", code:
                "- rule: Shell in payments container\n" +
                "  desc: An interactive shell started inside a payments workload\n" +
                "  condition: spawned_process and container and k8s.ns.name = \"payments\" and proc.name in (sh, bash, ash)\n" +
                "  output: Shell in container (user=%user.name pod=%k8s.pod.name cmd=%proc.cmdline)\n" +
                "  priority: WARNING"
              },
              { t: "h", text: "Supply chain into the cluster" },
              { t: "ul", items: [
                "Deploy by digest; reject <code class='tok'>:latest</code> and any tag-only reference in production.",
                "Verify the cosign signature and provenance at admission; only the pipeline identity may sign.",
                "Allow only internal registries; mirror third-party images through the pipeline so they are scanned and signed too."
              ] },
              { t: "note", variant: "key", html: "<strong>Benchmark the configuration, watch the runtime, verify what enters.</strong> Runtime alerts flow to the Wiz dashboard and SIEM with graph context." }
            ]
          },
          {
            id: "zero-trust-mesh",
            title: "Posture recap, service mesh mTLS and zero trust",
            summary: "Tie CSPM, CWPP, CIEM and KSPM to clusters, add mesh identity, and treat zero trust as a design idea.",
            minutes: 10,
            tags: ["advanced", "cspm", "kspm", "service-mesh", "mtls", "zero-trust"],
            blocks: [
              { t: "table", headers: ["Lens", "In a Kubernetes estate it finds", "Where you see it in Wiz"], rows: [
                ["CSPM", "Public cluster endpoints, unencrypted node disks, open security groups", "Cloud configuration findings and issues"],
                ["CWPP", "CVEs, malware and secrets in node and container images", "Vulnerability findings mapped to running pods"],
                ["CIEM", "Pod roles (IRSA, workload identity) with excessive cloud permissions", "Effective permissions on the graph"],
                ["KSPM", "Privileged pods, cluster-admin bindings, missing NetworkPolicies", "Kubernetes configuration findings"]
              ] },
              { t: "h", text: "Service mesh mTLS" },
              { t: "p", html: "A service mesh such as <strong>Istio</strong> or <strong>Linkerd</strong> gives each workload a certificate for its identity and encrypts service-to-service traffic with <strong>mutual TLS</strong>. Authorization policies can then say <em>orders may call payments on POST /charge</em> rather than trusting IP ranges." },
              { t: "code", lang: "yaml", code:
                "apiVersion: security.istio.io/v1\n" +
                "kind: PeerAuthentication\n" +
                "metadata: { name: default, namespace: payments }\n" +
                "spec: { mtls: { mode: STRICT } }\n" +
                "---\n" +
                "apiVersion: security.istio.io/v1\n" +
                "kind: AuthorizationPolicy\n" +
                "metadata: { name: orders-to-payments, namespace: payments }\n" +
                "spec:\n" +
                "  selector: { matchLabels: { app: payments-api } }\n" +
                "  rules:\n" +
                "    - from: [{ source: { principals: [\"cluster.local/ns/orders/sa/orders-api\"] } }]\n" +
                "      to:   [{ operation: { methods: [\"POST\"], paths: [\"/charge\"] } }]"
              },
              { t: "h", text: "Zero trust, as a design idea" },
              { t: "ul", items: [
                "No implicit trust from network location: inside the VPC is not a credential.",
                "Every request is authenticated and authorized by identity — human, workload or device.",
                "Least privilege everywhere, continuously re-evaluated with context.",
                "Assume breach: segment, encrypt and log so one compromise does not spread."
              ] },
              { t: "quiz", id: "ctr-posture" },
              { t: "note", variant: "key", html: "<strong>Posture shows what is exposed; mesh identity and least privilege shrink what an attacker can reach.</strong> Zero trust is the principle that ties them together." }
            ]
          }
        ]
      }
    ]
  };
})();

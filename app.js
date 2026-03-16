const startBtn = document.getElementById("startBtn");
const retestBtn = document.getElementById("retestBtn");
const copyBtn = document.getElementById("copyBtn");
const statusHint = document.getElementById("statusHint");
const natTypeEl = document.getElementById("natType");
const publicIpEl = document.getElementById("publicIp");
const publicPortEl = document.getElementById("publicPort");
const localIpEl = document.getElementById("localIp");
const ipv6StateEl = document.getElementById("ipv6State");
const durationEl = document.getElementById("duration");
const mappingList = document.getElementById("mappingList");
const stunList = document.getElementById("stunList");
const precisionNote = document.getElementById("precisionNote");
const consentBanner = document.getElementById("consentBanner");
const consentAccept = document.getElementById("consentAccept");
const consentRead = document.getElementById("consentRead");

const STUN_SERVERS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun2.l.google.com:19302",
  "stun:stun.cloudflare.com:3478",
  "stun:global.stun.twilio.com:3478",
];

function renderStunList() {
  stunList.innerHTML = "";
  STUN_SERVERS.forEach((server) => {
    const li = document.createElement("li");
    li.textContent = server;
    stunList.appendChild(li);
  });
}

renderStunList();

if (consentBanner && consentAccept && consentRead) {
  const consentKey = "natlab-consent-ack";
  const acknowledged = localStorage.getItem(consentKey);
  if (!acknowledged) {
    consentBanner.hidden = false;
  }

  consentAccept.addEventListener("click", () => {
    localStorage.setItem(consentKey, "1");
    consentBanner.hidden = true;
  });

  consentRead.addEventListener("click", () => {
    window.location.href = "privacy.html";
  });
}

function setStatus(text) {
  statusHint.textContent = text;
}

function resetUI() {
  natTypeEl.textContent = "-";
  publicIpEl.textContent = "-";
  publicPortEl.textContent = "-";
  localIpEl.textContent = "-";
  ipv6StateEl.textContent = "-";
  durationEl.textContent = "-";
  mappingList.innerHTML = "<li>等待检测…</li>";
  precisionNote.textContent = "结果为浏览器可见范围，部分类型可能无法完全区分。";
  copyBtn.disabled = true;
}

function parseCandidate(line) {
  if (!line) return null;
  const parts = line.trim().split(/\s+/);
  if (parts.length < 8) return null;

  const [foundationPart, component, protocol, priority, ip, port, , type] = parts;
  const data = {
    foundation: foundationPart.split(":")[1],
    component,
    protocol,
    priority: Number(priority),
    ip,
    port: Number(port),
    type,
  };

  for (let i = 8; i < parts.length; i += 2) {
    data[parts[i]] = parts[i + 1];
  }

  return data;
}

function isPrivateIp(ip) {
  if (!ip) return false;
  if (ip.includes(":")) {
    return ip.startsWith("fe80") || ip.startsWith("fc") || ip.startsWith("fd");
  }
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("127.")) {
    return true;
  }
  const octets = ip.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n))) {
    return false;
  }
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
    return true;
  }
  return false;
}

function summarizeMappings(srflxCandidates) {
  const byLocal = new Map();
  srflxCandidates.forEach((cand) => {
    const key = `${cand.raddr || "?"}:${cand.rport || "?"}`;
    if (!byLocal.has(key)) byLocal.set(key, []);
    byLocal.get(key).push(cand);
  });

  const lines = [];
  byLocal.forEach((list, key) => {
    const mapped = list
      .map((c) => `${c.ip}:${c.port}`)
      .filter((v, idx, arr) => arr.indexOf(v) === idx);
    lines.push(`${key}  ->  ${mapped.join(" , ")}`);
  });
  return lines;
}

function analyzeNat(srflxCandidates, hostCandidates) {
  if (!srflxCandidates.length && hostCandidates.some((c) => !isPrivateIp(c.ip))) {
    return {
      type: "Open Internet (无 NAT)",
      note: "检测到公网 Host 地址，未发现 STUN 映射。",
    };
  }

  if (!srflxCandidates.length) {
    return {
      type: "未知 / UDP 受限",
      note: "未获取到 STUN 映射，可能 UDP 被阻断或浏览器限制。",
    };
  }

  const groups = new Map();
  srflxCandidates.forEach((cand) => {
    const key = `${cand.raddr || "?"}:${cand.rport || "?"}`;
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(`${cand.ip}:${cand.port}`);
  });

  let symmetric = false;
  groups.forEach((set) => {
    if (set.size > 1) symmetric = true;
  });

  if (symmetric) {
    return {
      type: "NAT4 · Symmetric",
      note: "不同 STUN 服务器返回不同映射端口。",
    };
  }

  return {
    type: "Cone NAT (NAT2 / NAT3)",
    note: "纯浏览器无法稳定区分 NAT2 与 NAT3。",
  };
}

function formatResults({ natType, publicIp, publicPort, localIp, ipv6State, duration }) {
  return [
    `NAT 类型: ${natType}`,
    `公网 IP: ${publicIp || "-"}`,
    `公网端口: ${publicPort || "-"}`,
    `内网 IP: ${localIp || "-"}`,
    `IPv6: ${ipv6State}`,
    `耗时: ${duration}`,
  ].join("\n");
}

async function runTest() {
  resetUI();
  startBtn.disabled = true;
  retestBtn.disabled = true;
  setStatus("检测中… 约 3-6 秒");

  const startTime = performance.now();
  const srflxCandidates = [];
  const hostCandidates = [];

  const pc = new RTCPeerConnection({
    iceServers: STUN_SERVERS.map((url) => ({ urls: url })),
  });

  pc.createDataChannel("nat-check");

  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    const parsed = parseCandidate(event.candidate.candidate);
    if (!parsed) return;
    if (parsed.type === "srflx") {
      srflxCandidates.push(parsed);
    } else if (parsed.type === "host") {
      hostCandidates.push(parsed);
    }
  };

  try {
    const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);

    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 6000);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") {
          clearTimeout(timeout);
          resolve();
        }
      };
    });
  } catch (error) {
    console.error(error);
  } finally {
    pc.close();
  }

  const ipv6Detected = srflxCandidates.some((c) => c.ip.includes(":")) ||
    hostCandidates.some((c) => c.ip.includes(":"));

  const nat = analyzeNat(srflxCandidates, hostCandidates);
  const primary = srflxCandidates[0];

  natTypeEl.textContent = nat.type;
  publicIpEl.textContent = primary ? primary.ip : "-";
  publicPortEl.textContent = primary ? primary.port : "-";
  localIpEl.textContent = primary ? `${primary.raddr || "-"}:${primary.rport || "-"}` : "-";
  ipv6StateEl.textContent = ipv6Detected ? "检测到 IPv6" : "未检测到";

  const duration = ((performance.now() - startTime) / 1000).toFixed(1);
  durationEl.textContent = `${duration}s`;
  precisionNote.textContent = nat.note;

  const mappingLines = summarizeMappings(srflxCandidates);
  mappingList.innerHTML = "";
  if (mappingLines.length === 0) {
    const li = document.createElement("li");
    li.textContent = "暂无映射记录";
    mappingList.appendChild(li);
  } else {
    mappingLines.forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      mappingList.appendChild(li);
    });
  }

  const resultsText = formatResults({
    natType: nat.type,
    publicIp: primary ? primary.ip : "-",
    publicPort: primary ? primary.port : "-",
    localIp: primary ? `${primary.raddr || "-"}:${primary.rport || "-"}` : "-",
    ipv6State: ipv6Detected ? "检测到" : "未检测到",
    duration: `${duration}s`,
  });

  copyBtn.disabled = false;
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(resultsText);
      setStatus("已复制结果");
    } catch (error) {
      console.error(error);
      setStatus("复制失败，请手动选择");
    }
  };

  setStatus("检测完成");
  retestBtn.disabled = false;
  startBtn.disabled = false;
}

startBtn.addEventListener("click", runTest);
retestBtn.addEventListener("click", runTest);

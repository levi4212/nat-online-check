const fs = require("fs");
const path = require("path");

const email = process.env.CONTACT_EMAIL || "support@example.com";
const note = process.env.CONTACT_NOTE || "可填写你的实际联系方式";

const content = `// Auto-generated during build. Do not commit.
window.NATLAB_CONFIG = {
  contactEmail: "${email}",
  contactNote: "${note}",
};
`;

const target = path.join(process.cwd(), "config.js");
fs.writeFileSync(target, content, "utf8");
console.log(`Generated ${target}`);

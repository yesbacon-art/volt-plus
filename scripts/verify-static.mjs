import { readFileSync } from "node:fs";

const html = readFileSync("static/index.html", "utf8");
const mallHtml = readFileSync("static/mall.html", "utf8");
const logo = readFileSync("public/brand/volt-logo.svg", "utf8");
const server = readFileSync("scripts/static-server.mjs", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

const checks = [];

check("static page exists and is HTML", html.startsWith("<!doctype html>"));
check("brand name 伏特家 appears", html.includes("伏特家"));
check("brand name VOLT+ appears", html.includes("VOLT+"));
check("site uses image logo path", html.includes('src="/brand/volt-logo.svg"'));
check("logo SVG asset is valid", logo.includes("<svg") && logo.includes("VOLT+ logo"));
check("main navigation covers requested sections", includesAll(["首页", "电力交易", "V币中心", "Token市场", "AI管理", "V币商城", "帮助中心"]));
check("comprehensive homepage hero exists", includesAll(["新型智能电力交易平台", "电力自由交易", "价值自由流通", "智能能源网络示意图"]));
check("real-time price elements exist", includesAll(["priceValue", "sparkline", "setInterval", "tick()"]));
check("electricity trading controls exist", includesAll(["buyTab", "sellTab", "submitOrder", "placeOrder", "match("]));
check("V coin center and RMB topup exist", includesAll(["V币中心", "topupButton", "人民币充值", "VCOIN_PER_CNY"]));
check("Token purchase flow exists", includesAll(["Token 购买", "tokenButton", "SANDBOX_CONFIRMED", "purchaseToken"]));
check("AI management area exists", includesAll(["AI管理", "aiOptimizeButton", "启动 AI 优化"]));
check("homepage links to standalone V coin mall", includesAll(["V币实物商城", 'href="/mall.html"', "家庭储能电池", "智能充电桩"]));
check("standalone V coin mall page exists", mallHtml.startsWith("<!doctype html>"));
check(
  "V coin mall purchase flow exists",
  includesAllIn(mallHtml, ["V币商城", "产品购买", "purchaseProduct", "voltMallOrders", "确认 V币购买", "V币支付"])
);
check("local auth flow exists", includesAll(["loginButton", "registerButton", "authModal", "submitAuth", "voltUsers", "voltSession", "logoutButton"]));
check("delivery flow exists", includesAll(["电力交割", "deliveryButton", "createDelivery", "ACCEPTED"]));
check("static server can serve logo asset", server.includes("path.startsWith(\"/brand/\")"));
check("package exposes static dev script", pkg.scripts?.["static:dev"] === "node scripts/static-server.mjs");

for (const script of [...inlineScripts(html), ...inlineScripts(mallHtml)]) {
  new Function(script);
}
check("inline scripts parse successfully", true);

const failed = checks.filter((item) => !item.pass);
for (const item of checks) {
  console.log(`${item.pass ? "PASS" : "FAIL"} ${item.name}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} static acceptance check(s) failed.`);
  process.exit(1);
}

console.log(`\n${checks.length} static acceptance checks passed.`);

function check(name, pass) {
  checks.push({ name, pass: Boolean(pass) });
}

function includesAll(items) {
  return items.every((item) => html.includes(item));
}

function includesAllIn(source, items) {
  return items.every((item) => source.includes(item));
}

function inlineScripts(source) {
  return [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
}

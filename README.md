# NAT 在线检测（无服务器版）

纯前端项目，使用 WebRTC + STUN 在浏览器中推断 NAT 类型。

## 本地预览

任意静态服务器即可，例如：

```bash
python3 -m http.server 8080
```

然后打开 `http://localhost:8080`。

## GitHub Pages 部署

1. 新建仓库并提交此目录内容。
2. 在仓库的 Settings → Pages 中选择分支与 `/` 目录。
3. 保存后等待 Pages 构建完成即可访问。

## Cloudflare Pages 部署

1. 新建 Pages 项目并连接 GitHub 仓库。
2. Build command 留空，Build output directory 设为 `/`。
3. 部署完成后使用 Cloudflare 分配的域名访问。

## 说明

- 纯浏览器检测无法稳定区分 NAT2 与 NAT3。
- STUN 服务器可在 `app.js` 中替换或增删。

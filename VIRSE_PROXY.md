# Virse MCP 中转

MICAS-Design 是 MasterGo 插件。它的 UI 运行在 `origin: null` 的 iframe 中，因此 Virse 请求必须经过允许通配 CORS 的 HTTPS 中转。

本仓库的 `api/virse.js` 是可直接部署到 Vercel 的中转函数。部署后，在插件设置里填写：

```text
Base URL: https://api.virse.ai
Virse 中转 URL: https://你的域名/api/virse
```

中转实现与 XC-AI 项目一致，按顺序执行：

1. `initialize`
2. `notifications/initialized`
3. `tools/call`

并额外响应 `OPTIONS` 与 `Access-Control-Allow-Origin: *`，供 MasterGo iframe 调用。

请不要把 Virse API Key 写入服务端环境变量或源码。插件会在每次请求时把用户本地保存的 Key 发送到配置的中转 URL。

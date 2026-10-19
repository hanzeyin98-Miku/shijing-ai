# 诗境·AI

诗词与水墨意象的交互式网页原型。React、Vite、TypeScript 前端；Express + SQLite 本地服务。诗泉 API 用于在线检索，断网时仍可使用内置样例。

## Windows 启动

1. 安装 Node.js 22 或更新版本（安装包自带 npm），安装后重新打开 PowerShell。
2. 在项目文件夹打开 PowerShell，执行 `npm install`。
3. 执行 `npm run dev`，浏览器打开终端显示的 Vite 本地地址（通常是 `http://localhost:5173`）。
4. 停止时在终端按 `Ctrl+C`。

此原型使用 Node.js 内置 SQLite 模块，将数据库保存至 `data/shijing.sqlite`，首次启动服务时自动建立数据表。作品页面可导出 JSON，也可在 API 服务正常运行时保存到数据库。

## 外部服务

- 诗词检索：诗泉 `https://poetry.palemoky.com/`，公开 API，无需密钥；项目服务端代理 `/api/search`。
- 图像生成：预留火山引擎即梦图片生成 API（文档：[即梦 4.0 接口](https://www.volcengine.com/docs/85621/1863351)）。需在火山引擎开通服务并获取 Access Key / Secret Key。当前代码有明确的未配置提示，尚未调用真实即梦接口；须按官方签名 SDK、账号模型权限和返回任务格式补全后端生成路由。绝不能把密钥放进 `src/`。
- 字体：仅使用用户设备已有的中文衬线字体（如系统宋体）；不下载外部字体，也不使用外部图片或模板。山水底图用 CSS 绘制。

## 数据库用途

SQLite 自动创建 `works`（诗作及释义）、`imagery`（意象与人工校订状态）、`mappings`（原文位置与画面区域关联）、`generations`（提示词、模型、结果与反馈）四张表。当前保存接口录入诗作和意象，后续可在 UI 加上标注审核、映射区域编辑、生成日志与反馈录入。

用于训练前应额外记录数据来源/授权、标注人、校订时间、模型版本与许可条件；逐首诗内容不代表可任意用于训练。现阶段释义为示例说明或用户编辑文本，检索到的诗词仅来自诗泉返回结果，尚无自动大模型释义功能。



## 诗词检索 API

页面搜索经本地 Express 服务端代理访问诗泉 API，不在浏览器直接请求第三方服务。服务端优先请求仓库文档中的新版接口 /api/v1/poems/search，如果线上站点返回 404，会自动回退到目前可用的旧版 /api/search。支持全文检索，响应结果会转换为标题、作者、朝代、体裁和诗句列表供用户选择。

- API 仓库与接口说明：https://github.com/palemoky/chinese-poetry-api
- 在线服务：https://poetry.palemoky.com
- 搜索接口数据来源：chinese-poetry 开源诗词数据，接口结果应保留来源说明；释义由本项目页面编辑，不是诗泉返回内容。


## AI 接口占位与接入步骤

意象提取、图像生成、图谱/问答/色彩的本地服务端接口已建立，当前没有绑定具体模型供应商。接口路径、请求/响应格式、密钥配置和接入位置见 [INTEGRATIONS.md](./INTEGRATIONS.md)。复制 .env.example 为 .env，填写服务商接口地址和密钥；若服务商协议不同，在 server/integrations.ts 转换鉴权、请求与响应格式。

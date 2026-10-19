# AI 接口接入说明

项目网页只请求本地 Express 服务；外部 API 地址和密钥只放在根目录 `.env`，不要写进 `src/`。复制 `.env.example` 为 `.env` 后填入地址和密钥，再重启 `npm run dev`。

## 接口对应关系

| 页面功能 | 网页调用 | 外部配置项 | 标准响应 |
| --- | --- | --- | --- |
| 意象提取 | `POST /api/imagery/extract` | `IMAGERY_API_URL` / `IMAGERY_API_KEY` | `{ "imagery": [{ "term": "明月", "category": "景物", "lineIndex": 1, "start": 0, "end": 2, "description": "月亮意象" }] }` |
| 画面生成 | `POST /api/image/generate` | `IMAGE_GENERATION_API_URL` / `IMAGE_GENERATION_API_KEY` | `{ "imageUrl": "https://...", "taskId": "optional", "model": "optional" }` |
| 图谱 | `POST /api/assistant`，`mode: "graph"` | `POETRY_ASSISTANT_API_URL` / `POETRY_ASSISTANT_API_KEY` | `{ "nodes": [{ "id": "n1", "label": "明月", "kind": "意象" }], "edges": [{ "source": "n1", "target": "n2", "relation": "映照" }] }` |
| 问答 | 同一地址，`mode: "qa"` | 同上 | `{ "answer": "诗句的解释……" }` |
| 色彩 | 同一地址，`mode: "color"` | 同上 | `{ "palette": ["#263238", "#c8d0cc"], "emotions": [{ "label": "宁静", "score": 0.8 }] }` |

上述 POST 请求都包含 `poem` 对象（`title`、`author`、`dynasty`、`content`、`explanation`）和 `imagery` 数组。问答请求还会包含 `question`。`/api/assistant` 用 `mode` 区分图谱、问答和色彩，以便这三个功能共用一个外部 API 地址。

## 你需要接入的位置

1. 在根目录复制 `.env.example` 为 `.env`，填写对应的 API URL 和密钥。`.env` 已被 Git 忽略。
2. 如果服务接受 `POST JSON` 且使用 `Authorization: Bearer <key>`，配置后端接口即可直接转发。
3. 如果供应商使用不同的签名、请求字段、异步任务轮询或响应格式，编辑 `server/integrations.ts` 的 `callProvider`，在此处完成转换。这个文件是唯一需要适配外部供应商协议的主要位置。
4. 若供应商响应字段不同，把它转换成上表约定的标准响应。前端请求封装在 `src/api.ts`，界面按钮与展示在 `src/App.tsx`。
5. 保存 `.env` 并重启开发服务。打开 `http://localhost:8787/api/health` 可检查三个接口是否配置了 URL；此检查只显示配置状态，不会公开密钥。

## 请求示例

意象提取：

```json
{
  "poem": {
    "title": "静夜思",
    "author": "李白",
    "dynasty": "唐",
    "content": "床前明月光，疑是地上霜。",
    "explanation": ""
  }
}
```

问答（图谱和色彩请求结构相同，只需把 `mode` 改为 `graph` 或 `color`）：

```json
{
  "mode": "qa",
  "poem": { "title": "静夜思", "author": "李白", "dynasty": "唐", "content": "床前明月光，疑是地上霜。" },
  "imagery": [{ "term": "明月", "category": "景物" }],
  "question": "诗中的明月表达了什么情感？"
}
```

未配置 URL 时，网页会收到 HTTP 503 和具体缺少哪项配置；已配置但上游请求失败时，会显示上游错误，不会悄悄伪造 AI 结果。本地示例和诗泉检索不依赖这些 AI 接口。


## model 参数

服务端会把 .env 中对应的 *_API_MODEL 值附加到上游 JSON 顶层 model 字段。你当前的意象提取服务明确要求此字段，因此请从该服务的 API 文档或控制台复制准确的模型 ID，填到 IMAGERY_API_MODEL= 后。不要猜模型名。图像生成和共用分析接口若也要求 model，同样分别填写 IMAGE_GENERATION_API_MODEL 与 POETRY_ASSISTANT_API_MODEL。改完 .env 后重启项目，再运行 npm run dev 才会加载新配置。


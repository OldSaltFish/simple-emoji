# LLM Config API 变更文档

## 变更概览

| 变更项 | 旧版 | 新版 |
|--------|------|------|
| 路由前缀 | `/llm-config/` | `/config/llm-config/` |
| 数据结构 | 单个 JSON 对象 | JSON 数组（支持多条配置） |
| 存储格式 | `{ "api_type": ..., "endpoint": ..., "api_key": ... }` | `[{ "id": 1, "api_type": ..., "endpoint": ..., "api_key": ... }, ...]` |
| GET 响应 | `data: {...}` | `data: { list: [...], total: number }` |
| 接口数量 | 2 个（GET / PUT） | 4 个（GET / POST / PUT / DELETE） |
| 路径风格 | 简短动词 | 资源名饱和（网络选项卡可辨识） |

## 数据结构

每条配置新增 `id` 字段（自增主键）：

```json
{
  "id": 1,
  "api_type": "openai",
  "endpoint": "https://api.openai.com",
  "api_key": "sk-xxxxxxxxxxxxxxxx"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `number` | 自动生成 | 自增主键，创建时无需传入 |
| `api_type` | `string` | 是 | 枚举：`"openai"` / `"gemini"` / `"claude"` |
| `endpoint` | `string` | 是 | Base Endpoint URL |
| `api_key` | `string` | 是 | API 密钥 |

## 接口列表

### 1. 获取配置列表（分页）

```
GET /config/llm-config/list-llm-config
```

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | `number` | `1` | 页码 |
| `page_size` | `number` | `10` | 每页条数 |

**请求示例：**

```
GET /config/llm-config/list-llm-config?page=1&page_size=10
```

**响应示例：**

```json
{
  "status": "success",
  "msg": "ok",
  "data": {
    "list": [
      {
        "id": 1,
        "api_type": "openai",
        "endpoint": "https://api.openai.com",
        "api_key": "sk-xxxxxxxxxxxxxxxx"
      },
      {
        "id": 2,
        "api_type": "gemini",
        "endpoint": "https://generativelanguage.googleapis.com",
        "api_key": "AIzaSy..."
      }
    ],
    "total": 2
  }
}
```

> 无数据时返回 `data: { "list": [], "total": 0 }`

### 2. 创建配置

```
POST /config/llm-config/create-llm-config
```

**请求 Body：**

```json
{
  "api_type": "claude",
  "endpoint": "https://api.anthropic.com",
  "api_key": "sk-ant-..."
}
```

> 无需传入 `id`，后端自动生成

**成功响应：**

```json
{
  "status": "success",
  "msg": "创建成功",
  "data": {
    "id": 3,
    "api_type": "claude",
    "endpoint": "https://api.anthropic.com",
    "api_key": "sk-ant-..."
  }
}
```

**失败响应：**

```json
{
  "status": "error",
  "msg": "具体错误描述"
}
```

### 3. 更新配置

```
PUT /config/llm-config/update-llm-config?id={id}
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `number` | 是 | 要更新的配置 ID |

**请求 Body：**

```json
{
  "api_type": "openai",
  "endpoint": "https://api.openai.com/v2",
  "api_key": "sk-new-key"
}
```

> `id` 通过查询参数传递，Body 中无需包含 `id`。Body 中字段均为可选，未传的字段保持原值不变

**请求示例：**

```
PUT /config/llm-config/update-llm-config?id=1
```

**成功响应：**

```json
{
  "status": "success",
  "msg": "更新成功",
  "data": {
    "id": 1,
    "api_type": "openai",
    "endpoint": "https://api.openai.com/v2",
    "api_key": "sk-new-key"
  }
}
```

**失败响应：**

```json
{
  "status": "error",
  "msg": "id=1 的配置不存在"
}
```

### 4. 删除配置

```
DELETE /config/llm-config/delete-llm-config?id={id}
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `number` | 是 | 要删除的配置 ID |

**请求示例：**

```
DELETE /config/llm-config/delete-llm-config?id=1
```

**成功响应：**

```json
{
  "status": "success",
  "msg": "删除成功"
}
```

**失败响应：**

```json
{
  "status": "error",
  "msg": "id=1 的配置不存在"
}
```

## 前端迁移要点

1. **GET 接口路径变更**：`/llm-config/` → `/config/llm-config/list-llm-config`
2. **GET 响应结构变更**：`data` 从单个对象变为 `{ list, total }` 分页结构
3. **旧版 PUT 整体覆盖已移除**：改为 POST 创建 + PUT 按需更新
4. **每条配置新增 `id` 字段**：更新和删除操作均依赖 `id`
5. **更新接口 `id` 通过查询参数传递**：`PUT /config/llm-config/update-llm-config?id=1`，Body 中无需包含 `id`
6. **删除接口 `id` 通过查询参数传递**：`DELETE /config/llm-config/delete-llm-config?id=1`
7. **路径名饱和化**：所有接口末段路径包含资源名（如 `list-llm-config`、`create-llm-config`），浏览器网络选项卡中可直接辨识操作对象

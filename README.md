# 族谱管理系统

这是根据 `寻根溯源：族谱管理实验.pptx` 搭建的数据库课程作业框架。项目围绕 PostgreSQL、自引用族谱成员表、递归 CTE、十万级模拟数据、索引优化和应用界面验收材料组织。

## 技术栈

- 数据库：PostgreSQL 16
- 后端：Node.js + Express + TypeScript + `pg`
- 前端：React + Vite + TypeScript
- 数据交付：SQL migration、递归查询 SQL、CSV 生成脚本、`COPY` 导入脚本

## 目录

```text
apps/
  api/        后端 API 服务
  web/        黑白简约风格前端
database/
  migrations/ PostgreSQL 表结构、约束、索引、触发器
  queries/    作业要求的核心 SQL 查询
  seed/       生成的 CSV 数据输出目录
scripts/      模拟数据生成脚本
packages/     前后端共享类型
```

## 快速开始

1. 安装依赖：

```bash
npm install
```

2. 复制环境变量：

```bash
copy .env.example .env
```

3. 启动 PostgreSQL：

```bash
docker compose up -d
```

4. 生成十万级模拟数据：

```bash
npm run db:generate
```

5. 导入 CSV：

```bash
npm run db:load
```

6. 启动服务：

```bash
npm run dev:api
npm run dev:web
```

## VSCode 一键运行

项目已提供 VSCode Run and Debug 配置：

- `Genealogy: Dev`：同时启动后端 API 和前端 Vite
- `Genealogy: Init Database`：创建 `genealogy` 数据库、建表、导入 CSV

在 VSCode 左侧进入 Run and Debug，选择 `Genealogy: Dev`，点击运行即可。服务地址：

- 前端：`http://localhost:5173/`
- API：`http://localhost:4000`

如果 PostgreSQL 已安装完成，先运行一次 `Genealogy: Init Database`。当前本地 `.env` 默认连接：

```text
postgres://postgres:long123@localhost:5432/genealogy
```

测试账号：

```text
admin / admin123
guest / guest123
```

也可以在登录页切换到注册，输入不重复账号、密码和确认密码后直接进入系统。

邀请流程：用 `admin` 登录，在族谱条目的操作区点击邀请按钮，输入 `guest` 并发送；退出后用 `guest` 登录，点击顶部信箱即可确认或取消邀请。确认后该族谱会出现在 `guest` 的首页列表中。

## 已覆盖的作业要求

- `users`、`families`、`members`、`family_users`、`invitations` 五类核心表
- `members.father_id`、`members.mother_id`、`members.spouse_id` 自引用建模
- PostgreSQL `WITH RECURSIVE` 祖先、后代、亲缘路径查询
- 族谱不少于 10 个、总成员不少于 10 万、单族谱不少于 5 万、单族谱至少 30 代的数据生成入口
- `father_id`、`mother_id`、`family_id`、`generation`、`name` 等索引
- `EXPLAIN ANALYZE` 性能分析 SQL 入口
- 注册登录、族谱管理、成员管理、核心查询、树形预览的前端框架
